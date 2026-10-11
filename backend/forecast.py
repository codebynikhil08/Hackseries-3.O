"""Stage 5b: early warning. Supervised ML that predicts, from the last seconds of trend,
whether an event will START within the next H seconds (before any alert fires).

Honest-evaluation setup: train / validation / test use DIFFERENT randomly generated people and
DIFFERENT seeds. Thresholds are tuned on validation only; test people are touched once, for the report.
"""
import csv
import random
from pathlib import Path

import joblib
import numpy as np
from numpy.lib.stride_tricks import sliding_window_view as swv
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import roc_auc_score

from simulator import EVENTS, Patient, random_profile

HORIZON = {"cardiac_spike": 20, "hypoxia": 30, "fever": 60, "afib": 30}       # seconds ahead we try to warn
LEAD = {"cardiac_spike": (10, 35), "hypoxia": (15, 45), "fever": (30, 90), "afib": (10, 40)}   # precursor lengths simulated
SUDDEN = 0.25          # share of events with NO precursor (unpredictable by design; reported separately)
BASE = 300             # slow personal baseline window (5 min); also the warm-up before the first prediction
PERSIST, COOLDOWN = 3, 60
SIG = ("hr", "spo2", "temp", "rr", "hrv", "pi")
KEYS = SIG + ("accel", "hour", "irregular")
MODEL_PATH = Path(__file__).with_name("forecast_model.joblib")
DATA = Path(__file__).parent.parent / "data"   # train.csv / val.csv / test.csv: the training source of truth


# ---------- features (identical code for training and live use) ----------
def features(S):
    """S: dict of equal-length arrays hr/spo2/temp/rr/accel/hour (len n >= BASE).
    Returns one row per tick from index BASE-1 on: trend features over the last 3/10/30/300 s."""
    off = lambda w: BASE - w            # align every sliding window to end at the same tick
    cols = []
    tt10, tt30 = np.arange(10) - 4.5, np.arange(30) - 14.5
    for s in SIG:
        x = np.asarray(S[s], float)
        w3, w10, w30 = swv(x, 3)[off(3):], swv(x, 10)[off(10):], swv(x, 30)[off(30):]
        base = swv(x, BASE).mean(1)
        sl10, sl30 = w10 @ tt10 / (tt10 @ tt10), w30 @ tt30 / (tt30 @ tt30)
        cols += [w3.mean(1) - base, sl10, sl30, sl10 - sl30, w30.std(1)]
    ax = np.asarray(S["accel"], float)
    a = swv(ax, 30)[off(30):]
    a3, a10 = swv(ax, 3)[off(3):], swv(ax, 10)[off(10):]
    # movement trend: separates "HR up because they started walking" from "HR up at rest"
    cols += [a3.mean(1) - swv(ax, BASE).mean(1), a10 @ tt10 / (tt10 @ tt10)]
    dhr = swv(np.diff(np.asarray(S["hr"], float), prepend=S["hr"][0]), 30)[off(30):]
    h = np.asarray(S["hour"], float)[BASE - 1:]
    irr = swv(np.asarray(S["irregular"], float), 30)[off(30):].mean(1)
    cols += [a.mean(1), a.max(1), dhr.std(1), irr, ((h < 6) | (h >= 22)).astype(float)]
    return np.column_stack(cols)


FEATURE_NAMES = [f"{s}_{k}" for s in SIG for k in ("delta", "slope10", "slope30", "curve", "std30")] + \
                ["accel_delta", "accel_slope10", "accel_mean", "accel_max", "hr_beat_var", "irr_frac30", "night"]


