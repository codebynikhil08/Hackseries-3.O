import time
import sys
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Ensure backend directory is in python path
BACKEND_DIR = Path(__file__).parent.resolve()
sys.path.insert(0, str(BACKEND_DIR))

# Import Hackseries-3.O core pipeline modules
from simulator import Patient, PATIENTS, EVENTS
from pipeline import is_valid, Windows, SIGNALS, LIMITS
from detect import Detector
from model import MLDetector, FEATURES
from scorecard import warm_radar, Radar

# Initialize FastAPI
app = FastAPI(
    title="PulseGuard — Hackseries-3.O ML Radar API",
    description="Wearable Health Anomaly Radar Backend with Isolation Forest & Personal Baseline Engine",
    version="1.0.0"
)

# CORS configuration (supports local dev and cloud deployment origins)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r".*",
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data Schemas
class StreamControlRequest(BaseModel):
    action: str = Field(..., description="'pause' or 'resume'")

class ScenarioInjectRequest(BaseModel):
    scenario: str = Field(..., description="'cardiac_spike', 'tachycardia', 'hypoxia', 'fever', 'pyrexia', 'fall', 'afib', or 'normal'")

# State Management using genuine Hackseries-3.O Radar
print("Warming up Hackseries-3.O Radar and training per-person Isolation Forest...")
t_start = time.time()
radar, ps = warm_radar(["P1"], seed=10)
patient = ps["P1"]
print(f"Radar initialized for Patient P1 (Asha) in {time.time() - t_start:.2f}s.")

is_running = True
active_scenario = "normal"
readings_history: List[Dict[str, Any]] = []
max_history = 60

events: List[Dict[str, Any]] = [
    {
        "id": "evt-101",
        "timestamp": "09:42:15",
        "severity": "Moderate",
        "title": "Disproportionate Resting Tachycardia",
        "contributing_signals": ["Heart Rate (+34 BPM)", "Resting Inactivity", "HRV Depletion"],
        "explanation": "Sustained elevated pulse (106 BPM) recorded while user remained stationary without kinetic acceleration.",
        "heart_rate": 106,
        "spo2": 97.4,
        "skin_temperature": 33.8,
        "activity": "Resting",
        "acknowledged": True,
        "recovered": True,
        "duration_seconds": 195,
    },
    {
        "id": "evt-102",
        "timestamp": "06:18:04",
        "severity": "Low",
        "title": "Nocturnal Desaturation Dip",
        "contributing_signals": ["SpO₂ (93.8%)", "Sleep State"],
        "explanation": "Transient drop in oxygen saturation to 93.8% during Stage 3 NREM sleep, recovered autonomously within 45 seconds.",
        "heart_rate": 54,
        "spo2": 93.8,
        "skin_temperature": 33.6,
        "activity": "Sleep",
        "acknowledged": True,
        "recovered": True,
        "duration_seconds": 45,
    }
]
active_event_id: Optional[str] = None


def generate_payload() -> Dict[str, Any]:
    global active_event_id
    raw = patient.tick()
    res = radar.update(raw)
    now_utc = datetime.now(timezone.utc).isoformat()
    now_str = datetime.now().strftime("%H:%M:%S")

    hr = int(raw["hr"])
    spo2 = float(raw["spo2"])
    temp = float(raw["temp"])
    rr = float(raw["rr"])
    accel = float(raw["accel"])
    act_val = float(raw["activity"])
    act_str = "Resting" if act_val < 0.2 else ("Light Walk" if act_val < 2.0 else "Active Cardio")
    hrv = float(raw["hrv"])
    pi = float(raw["pi"])
    irr = int(raw["irregular"])

    tier = res["tier"] if res else "normal"
    score = float(res["score"]) if res else 0.0
    rules = res["rules"] if res else "normal"
    ml_score = res["ml_score"] if (res and res.get("ml_score") is not None) else None
    is_ml_flagged = bool(res.get("ml", False)) if res else False
    reason = res["reason"] if (res and res.get("reason")) else ("Nominal physiological baseline" if tier == "normal" else "Elevated physiological deviation")
    z_dict = res.get("z", {}) if res else {}

    contributing = []
    for k, v in z_dict.items():
        if v > 2.0:
            contributing.append(f"{k.upper()} (z={v})")

    # Map tier to UI severity
    is_anomaly = tier == "alert"
    severity = "normal"
    if tier == "alert":
        severity = "Critical" if score > 15.0 or raw["label"] == "cardiac_spike" else "High"
    elif tier == "watch":
        severity = "Moderate"

    # Event tracking and deduplication
    if is_anomaly:
        if active_event_id is None:
            new_id = f"evt-{int(time.time()) % 10000}"
            title = "Active Resting Tachycardia" if raw["label"] == "cardiac_spike" else (
                "Acute Hypoxemia Event" if raw["label"] == "hypoxia" else (
                    "Febrile Hyperthermia" if raw["label"] == "fever" else (
                        "High-G Fall Impact" if raw["label"] == "fall" else "Physiological Outlier Detected"
                    )
                )
            )
            new_event = {
                "id": new_id,
                "timestamp": now_str,
                "severity": severity,
                "title": title,
                "contributing_signals": contributing or ["Multi-signal divergence"],
                "explanation": reason,
                "heart_rate": hr,
                "spo2": spo2,
                "skin_temperature": temp,
                "activity": act_str,
                "acknowledged": False,
                "recovered": False,
                "duration_seconds": 2
            }
            active_event_id = new_id
            events.insert(0, new_event)
        else:
            for ev in events:
                if ev["id"] == active_event_id:
                    ev["duration_seconds"] += 2
                    ev["severity"] = severity
                    break
    else:
        if active_event_id is not None:
            for ev in events:
                if ev["id"] == active_event_id:
                    ev["recovered"] = True
                    break
            active_event_id = None

    payload = {
        "patient_id": patient.pid,
        "patient_name": patient.base.get("name", "Asha"),
        "timestamp": now_utc,
        "readings": {
            "heart_rate": hr,
            "spo2": spo2,
            "skin_temperature": temp,
            "respiratory_rate": rr,
            "acceleration": accel,
            "activity": act_str,
            "activity_numeric": act_val,
            "hrv": hrv,
            "perfusion_index": pi,
            "irregular_rhythm": irr
        },
        "detection": {
            "tier": tier,
            "is_anomaly": is_anomaly,
            "score": score,
            "rule_status": rules,
            "ml_anomaly_score": ml_score,
            "is_ml_anomaly": is_ml_flagged,
            "severity": severity,
            "reason": reason,
            "z_scores": z_dict,
            "contributing_signals": contributing
        },
        "source": "simulation"
    }

    readings_history.append(payload)
    if len(readings_history) > max_history:
        readings_history.pop(0)

    return payload


