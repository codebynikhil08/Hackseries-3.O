"""Stage 6: live API + dashboard. Run: python src/app.py  ->  http://127.0.0.1:8000

Each second, every patient's reading goes through validation -> rules -> Isolation Forest -> blend -> forecaster.
The page subscribes to /api/stream (server-sent events) and can inject events via /api/inject.
"""
import asyncio
import json
import os
import random
import time
from collections import deque
from contextlib import asynccontextmanager
from pathlib import Path

import joblib
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from detect import MIN_N
from forecast import BASE, HORIZON, LEAD, MODEL_PATH, Forecaster
from pipeline import SIGNALS
from scorecard import Radar
from simulator import EVENTS, PATIENTS, Patient

TICK_S = float(os.environ.get("TICK_S", "1.0"))   # seconds between readings (lower = faster demo)
HISTORY = 180                                      # seconds of trace kept per patient for the charts
WARN_PERSIST = 3                                   # same persistence as the offline warning metrics
ALERT_HOLD = 10                                    # an alert stays on screen at least 10 s (no flashing banner)
STICKY = ("Fall", "Irregular", "No movement")      # incident causes that stay the headline while the alert lasts
SHOWN = ("hr", "spo2", "rr", "temp", "hrv", "pi", "accel")
MONITORED = ("P2",)                                # who is on screen: Ravi only (user choice); add pids to monitor more
RANK = {"alert": 3, "warning": 2, "watch": 1, "normal": 0, "learning": 0}
FRIENDLY = {"cardiac_spike": "heart-rate spike", "hypoxia": "oxygen drop", "fever": "fever", "fall": "fall",
            "afib": "irregular rhythm (AFib)"}
NAMES = {"hr": ("Heart rate", "bpm", 0), "spo2": ("SpO2", "%", 1), "temp": ("Skin temperature", "C", 1),
         "rr": ("Breathing rate", "/min", 0), "hrv": ("HRV", "ms", 0), "pi": ("Pulse strength", "%", 1)}


def explain(res, r, name):
    """Plain-language reason a clinician can read at a glance (the detector's own reason is for engineers)."""
    why = res["reason"]
    if why.startswith("fall"):
        return "Fall detected: hard impact, then lying still"
    if why.startswith("irregular"):
        return "Irregular heart rhythm (possible AFib): flagged by the watch most of the last 10 seconds"
    if "welfare" in why:
        return why[0].upper() + why[1:]
    z, exp = res["z"], res["expected"]
    prio = ("spo2", "hr", "rr", "temp", "pi", "hrv")   # on ties (z is capped), lead with the most critical signal
    off = sorted((k for k in z if z[k] >= 2 and k in exp), key=lambda k: (-z[k], prio.index(k)))
    ml = res.get("rules") != "alert"   # raised by the blend: ML saw an unusual combination, rules corroborated
    if not off:
        return "Unusual combination of signals (ML pattern check), confirmed by rules"
    a = r["accel"]
    doing = "while still" if a < 0.1 else "while walking" if a < 0.7 else "during exercise"
    k = off[0]
    label, unit, d = NAMES[k]
    v = res["value"]          # the same 3-second smoothed values the detector judged (raw readings can disagree)
    hi = v[k] > exp[k][0]
    text = (f"{label} {v[k]:.{d}f} {unit} {doing}, {'well ' if z[k] >= 5 else ''}{'above' if hi else 'below'} "
            f"{name}'s normal (~{exp[k][0]:.{d}f})")
    if len(off) > 1:
        text += "; also " + ", ".join(f"{NAMES[o][0]} {'high' if v[o] > exp[o][0] else 'low'}" for o in off[1:3])
    return text + (" (unusual combination flagged by ML)" if ml else "")


