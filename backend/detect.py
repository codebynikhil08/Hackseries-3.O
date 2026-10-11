"""Stage 3: personal baseline + z-score rules + persistence filter. Stdlib only."""
from pipeline import SIGNALS, Windows

SMOOTH = 3          # ticks averaged per decision (cuts noise, spike still shows at once)
MIN_BIN = 20        # samples needed in an activity level (0.1 g wide) before it can be judged
MIN_N = 60          # baseline samples needed before a person/time-of-day can be judged
WATCH, ALERT = 3.5, 5.0
PERSIST = 3         # consecutive high-score ticks before an alert (the speed vs false-alarm knob)
FALL_G = 2.5        # impact above this alerts immediately
FALL_HOLD = 15      # ticks the alert stays up after a fall
Z_CAP = 10
X_CAP = 1.5       # clamp accel for the fit so a fall impact can't extrapolate it
STD_FLOOR = dict(hr=2.0, spo2=0.5, temp=0.1, rr=0.8, accel=0.05, hrv=4.0, pi=0.25)
SCORED = ("hr", "spo2", "temp", "rr", "hrv", "pi")   # accel only selects the activity state
ONE_SIDED = {"spo2": -1, "temp": 1, "pi": -1}        # only low SpO2 / high temp / weak pulse are dangerous (HRV: both ways)
IRR_WINDOW, IRR_MIN = 10, 6   # irregular-rhythm alert: watch flags >= 6 of the last 10 seconds
INACTIVE_S = 1800             # daytime welfare check: no movement for 30 min


def bucket(hour):
    return "night" if hour < 6 or hour >= 22 else "day"


class Reg:
    """Online linear fit y = a + b*accel, so 'normal' moves with activity (no hand-made bins)."""
    def __init__(self):
        self.n = self.sx = self.sy = self.sxx = self.sxy = self.syy = 0.0

    def add(self, x, y):
        self.n += 1
        self.sx += x; self.sy += y; self.sxx += x * x; self.sxy += x * y; self.syy += y * y

    def fit(self):
        mx, my = self.sx / self.n, self.sy / self.n
        vx = self.sxx / self.n - mx * mx
        # ponytail: no slope until the person has been seen moving; walking early on may false-alert
        b = (self.sxy / self.n - mx * my) / vx if vx > 1e-3 else 0.0
        vy = max(0.0, self.syy / self.n - my * my - b * b * max(vx, 0.0))
        return my - b * mx, b, vy ** 0.5