# ---------- data ----------
def make_stream(profile, seed, ticks=3000):
    """Simulated stream with spaced events (most with a precursor) and harmless decoys."""
    rng = random.Random(f"{profile['name']}-{seed}")    # every person x seed gets its own schedule and noise
    p = Patient("S", seed=rng.randrange(2 ** 31), start_hour=rng.choice([2.0, 10.0, 14.0, 20.0]), profile=profile)
    rows, nxt, nxt_decoy = [], rng.randint(BASE + 60, BASE + 300), rng.randint(BASE, BASE + 200)
    calm = 0   # ticks since anything (event, precursor, decoy) was active
    for i in range(ticks):
        busy = p.event or p.pre or p.dec
        calm = 0 if busy else calm + 1
        # events need 120 calm ticks first, decoys never start within 150 ticks of a due event:
        # otherwise "a decoy just ended" would leak "an event is coming"
        if i >= nxt and calm >= 120:
            ev = rng.choice(list(EVENTS))
            lead = 0 if ev == "fall" or rng.random() < SUDDEN else rng.randint(*LEAD.get(ev, (0, 0)))
            p.inject(ev, lead)
            nxt = i + lead + EVENTS[ev] + rng.randint(200, 450)
        elif i >= nxt_decoy and not busy and nxt - i > 150:
            p.decoy(rng.choice(["hr_bump", "spo2_dip", "temp_wiggle", "hrv_dip", "pi_dip"]), rng.randint(20, 70))
            nxt_decoy = i + rng.randint(150, 400)
        rows.append(p.tick())
    S = {k: [r[k] for r in rows] for k in KEYS}
    return S, p.log, p.dlog


def targets(log, n):
    """y[type][j] = 1 if an event of that type starts within (j, j+H]. valid[j] = not inside any event."""
    idx = np.arange(n)
    valid = np.ones(n, bool)
    y = {k: np.zeros(n, bool) for k in HORIZON}
    for ev, onset, end, _ in log:
        o, e = onset - 1, end - 1                      # tick t lives at array index t-1
        valid[o:e + 1] = False
        if ev in y:
            y[ev] |= (idx < o) & (idx >= o - HORIZON[ev])
    return y, valid


def build(profiles, seeds, ticks=4000):
    """Returns per-stream dicts: F (features), y, valid, log — rows aligned to array index BASE-1 .. n-1."""
    out = []
    for prof in profiles:
        for sd in seeds:
            S, log, _ = make_stream(prof, sd, ticks)
            y, valid = targets(log, ticks)
            cut = slice(BASE - 1, None)
            out.append(dict(F=features(S), y={k: v[cut] for k, v in y.items()}, valid=valid[cut],
                            log=log, S=S))
    return out


def stack(streams, ev, stride=1):
    F = np.vstack([s["F"][s["valid"]][::stride] for s in streams])
    y = np.concatenate([s["y"][ev][s["valid"]][::stride] for s in streams])
    return F, y


def people(n, seed, tag):
    rng = random.Random(seed)
    return [random_profile(rng, f"{tag}{i}") for i in range(n)]


# ---------- load a dataset file (same format export_data.py writes; real recordings can use it too) ----------
def _log_from_states(state):
    """Rebuild [event, onset t, end t, precursor lead] from the per-second `state` column."""
    log, i, n = [], 0, len(state)
    while i < n:
        ev = state[i]
        if ev in EVENTS and (i == 0 or state[i - 1] != ev):
            j = i
            while j + 1 < n and state[j + 1] == ev:
                j += 1
            k = i
            while k > 0 and state[k - 1] == "precursor_" + ev:
                k -= 1
            log.append([ev, i + 1, j + 1, i - k])
            i = j
        i += 1
    return log


def load_streams(path):
    """Read a dataset CSV into the same stream dicts build() makes. Needs columns: person, seed, hr, spo2, temp, rr,
    hrv, pi, irregular, accel, hour, state (normal | precursor_X | X | decoy_Y) and the event_within_* targets."""
    groups = {}
    with open(path, newline="") as fh:
        for row in csv.DictReader(fh):
            groups.setdefault((row["person"], row["seed"]), []).append(row)
    out = []
    for rows in groups.values():
        n = len(rows)
        S = {k: [float(r[k]) for r in rows] for k in KEYS}
        state = [r["state"] for r in rows]
        cut = slice(BASE - 1, None)
        y = {ev: np.array([r[f"event_within_{h}s_{ev}"] == "1" for r in rows])[cut] for ev, h in HORIZON.items()}
        valid = np.array([s not in EVENTS for s in state])[cut]
        out.append(dict(F=features(S), y=y, valid=valid, log=_log_from_states(state), S=S))
    return out