class Ward:
    """All live state. step() advances every patient by one second; tests call it directly."""

    def __init__(self, pids=MONITORED, seed=42):
        self.radar = Radar()
        self.fc = Forecaster(joblib.load(MODEL_PATH))
        self.thr = self.fc.b["thr"]
        self.rng = random.Random(seed)
        self.patients = {pid: Patient(pid, seed=seed + i, start_hour=2.0) for i, pid in enumerate(pids)}
        self.hist = {pid: deque(maxlen=HISTORY) for pid in pids}
        self.state = {}
        self.log = deque(maxlen=200)
        self.streak = {pid: {ev: 0 for ev in HORIZON} for pid in pids}
        self.prev_tier = {pid: "normal" for pid in pids}
        self.hold = {pid: (0, "") for pid in pids}   # (seconds left, reason) of the last alert
        self.log_reason = {}                         # last alert reason written to the log, per patient
        self._warm_up()

    def _warm_up(self):
        """Learn each person's normal before going live: 3000 s of night, then 6000 s of day (seconds of CPU)."""
        for start, ticks in ((2.0, 3000), (14.0, 6000)):
            for p in self.patients.values():
                p.start_hour = start - p.t / 3600
            for i in range(ticks):
                for pid, p in self.patients.items():
                    r = p.tick()
                    res = self.radar.update(r)
                    if start == 14.0 and i >= ticks - BASE:   # forecaster only needs the last 5 minutes
                        self.fc.update(r)
                    if start == 14.0 and i >= ticks - HISTORY and res:   # charts start full, not empty
                        self.hist[pid].append(dict(t=r["t"], tier="normal", irr=r["irregular"], **{k: r[k] for k in SHOWN},
                                                   **{f"exp_{k}": res["expected"].get(k) for k in SHOWN}))
        self.radar.fit_ml()

    def inject(self, pid, event, precursor):
        p = self.patients[pid]
        if p.event or p.pre:
            raise ValueError(f"{pid} already has an event in progress")
        lead = self.rng.randint(*LEAD[event]) if precursor and event in LEAD else 0
        p.inject(event, lead)
        self.log.appendleft(dict(t=time.time(), pid=pid, kind="inject",
                                 text=f"Injected {FRIENDLY[event]}" + (f" with {lead} s of warning signs" if lead else "")))

    def step(self):
        for pid, p in self.patients.items():
            r = p.tick()
            res = self.radar.update(r)
            probs = self.fc.update(r) or {}
            if res is None:                       # rejected as a sensor glitch: keep last state, note it
                self.log.appendleft(dict(t=time.time(), pid=pid, kind="glitch", text="Reading rejected as sensor glitch"))
                continue
            warnings = []
            for ev, pr in probs.items():
                self.streak[pid][ev] = self.streak[pid][ev] + 1 if pr >= self.thr[ev] else 0
                if self.streak[pid][ev] >= WARN_PERSIST:
                    warnings.append(ev)
            tier, reason = res["tier"], explain(res, r, p.base["name"]) if res["tier"] == "alert" else ""
            if tier == "alert":
                if self.prev_tier[pid] == "alert" and self.hold[pid][1].startswith(STICKY):
                    reason = self.hold[pid][1]       # a fall / AFib / welfare incident stays the headline throughout
                self.hold[pid] = (ALERT_HOLD, reason)
            elif self.hold[pid][0] > 0:
                tier, reason = "alert", self.hold[pid][1]
            self.hold[pid] = (max(0, self.hold[pid][0] - 1), self.hold[pid][1])
            if tier != "alert" and warnings:
                tier = "warning"
            s = dict(
                pid=pid, name=p.base["name"], t=r["t"], hour=r["hour"], tier=tier, score=res["score"],
                reason=reason, z=res["z"], expected=res["expected"], ml=res["ml"], ml_score=res["ml_score"],
                reading={k: r[k] for k in SIGNALS + ("irregular", "activity")},
                idle_min=self.radar.det.idle.get(pid, 0) // 60,
                forecast={ev: dict(p=round(pr, 3), thr=round(self.thr[ev], 3), horizon=HORIZON[ev],
                                   warning=ev in warnings) for ev, pr in probs.items()},
                truth=r["label"],   # simulator ground truth, shown only in the demo panel
                resting=self.resting(pid),
            )
            self.state[pid] = s
            self.hist[pid].append(dict(t=r["t"], tier=tier, irr=r["irregular"], **{k: r[k] for k in SHOWN},
                                       **{f"exp_{k}": res["expected"].get(k) for k in SHOWN},
                                       **{f"fc_{ev}": round(pr, 3) for ev, pr in probs.items()}))
            upgraded = (tier == "alert" == self.prev_tier[pid] and reason.startswith(STICKY)
                        and not self.log_reason.get(pid, "").startswith(STICKY))   # e.g. "HRV high" -> "Irregular rhythm"
            if (tier != self.prev_tier[pid] and RANK.get(tier, 0) >= 2) or upgraded:
                self.log_reason[pid] = reason
                text = (reason if tier == "alert" else
                        "Early warning: " + ", ".join(f"{FRIENDLY[ev]} likely within {HORIZON[ev]} s" for ev in warnings))
                self.log.appendleft(dict(t=time.time(), pid=pid, kind=tier, text=text))
            self.prev_tier[pid] = tier

    def resting(self, pid):
        """This person's learned value at rest (movement 0), day and night: resting HR, night-time dip, etc."""
        base = self.radar.det.base
        return {b: {s: round(base[(pid, b, s)].fit()[0], 2) for s in ("hr", "rr", "hrv", "temp")}
                for b in ("day", "night") if (pid, b, "hr") in base and base[(pid, b, "hr")].n >= MIN_N}

    def snapshot(self, history=False):
        pts = sorted(self.state.values(), key=lambda s: (-RANK.get(s["tier"], 0), -s["score"]))
        out = dict(patients=pts, log=list(self.log)[:30], events=list(EVENTS), tick_s=TICK_S)
        if history:
            out["history"] = {pid: list(h) for pid, h in self.hist.items()}
        return out