# Pre-fill history buffer so frontend charts immediately render
for _ in range(25):
    generate_payload()


@app.get("/api/health")
def health_check():
    thr = None
    if "P1" in radar.ml:
        thr = radar.ml["P1"].thr

    return {
        "status": "healthy",
        "service": "PulseGuard Hackseries-3.O ML Radar",
        "patient_id": "P1",
        "patient_name": patient.base.get("name", "Asha"),
        "model_loaded": True,
        "model_type": "IsolationForest",
        "model_threshold": thr,
        "features": FEATURES,
        "supported_scenarios": list(EVENTS.keys()),
        "version": "1.0.0"
    }


@app.get("/api/readings/current")
def get_current_reading():
    if is_running:
        return generate_payload()
    elif readings_history:
        return readings_history[-1]
    else:
        return generate_payload()


@app.get("/api/readings/history")
def get_readings_history():
    return readings_history


@app.get("/api/baseline")
def get_baseline():
    base = patient.base
    return {
        "heart_rate": {
            "resting_min": base["hr"] - 8.0,
            "resting_max": base["hr"] + 14.0,
            "active_min": base["hr"] + 25.0,
            "active_max": base["hr"] + 75.0,
            "typical": float(base["hr"])
        },
        "spo2": {
            "min": 96.0,
            "max": 99.5,
            "typical": float(base["spo2"])
        },
        "skin_temp": {
            "min": base["temp"] - 0.4,
            "max": base["temp"] + 0.6,
            "typical": float(base["temp"])
        },
        "observation_window_days": 14,
        "total_data_points": 40320,
        "confidence_score": 98.4,
        "has_sufficient_data": True,
        "is_model_trained": True
    }


@app.get("/api/events")
def get_events():
    return events


@app.post("/api/events/{event_id}/acknowledge")
def acknowledge_event(event_id: str):
    for ev in events:
        if ev["id"] == event_id:
            ev["acknowledged"] = True
            return {"status": "success", "event_id": event_id, "acknowledged": True}
    raise HTTPException(status_code=404, detail="Event not found")


@app.post("/api/stream/control")
def stream_control(request: StreamControlRequest):
    global is_running
    if request.action == "pause":
        is_running = False
    elif request.action == "resume":
        is_running = True
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'pause' or 'resume'.")
    return {"status": "success", "is_running": is_running}


@app.post("/api/scenario/inject")
def inject_scenario(request: ScenarioInjectRequest):
    global active_scenario
    # Normalize scenario names (support both Hackseries-3.O and UI aliases)
    name = request.scenario.lower().strip()
    mapping = {
        "tachycardia": "cardiac_spike",
        "cardiac_spike": "cardiac_spike",
        "hypoxia": "hypoxia",
        "fever": "fever",
        "pyrexia": "fever",
        "fall": "fall",
        "afib": "afib",
        "normal": "normal"
    }
    
    if name not in mapping:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported scenario '{name}'. Supported: {list(mapping.keys())}"
        )

    ev_name = mapping[name]
    active_scenario = ev_name

    if ev_name == "normal":
        patient.event = None
        patient.event_left = 0
        patient.pre = None
        patient.dec = None
    else:
        patient.inject(ev_name)

    return {"status": "success", "injected_scenario": ev_name, "raw_input": name}


# Optional: Serve production frontend SPA if dist/ exists
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

DIST_DIR = (BACKEND_DIR.parent / "dist").resolve()
if not DIST_DIR.exists():
    DIST_DIR = (BACKEND_DIR / "dist").resolve()

if DIST_DIR.exists():
    assets_dir = DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api"):
            raise HTTPException(status_code=404, detail="API route not found")
        target = DIST_DIR / full_path
        if target.exists() and target.is_file():
            return FileResponse(target)
        return FileResponse(DIST_DIR / "index.html")

