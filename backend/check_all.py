"""Regression suite: run after every stage (`python src/check_all.py`). Add new stage checks at the bottom."""
import subprocess
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

from detect import Detector, _run
from model import train_person, windows_of
from simulator import EVENTS, PATIENTS, Patient


def warmed(det, p):
    _run(det, p, 6000)
    p.start_hour = 2.0 - p.t / 3600
    _run(det, p, 3000)
    p.start_hour = 14.0 - p.t / 3600


def check_scripts():
    for f in ("simulator", "pipeline", "detect", "model"):   # scorecard.py runs ~4 min, checked separately below
        r = subprocess.run([sys.executable, str(HERE / f"{f}.py")], capture_output=True, text=True)
        assert r.returncode == 0, f"{f}.py failed:\n{r.stderr[-800:]}"
    print("ok  stage self-checks (simulator, pipeline, detect, model)")


def check_rules_stress():
    fa = miss = 0
    for seed in range(30, 36):
        for pid in PATIENTS:
            det, p = Detector(), Patient(pid, seed=seed)
            warmed(det, p)
            fa += sum(res["tier"] == "alert" for _, res in _run(det, p, 600))
        for ev in EVENTS:
            det, p = Detector(), Patient("P2", seed=seed)
            warmed(det, p)
            run = _run(det, p, 40 + EVENTS[ev], event_at=40, event=ev)
            miss += not any(res["tier"] == "alert" for _, res in run[40:])
    assert fa == 0 and miss == 0, f"rules: {fa} false alert ticks, {miss} missed events"
    print("ok  rules: 0 false alerts (18 runs), 0 missed events (24 runs)")


def check_interleaved_patients():
    """Three patients streaming at once through ONE detector (the ward case)."""
    det = Detector()
    ps = {pid: Patient(pid, seed=7) for pid in PATIENTS}
    for _ in range(3000):
        for p in ps.values():
            det.update(p.tick())
    ps["P2"].inject("cardiac_spike")
    alerts = {pid: 0 for pid in PATIENTS}
    for _ in range(30):
        for pid, p in ps.items():
            res = det.update(p.tick())
            alerts[pid] += res["tier"] == "alert"
    assert alerts["P2"] > 0 and alerts["P1"] == 0 and alerts["P3"] == 0, alerts
    print("ok  ward: spike on P2 alerts only P2")


def check_ml_all_patients():
    for pid, seed in zip(PATIENTS, (11, 12, 13)):
        ml, p = train_person(pid, seed=seed)
        ns = ml.score([v for v, _ in windows_of(p, 1200)])
        assert np.mean(ns > ml.thr) < 0.10, f"{pid} ML false-positive rate high"
        for ev in EVENTS:
            ml, p = train_person(pid, seed=seed)
            rows = windows_of(p, 40 + EVENTS[ev] + 30, event_at=40, event=ev)
            sc, lab = ml.score([v for v, _ in rows]), np.array([l for _, l in rows])
            assert np.mean(sc[lab == ev] > ml.thr) > 0.4, f"{pid} {ev} not flagged by ML"
    print("ok  ML: every patient x every event flagged, normal FP < 10%")


def check_scorecard():
    """Stage 5: end-to-end Radar (rules + ML blend) on a mixed scenario stream. Full run: python src/scorecard.py"""
    from scorecard import run
    b = run(seeds=(4,), ticks=1800)["blend"]
    assert b["recall"] == 1.0 and b["precision"] >= 0.85, b
    assert b["latency"].get("cardiac_spike", (99,))[0] <= 3, b
    print(f"ok  scorecard: blend precision {b['precision']:.0%}, recall {b['recall']:.0%}")


def check_forecast():
    """Stage 5b: the SAVED forecaster on brand-new people/seeds (never used in training, validation or test).
    Retrain + full honest report: python src/forecast.py"""
    import joblib
    from forecast import MODEL_PATH, build, evaluate, people
    fresh = build(people(4, 44, "fresh"), range(400, 403))
    res = evaluate(joblib.load(MODEL_PATH), fresh, "fresh people (regression)")
    warned = np.mean([r["ml"]["warned"] for r in res.values()])
    false = np.mean([r["ml"]["false_per_hour"] for r in res.values()])
    sudden = max(r["ml"]["sudden_warned"] for r in res.values())
    assert warned >= 0.7 and false <= 2.0 and sudden <= 0.2, (warned, false, sudden)
    print(f"ok  forecast: warned {warned:.0%} of precursor events, {false:.2f} false/h, sudden {sudden:.0%}")


if __name__ == "__main__":
    for c in (check_scripts, check_rules_stress, check_interleaved_patients, check_ml_all_patients, check_scorecard,
              check_forecast):
        c()
    print("ALL OK")
