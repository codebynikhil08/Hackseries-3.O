"""Stage 5: Radar (rules + ML side by side) and a scorecard: precision, recall, detection latency."""
import random

from detect import PERSIST, Detector
from model import MLDetector, vector
from simulator import EVENTS, Patient

BLEND_MIN = 4.5   # rules score needed to corroborate the ML (3.5 let a long ML streak raise 6 false alarms)
GRACE = 30   # alert ticks this soon after an event ends still belong to it (30-tick windows linger)


class Radar:
    """One reading in -> rules tier, ML flag, and the blended tier. Train ML per person after warm-up."""
    def __init__(self):
        self.det = Detector()
        self.ml = {}       # pid -> MLDetector
        self.seen = {}     # pid -> feature vectors collected while warming up
        self.streak = {}   # pid -> consecutive ML-flagged ticks

    def fit_ml(self):
        for pid, X in self.seen.items():
            self.ml[pid] = MLDetector().fit(X)
        self.seen = {}

    def update(self, r):
        res = self.det.update(r)
        if res is None:
            return None
        pid = res["pid"]
        res.update(ml_score=None, ml=False, rules=res["tier"])
        if self.det.win.ready(pid):
            v = vector(self.det.win.features(pid), r["hour"])
            if pid in self.ml:
                m = self.ml[pid]
                res["ml_score"] = round(float(m.score(v)[0]), 3)
                self.streak[pid] = self.streak.get(pid, 0) + 1 if res["ml_score"] > m.thr else 0
                res["ml"] = self.streak[pid] >= PERSIST
            elif res["tier"] in ("normal", "learning"):
                self.seen.setdefault(pid, []).append(v)
        # blend: rules alone, or ML persistently off AND the rules score is clearly elevated
        if res["rules"] != "alert" and res["ml"] and res["score"] >= BLEND_MIN:
            res["tier"] = "alert"
            res["reason"] = res["reason"] or "ML pattern anomaly, corroborated by rules"
        return res


def warm_radar(pids, seed):
    radar, ps = Radar(), {pid: Patient(pid, seed=seed + i) for i, pid in enumerate(pids)}
    for start, ticks in ((2.0, 3000), (14.0, 6000)):   # night, then day; the scenario continues in daytime
        for p in ps.values():
            p.start_hour = start - p.t / 3600
        for _ in range(ticks):
            for p in ps.values():
                radar.update(p.tick())
    radar.fit_ml()
    return radar, ps


def scenario(radar, p, ticks, rng, gap=(240, 420)):
    """Stream with random events spaced out. Returns per-tick (label, rules alert, ml alert, blend alert)."""
    out, nxt = [], rng.randint(*gap)
    for i in range(ticks):
        if i == nxt and p.event is None:
            p.inject(rng.choice(list(EVENTS)))
            nxt = i + EVENTS[p.event] + rng.randint(*gap)
        r = p.tick()
        res = radar.update(r) or dict(rules="rejected", ml=False, tier="rejected")   # a rejected reading never alerts
        out.append((r["label"], res["rules"] == "alert", res["ml"], res["tier"] == "alert"))
    return out


def score(trace, col):
    """Event-level metrics for one detector column of a scenario trace."""
    events, cur = [], None          # (start, end, kind)
    for i, (lab, *_) in enumerate(trace):
        if lab != "normal" and cur is None:
            cur = [i, i, lab]
        elif lab != "normal":
            cur[1] = i
        elif cur:
            events.append(cur); cur = None
    if cur:
        events.append(cur)

    def owner(i):
        return next((e for e in events if e[0] <= i <= e[1] + GRACE), None)

    episodes, start = [], None      # contiguous alert runs
    for i, row in enumerate(trace):
        if row[col] and start is None:
            start = i
        elif not row[col] and start is not None:
            episodes.append(start); start = None
    if start is not None:
        episodes.append(start)

    tp_ep = sum(owner(i) is not None for i in episodes)
    lat = {}
    for s, e, kind in events:
        hit = next((i - s for i in range(s, min(e + GRACE + 1, len(trace))) if trace[i][col]), None)
        lat.setdefault(kind, []).append(hit)
    return dict(events=len(events), detected=sum(h is not None for v in lat.values() for h in v),
                episodes=len(episodes), false_episodes=len(episodes) - tp_ep, latency=lat)


def report(results):
    names = {1: "rules", 2: "ml", 3: "blend"}
    rows = {}
    for col, name in names.items():
        agg = dict(events=0, detected=0, episodes=0, false_episodes=0, latency={})
        for tr in results:
            s = score(tr, col)
            for k in ("events", "detected", "episodes", "false_episodes"):
                agg[k] += s[k]
            for kind, v in s["latency"].items():
                agg["latency"].setdefault(kind, []).extend(v)
        recall = agg["detected"] / max(agg["events"], 1)
        precision = (agg["episodes"] - agg["false_episodes"]) / max(agg["episodes"], 1)
        lat = {k: (round(sum(h for h in v if h is not None) / max(1, sum(h is not None for h in v)), 1),
                   f"{sum(h is not None for h in v)}/{len(v)}") for k, v in agg["latency"].items()}
        rows[name] = dict(precision=precision, recall=recall, false_alarms=agg["false_episodes"], latency=lat)
        print(f"{name:6} precision {precision:6.1%}  recall {recall:6.1%}  false alarms {agg['false_episodes']:3}  "
              f"latency (ticks, caught/total) {lat}")
    return rows


def run(seeds=(1, 2, 3), ticks=3600):
    results = []
    for seed in seeds:
        radar, ps = warm_radar(["P1", "P2", "P3"], seed)
        rng = random.Random(seed)
        for p in ps.values():
            results.append(scenario(radar, p, ticks, rng))
    return report(results)


if __name__ == "__main__":
    rows = run()
    b = rows["blend"]
    assert b["recall"] >= 0.95, "blend misses events"
    assert b["precision"] >= 0.9, "blend raises too many false alarms"
    assert b["latency"].get("cardiac_spike", (99,))[0] <= 3, "spike too slow"
    print("OK")
