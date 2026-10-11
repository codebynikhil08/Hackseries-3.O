"""Stage 2: validate readings and keep a rolling window per patient. Stdlib only."""
from collections import deque

SIGNALS = ("hr", "spo2", "temp", "rr", "accel", "hrv", "pi")

# Physiologically possible ranges. Outside = sensor glitch, rejected (not an alert).
LIMITS = {
    "hr": (20, 250),
    "spo2": (50, 100),
    "temp": (25, 43),
    "rr": (3, 60),
    "accel": (0, 20),
    "hrv": (2, 300),    # ms, beat-to-beat variability
    "pi": (0.05, 20),   # %, perfusion index
}

WINDOW = 30  # ticks (1 tick = 1 s)


def is_valid(r):
    """True if every signal is a real number inside LIMITS."""
    for s in SIGNALS:
        v = r.get(s)
        if not isinstance(v, (int, float)) or v != v:  # rejects None, strings, NaN
            return False
        lo, hi = LIMITS[s]
        if not lo <= v <= hi:
            return False
    return r.get("irregular") in (0, 1)   # the watch's irregular-rhythm flag


class Windows:
    def __init__(self, size=WINDOW):
        self.size = size
        self.w = {}          # pid -> deque of valid readings
        self.rejected = 0

    def add(self, r):
        """Returns True if accepted. Bad, duplicate or out-of-order readings are counted and dropped."""
        d = self.w.setdefault(r.get("pid"), deque(maxlen=self.size))
        if not is_valid(r) or (d and r.get("t", 0) <= d[-1].get("t", 0)):
            self.rejected += 1
            return False
        d.append(r)
        return True

    def ready(self, pid):
        return len(self.w.get(pid, ())) == self.size

    def features(self, pid):
        """Flat dict per signal: last value (fast reaction), mean and std (trend/noise),
        plus accel max so a 1-tick fall impact isn't averaged away. Input for Stage 3/4."""
        d = self.w[pid]
        f = {}
        for s in SIGNALS:
            v = [x[s] for x in d]
            m = sum(v) / len(v)
            f[s] = v[-1]
            f[s + "_mean"] = m
            f[s + "_std"] = (sum((x - m) ** 2 for x in v) / len(v)) ** 0.5
        f["accel_max"] = max(x["accel"] for x in d)
        f["irr_frac"] = sum(x["irregular"] for x in d) / len(d)   # share of the window the watch flagged an irregular rhythm
        f["label"] = d[-1].get("label", "normal")  # ground truth of newest reading, scorecard only
        return f


if __name__ == "__main__":
    from simulator import Patient

    # bad values rejected
    good = dict(pid="P1", hr=70, spo2=98, temp=34, rr=14, accel=0.1, hrv=45, pi=3.0, irregular=0)
    for bad in (dict(good, hr=999), dict(good, spo2=None), dict(good, temp=float("nan")),
                dict(good, rr="x"), dict(good, spo2=20), dict(good, hrv=0), dict(good, pi=40),
                dict(good, irregular=2), dict(good, irregular=None)):
        assert not is_valid(bad), bad
    assert is_valid(good)

    # windows have the right shape
    win, p = Windows(), Patient("P1", seed=1)
    for i in range(100):
        r = p.tick()
        if i == 50:
            r["hr"] = 999  # injected glitch
        win.add(r)
    assert win.rejected == 1
    assert not win.add(dict(r))  # duplicate timestamp rejected
    assert win.rejected == 2
    assert len(win.w["P1"]) == WINDOW and win.ready("P1")
    f = win.features("P1")
    assert 40 < f["hr_mean"] < 140 and f["hr_std"] >= 0 and f["label"] == "normal"

    # a fall impact survives in accel_max even though the mean stays low
    win, p = Windows(), Patient("P2", seed=3)
    for _ in range(40):
        win.add(p.tick())
    p.inject("fall")
    for _ in range(5):
        win.add(p.tick())
    f = win.features("P2")
    assert f["accel_max"] >= 3 and f["accel_mean"] < 1 and f["label"] == "fall"
    print("OK: bad/duplicate values rejected, window", WINDOW, "->", len(f), "features")