class InjectBody(BaseModel):
    pid: str
    event: str
    precursor: bool = False


def create_app(run_loop=True):
    ward_box = {}
    tick = {"n": 0}

    @asynccontextmanager
    async def lifespan(app):
        ward_box["w"] = await asyncio.to_thread(Ward)
        ward_box["w"].step()
        task = None
        if run_loop:
            async def loop():
                while True:
                    t0 = time.perf_counter()
                    await asyncio.to_thread(ward_box["w"].step)
                    tick["n"] += 1
                    await asyncio.sleep(max(0.0, TICK_S - (time.perf_counter() - t0)))
            task = asyncio.create_task(loop())
        yield
        if task:
            task.cancel()

    app = FastAPI(title="Wearable Health Anomaly Radar", lifespan=lifespan)
    app.state.ward = ward_box

    @app.get("/")
    def index():
        # no-cache: browsers must re-check the page, or an edited dashboard keeps showing the old one
        return FileResponse(Path(__file__).with_name("static") / "index.html", headers={"Cache-Control": "no-cache"})

    @app.get("/api/state")
    def state():
        return ward_box["w"].snapshot(history=True)

    @app.post("/api/inject")
    def inject(body: InjectBody):
        w = ward_box["w"]
        if body.pid not in w.patients or body.event not in EVENTS:
            raise HTTPException(400, "unknown patient or event")
        try:
            w.inject(body.pid, body.event, body.precursor)
        except ValueError as e:
            raise HTTPException(409, str(e))
        return {"ok": True}

    @app.get("/api/stream")
    async def stream():
        async def gen():
            last = -1
            while True:
                if tick["n"] != last:
                    last = tick["n"]
                    w = ward_box["w"]
                    snap = w.snapshot()
                    snap["points"] = {pid: h[-1] for pid, h in w.hist.items() if h}
                    yield f"data: {json.dumps(snap)}\n\n"
                await asyncio.sleep(min(0.2, TICK_S / 4))
        return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("PORT", "8000")))
