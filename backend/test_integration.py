import urllib.request
import json
import time

BASE = "http://127.0.0.1:8000/api"

def get(path):
    req = urllib.request.Request(f"{BASE}{path}", headers={"Accept": "application/json"})
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read().decode())

def post(path, body):
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(f"{BASE}{path}", data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read().decode())

def test_suite():
    print("=== PulseGuard & Hackseries-3.O Backend Integration Tests ===")
    
    # 1. Health & Model check
    health = get("/health")
    print(f"[PASS] 1. Health check: Service='{health['service']}', Patient='{health['patient_name']}' ({health['patient_id']})")
    assert health["model_loaded"] == True, "Isolation Forest model not loaded"
    assert health["model_type"] == "IsolationForest", "Expected IsolationForest model"
    assert len(health["features"]) == 24, f"Expected 24 features, got {len(health['features'])}"
    print(f"       Model Threshold = {health['model_threshold']:.3f}")
    
    # 2. Live reading telemetry check
    reading = get("/readings/current")
    vitals = reading["readings"]
    det = reading["detection"]
    print(f"[PASS] 2. Current telemetry: HR={vitals['heart_rate']} BPM, SpO2={vitals['spo2']}%, Temp={vitals['skin_temperature']}°C, Activity='{vitals['activity']}'")
    print(f"       Isolation Forest score={det['ml_anomaly_score']}, Rule status='{det['rule_status']}', Tier='{det['tier']}'")
    assert "heart_rate" in vitals and "spo2" in vitals, "Missing essential vitals"
    
    # 3. Baseline ranges check
    base = get("/baseline")
    print(f"[PASS] 3. Personal baseline: Resting HR range [{base['heart_rate']['resting_min']} - {base['heart_rate']['resting_max']}] BPM, Typical={base['heart_rate']['typical']} BPM")
    assert base["is_model_trained"] == True, "Baseline should report trained model"
    
    # 4. Scenario Injection: Cardiac Spike
    print("--> Injecting scenario: cardiac_spike")
    inj = post("/scenario/inject", {"scenario": "cardiac_spike"})
    assert inj["status"] == "success"
    time.sleep(1)
    
    spike_reading = get("/readings/current")
    sp_det = spike_reading["detection"]
    sp_vitals = spike_reading["readings"]
    print(f"[PASS] 4. Injected Cardiac Spike: HR={sp_vitals['heart_rate']} BPM (jumped to ~160)")
    print(f"       Detection tier='{sp_det['tier']}', Severity='{sp_det['severity']}', ML score={sp_det['ml_anomaly_score']}")
    print(f"       Reason: '{sp_det['reason']}'")
    assert sp_det["is_anomaly"] == True, "Cardiac spike should be flagged as anomaly"
    assert sp_det["tier"] == "alert", "Expected alert tier during cardiac spike"
    
    # 5. Events history check
    evts = get("/events")
    print(f"[PASS] 5. Historical events: {len(evts)} events recorded. Active title='{evts[0]['title']}'")
    assert len(evts) >= 1, "At least one event should be present"
    
    # 6. Restore normal baseline
    print("--> Restoring normal baseline and flushing rolling window")
    norm_res = post("/scenario/inject", {"scenario": "normal"})
    assert norm_res["status"] == "success"
    # Flush the 30-tick rolling window past the event grace period
    for _ in range(32):
        norm_reading = get("/readings/current")
    print(f"[PASS] 6. Restored Nominal: HR={norm_reading['readings']['heart_rate']} BPM, Tier='{norm_reading['detection']['tier']}', is_anomaly={norm_reading['detection']['is_anomaly']}")
    assert norm_reading["detection"]["tier"] == "normal", "Expected tier normal after window flush"
    
    # 7. Stream control pause and resume
    pause_res = post("/stream/control", {"action": "pause"})
    assert pause_res["is_running"] == False
    resume_res = post("/stream/control", {"action": "resume"})
    assert resume_res["is_running"] == True
    print("[PASS] 7. Stream pause and resume control functional")
    
    print("\nAll integration tests passed successfully!")

if __name__ == "__main__":
    test_suite()