# ---------- warnings (episode logic shared by ML and the baseline) ----------
def warnings(score, thr):
    """Warning episode starts when score >= thr for PERSIST ticks in a row; then COOLDOWN ticks of silence."""
    out, run, quiet = [], 0, 0
    for j, s in enumerate(score):
        run = run + 1 if s >= thr else 0
        if quiet:
            quiet -= 1
        elif run >= PERSIST:
            out.append(j)
            quiet = COOLDOWN
    return out


def event_metrics(streams, ev, score_fn, thr):
    """Event-level: warned before onset? lead time; false warnings per hour of non-event time."""
    warned_pre, warned_sud, n_pre, n_sud, leads, false, hours = 0, 0, 0, 0, [], 0, 0.0
    for s in streams:
        sc = score_fn(s)
        ws = warnings(np.where(s["valid"], sc, -np.inf), thr)
        hours += s["valid"].sum() / 3600
        onsets = [(on - 1 - (BASE - 1), lead) for e, on, _, lead in s["log"] if e == ev and on - 1 >= BASE - 1]
        H = HORIZON[ev]
        for o, lead in onsets:
            hit = [o - w for w in ws if o - H <= w < o]
            if lead:
                n_pre += 1; warned_pre += bool(hit)
            else:
                n_sud += 1; warned_sud += bool(hit)
            if hit:
                leads.append(max(hit))
        false += sum(not any(w < o <= w + H for o, _ in onsets) for w in ws)
    return dict(events_with_precursor=n_pre, warned=warned_pre / max(n_pre, 1),
                sudden_events=n_sud, sudden_warned=warned_sud / max(n_sud, 1),
                median_lead_s=float(np.median(leads)) if leads else None,
                false_per_hour=false / max(hours, 1e-9))


FALSE_BUDGET = 1.0     # false warnings per hour we accept; ML and baseline are compared at the same budget


def pick_threshold(streams, ev, score_fn):
    """Lowest cut whose VALIDATION false-warning rate is within budget (most events warned at fixed cost)."""
    allsc = np.concatenate([score_fn(s)[s["valid"]] for s in streams])
    best = float(np.max(allsc)) + 1e-9
    for q in np.linspace(99.995, 90, 60):
        t = float(np.percentile(allsc, q))
        if event_metrics(streams, ev, score_fn, t)["false_per_hour"] <= FALSE_BUDGET:
            best = t
        else:
            break
    return best


# baseline: "the signal has already moved away from its 5-min personal baseline" (single feature, no ML)
BASELINE_FEATURE = {"cardiac_spike": ("hr_delta", 1), "hypoxia": ("spo2_delta", -1), "fever": ("temp_delta", 1),
                    "afib": ("irr_frac30", 1)}


def baseline_score(F, ev):
    name, sign = BASELINE_FEATURE[ev]
    return sign * F[:, FEATURE_NAMES.index(name)]


# ---------- training ----------
def train(train_streams, val_streams):
    models, thr, base_thr = {}, {}, {}
    for ev in HORIZON:
        X, y = stack(train_streams, ev, stride=2)
        m = HistGradientBoostingClassifier(max_iter=300, learning_rate=0.08, random_state=0).fit(X, y)
        models[ev] = m
        thr[ev] = pick_threshold(val_streams, ev, lambda s, m=m: m.predict_proba(s["F"])[:, 1])
        base_thr[ev] = pick_threshold(val_streams, ev, lambda s, ev=ev: baseline_score(s["F"], ev))
    return dict(models=models, thr=thr, base_thr=base_thr)