class Detector:
    def __init__(self):
        self.win = Windows()
        self.base = {}    # (pid, bucket, signal) -> Reg
        self.hi = {}      # pid -> consecutive ticks at ALERT-level score
        self.fall = {}    # pid -> ticks of fall hold left
        self.seen = {}    # (pid, bucket, accel bin) -> samples seen at that activity level
        self.idle = {}    # pid -> consecutive seconds without movement

    def update(self, r):
        """Feed one reading. Returns dict(tier, score, z, reason) or None if rejected."""
        if not self.win.add(r):
            return None
        pid = r["pid"]
        recent = list(self.win.w[pid])[-SMOOTH:]
        avg = {s: sum(x[s] for x in recent) / len(recent) for s in SIGNALS}
        x = min(avg["accel"], X_CAP)
        regs = [self.base.setdefault((pid, bucket(r["hour"]), s), Reg()) for s in SCORED]
        out = dict(pid=pid, t=r["t"], z={}, expected={}, value={}, score=0.0, tier="normal", reason="")

        if r["accel"] >= FALL_G:
            self.fall[pid] = FALL_HOLD
        fall = self.fall.get(pid, 0) > 0
        self.fall[pid] = max(0, self.fall.get(pid, 0) - 1)

        # special alerts that need no baseline: the watch's own rhythm flag, and a daytime welfare check
        self.idle[pid] = self.idle.get(pid, 0) + 1 if avg["accel"] < 0.1 else 0
        irr = sum(w["irregular"] for w in list(self.win.w[pid])[-IRR_WINDOW:]) >= IRR_MIN
        special = ("fall detected" if fall else "irregular heart rhythm" if irr else
                   f"no movement for {self.idle[pid] // 60} min (welfare check)"
                   if self.idle[pid] >= INACTIVE_S and bucket(r["hour"]) == "day" else "")

        k = (pid, bucket(r["hour"]), int(x * 10))
        seen = self.seen.get(k, 0)
        # ponytail: an activity level never seen before is learned, not judged; a danger first appearing there is missed
        if regs[0].n < MIN_N or seen < MIN_BIN:  # no baseline for this person / time of day / activity level yet
            self.seen[k] = seen + 1
            for s, g in zip(SCORED, regs):
                g.add(x, avg[s])
            if special:
                out.update(tier="alert", score=Z_CAP, reason=special)
            else:
                out["tier"] = "learning"
            return out

        for s, g in zip(SCORED, regs):
            a, b, sd = g.fit()
            z = (avg[s] - (a + b * x)) / max(sd, STD_FLOOR[s])
            out["expected"][s] = (round(a + b * x, 2), round(max(sd, STD_FLOOR[s]), 2))   # "your normal" right now
            out["value"][s] = round(avg[s], 2)                                             # the smoothed value judged
            if s in ONE_SIDED:
                z = max(z * ONE_SIDED[s], 0)
            out["z"][s] = round(min(abs(z), Z_CAP), 1)
        zs = sorted(out["z"].values(), reverse=True)
        # worst signal + half of every other clearly-off signal: several signals together score higher
        out["score"] = round(zs[0] + 0.5 * sum(z for z in zs[1:] if z > 2), 1)

        self.hi[pid] = self.hi.get(pid, 0) + 1 if out["score"] >= ALERT else 0
        if special:
            out.update(tier="alert", reason=special)
        elif self.hi[pid] >= PERSIST:
            out["tier"] = "alert"
        elif out["score"] >= WATCH:
            out["tier"] = "watch"

        if out["tier"] == "alert" and not special:
            top = max(out["z"], key=out["z"].get)
            out["reason"] = f"{top} off baseline (z={out['z'][top]}) for this activity level"
        if out["score"] < WATCH:   # learn only from normal-looking data, so illness can't become "normal"
            self.seen[k] = seen + 1
            for s, g in zip(SCORED, regs):
                g.add(x, avg[s])
        return out


def _run(det, patient, ticks, event_at=None, event=None):
    """Run ticks; return list of (reading, result)."""
    res = []
    for i in range(ticks):
        if event and i == event_at:
            patient.inject(event)
        r = patient.tick()
        res.append((r, det.update(r)))
    return res


if __name__ == "__main__":
    from simulator import EVENTS, PATIENTS, Patient

    def calibrated(pid, seed):
        det, p = Detector(), Patient(pid, seed=seed)
        _run(det, p, 6000)            # day: rest / walk / workout
        p.start_hour = 2.0 - p.t / 3600
        _run(det, p, 3000)            # night
        p.start_hour = 14.0 - p.t / 3600
        return det, p

    # idle run stays quiet: 10 min per patient, no alert
    for pid in PATIENTS:
        det, p = calibrated(pid, seed=10)
        run = _run(det, p, 600)
        alerts = sum(res["tier"] == "alert" for _, res in run if res)
        watches = sum(res["tier"] == "watch" for _, res in run if res)
        assert alerts == 0, f"{pid}: {alerts} false alerts"
        print(f"{pid} idle 600 ticks: {alerts} alerts, {watches} watches")

    # every event alerts; report latency in ticks
    for ev in EVENTS:
        det, p = calibrated("P1", seed=20)
        run = _run(det, p, 40 + EVENTS[ev], event_at=40, event=ev)
        first = next((r["t"] - run[40][0]["t"] for r, res in run[40:] if res["tier"] == "alert"), None)
        assert first is not None, f"{ev} never alerted"
        print(f"{ev}: alert after {first} ticks")
        if ev == "cardiac_spike":
            assert first <= 3, "spike too slow"
    # welfare check: 31 min without moving in daytime alerts; a normal day never trips it
    det, p = calibrated("P1", seed=30)
    first = None
    for i in range(1900):
        p.burst, p.target, p.activity = 10 ** 9, 0, 0   # hold still: no walking bursts
        res = det.update(p.tick())
        if res["tier"] == "alert" and "welfare" in res["reason"]:
            first = first or i
    assert first is not None and 1500 <= first <= 1800, first   # patient may already have been still a while
    det, p = calibrated("P2", seed=31)
    assert not any("welfare" in (res["reason"] or "") for _, res in _run(det, p, 3000)), "false welfare check"
    print("welfare check: alert after", first, "ticks of stillness")
    print("OK")