class Forecaster:
    """Live use: feed readings one by one; returns {event: probability it starts within its horizon}."""
    def __init__(self, bundle):
        self.b = bundle
        self.buf = {}

    def update(self, r):
        from collections import deque
        d = self.buf.setdefault(r["pid"], deque(maxlen=BASE))
        d.append(r)
        if len(d) < BASE:
            return None
        S = {k: [x[k] for x in d] for k in KEYS}
        f = features(S)[-1:]
        return {ev: float(m.predict_proba(f)[0, 1]) for ev, m in self.b["models"].items()}


def evaluate(bundle, streams, label):
    print(f"\n== {label} ==")
    res = {}
    for ev, m in bundle["models"].items():
        X, y = stack(streams, ev)
        auc = roc_auc_score(y, m.predict_proba(X)[:, 1])
        ml = event_metrics(streams, ev, lambda s: m.predict_proba(s["F"])[:, 1], bundle["thr"][ev])
        bl = event_metrics(streams, ev, lambda s: baseline_score(s["F"], ev), bundle["base_thr"][ev])
        res[ev] = dict(auc=auc, ml=ml, baseline=bl)
        fmt = lambda d: (f"warned {d['warned']:.0%} of {d['events_with_precursor']} (sudden {d['sudden_warned']:.0%} "
                         f"of {d['sudden_events']}), median lead {d['median_lead_s']}s, "
                         f"false {d['false_per_hour']:.2f}/h")
        print(f"{ev:14} horizon {HORIZON[ev]}s  row AUC {auc:.3f}  rows {len(y)} (+{int(y.sum())})")
        print(f"   ML       {fmt(ml)}")
        print(f"   baseline {fmt(bl)}")
    return res

if __name__ == "__main__":
    import sys

    if "--regen" in sys.argv or not (DATA / "test.csv").exists():
        import export_data
        export_data.main()                      # (re)write data/*.csv from the simulator
    tr, va, te = (load_streams(DATA / f"{n}.csv") for n in ("train", "val", "test"))
    print(f"training from {DATA.name}/*.csv: train {sum(len(s['F']) for s in tr)} rows / {len(tr)} streams; "
          f"val {sum(len(s['F']) for s in va)} rows / {len(va)} streams; "
          f"TEST {sum(len(s['F']) for s in te)} rows / {len(te)} streams (unseen people, unseen seeds)")
    b = train(tr, va)
    evaluate(b, va, "validation (used to pick thresholds)")
    res = evaluate(b, te, "TEST: unseen people + unseen seeds (never used for any choice)")
    joblib.dump(b, MODEL_PATH)
    print("saved", MODEL_PATH.name)

    # the CSV round-trip changes nothing: loading a file gives the same features/labels as generating directly
    g = build(people(10, 3, "test")[:1], range(300, 301))[0]
    assert np.allclose(g["F"], te[0]["F"]) and (g["valid"] == te[0]["valid"]).all()
    assert all((g["y"][k] == te[0]["y"][k]).all() for k in HORIZON) and g["log"] == te[0]["log"]

    # live Forecaster gives the same numbers as batch features (no train/serve skew)
    S, _, _ = make_stream(people(1, 9, "x")[0], 999, 400)
    fc = Forecaster(b)
    live = [fc.update(dict(pid="x", **{k: S[k][i] for k in S})) for i in range(400)]
    batch = b["models"]["hypoxia"].predict_proba(features(S))[:, 1]
    assert abs(live[-1]["hypoxia"] - batch[-1]) < 1e-9
    for ev, r in res.items():   # on unseen people: clearly better than chance, and at least as good as the rule
        assert r["auc"] > 0.7, f"{ev} AUC too low on unseen people"
        assert r["ml"]["warned"] >= r["baseline"]["warned"] - 0.05, f"{ev}: ML worse than the simple rule"
        assert r["ml"]["sudden_warned"] <= 0.15, f"{ev}: warns before SUDDEN events -> leak in the data"
    print("OK")
