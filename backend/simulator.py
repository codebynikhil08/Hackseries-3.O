"""Stage 1: simulated smartwatch stream. Plain stdlib, one reading per tick (1 tick = 1 s)."""
import math
import random

# Per-patient normals. Night values are derived from these.
# hrv = beat-to-beat variability (RMSSD, ms); pi = perfusion index (pulse strength at the wrist, %).
PATIENTS = {
    "P1": dict(name="Asha", hr=62, spo2=98.0, temp=33.8, rr=13, hrv=55, pi=3.2),
    "P2": dict(name="Ravi", hr=74, spo2=97.0, temp=34.2, rr=15, hrv=38, pi=2.6),
    "P3": dict(name="Meera", hr=68, spo2=96.5, temp=34.0, rr=14, hrv=46, pi=3.0),
}

# Injected events: duration in ticks. Labels mark every reading inside one as "anomaly".
EVENTS = {
    "cardiac_spike": 60,   # HR ~160 while stationary, HRV collapses, weak pulse
    "hypoxia": 90,         # SpO2 falls, HR and RR climb, pulse weakens
    "fever": 180,          # temp rises, HR and RR follow
    "fall": 20,            # impact spike, then lying still
    "afib": 90,            # irregular rhythm: jittery HR, HRV jumps, device flags irregular beats
}


def random_profile(rng, name="synthetic"):
    """A new random person, for training/testing on people the models have never seen."""
    return dict(name=name, hr=rng.uniform(55, 85), spo2=rng.uniform(95.5, 98.5),
                temp=rng.uniform(33.4, 34.6), rr=rng.uniform(11, 17),
                hrv=rng.uniform(30, 60), pi=rng.uniform(2.0, 4.5))


class Patient:
    def __init__(self, pid, seed=None, start_hour=14.0, profile=None):
        self.pid = pid
        self.base = profile or PATIENTS[pid]
        self.log = []         # [event, onset t, end t, precursor lead] ground truth for the forecaster
        self.dlog = []        # [kind, start t, end t] of every decoy, for dataset export
        self.pre = None       # precursor in progress (subtle build-up before an event)
        self.dec = None       # decoy in progress (harmless look-alike bump that resolves)
        self.rng = random.Random(seed)
        self.t = 0
        self.start_hour = start_hour
        self.drift = 0.0      # slow random walk shared by HR/temp
        self.activity = 0.0   # 0 = still, 1 = walking, 3 = workout
        self.burst = 0        # ticks left in the current walk/workout
        self.target = 0.0     # activity level the current burst ramps toward
        self.event = None
        self.event_left = 0

    def hour(self):
        # ponytail: 1 tick = 1 s of clock time; add a time-scale knob if the demo needs fast day/night
        return (self.start_hour + self.t / 3600) % 24

    def inject(self, event, lead=0):
        """Start an event now, or after `lead` ticks of precursor build-up (label stays 'normal' meanwhile)."""
        if lead > 0:
            self.pre = dict(type=event, left=lead, total=lead, mag=self.rng.uniform(0.6, 1.2))
        else:
            self._start(event, self.t + 1, 0)

    def _start(self, event, onset, lead):
        self.event, self.event_left = event, EVENTS[event]
        self.log.append([event, onset, onset + EVENTS[event] - 1, lead])

    def decoy(self, kind, length):
        """Harmless single-signal bump that fades: hr_bump | spo2_dip | temp_wiggle | hrv_dip | pi_dip."""
        self.dlog.append([kind, self.t + 1, self.t + length])
        self.dec = dict(kind=kind, left=length, total=length, mag=self.rng.uniform(0.5, 1.1),
                        peak=self.rng.uniform(0.4, 0.8))

    def _shape(self, v):
        """v: dict hr/rr/spo2/temp/hrv/pi/irr (irr = probability of an 'irregular beat' flag). Adds precursor and decoy shapes."""
        # ponytail: hand-made shapes (assumption: precursors move several signals together, decoys move one);
        # calibrate against real pre-event recordings if ever available
        g = self.rng.gauss
        if self.pre:
            p = self.pre
            m = p["mag"] * (1 - p["left"] / p["total"])     # ramps 0 -> mag up to the onset
            t = p["type"]
            if t == "cardiac_spike":
                v["hr"] += 12 * m + g(0, 2.5 * m)            # creeping, more erratic heart rate
                v["rr"] += 2 * m
                v["hrv"] *= 1 - 0.35 * m
                v["pi"] *= 1 - 0.12 * m
            elif t == "hypoxia":
                v["spo2"] -= 2.5 * m
                v["rr"] += 3 * m
                v["hr"] += 5 * m
                v["pi"] *= 1 - 0.12 * m
                v["hrv"] *= 1 - 0.12 * m
            elif t == "fever":
                v["temp"] += 0.5 * m
                v["hr"] += 3 * m
                v["rr"] += 0.8 * m
                v["hrv"] *= 1 - 0.10 * m
                v["pi"] *= 1 + 0.08 * m
            elif t == "afib":
                v["hr"] += 4 * m + g(0, 4 * m)               # ectopic beats: jitter first
                v["hrv"] *= 1 + 0.8 * m
                v["irr"] = max(v["irr"], 0.25 * m)
            p["left"] -= 1
            if p["left"] <= 0:
                self.pre = None
                self._start(t, self.t, p["total"])
        if self.dec:
            d = self.dec
            k = 1 - d["left"] / d["total"]
            m = d["mag"] * (k / d["peak"] if k < d["peak"] else (1 - k) / (1 - d["peak"]))   # up, then back down
            # decoys move ONE signal smoothly (posture change, stress, cold hands, sensor artifact)
            kind = d["kind"]
            if kind == "hr_bump":
                v["hr"] += 12 * m
            elif kind == "spo2_dip":
                v["spo2"] -= 2.0 * m
            elif kind == "temp_wiggle":
                v["temp"] += 0.35 * m
            elif kind == "hrv_dip":
                v["hrv"] *= 1 - 0.4 * m
            elif kind == "pi_dip":
                v["pi"] *= 1 - 0.3 * m
            d["left"] -= 1
            if d["left"] <= 0:
                self.dec = None

    def _activity(self):
        if self.burst > 0:
            self.burst -= 1
        else:
            r = self.rng.random()
            if r < 0.01:
                self.burst, target = self.rng.randint(30, 120), 1.0   # walk
            elif r < 0.012:
                self.burst, target = self.rng.randint(120, 300), 3.0  # workout
            else:
                target = 0.0
            self.target = target
        self.activity += (self.target - self.activity) * 0.2  # smooth ramp, not a step

    def tick(self):
        g, b = self.rng.gauss, self.base
        self.t += 1
        self._activity()
        self.drift = max(-3, min(3, self.drift + g(0, 0.05)))
        h = self.hour()
        night = h < 6 or h >= 22
        circ = math.cos((h - 16) / 24 * 2 * math.pi)  # peaks mid-afternoon

        a = self.activity
        v = dict(
            hr=b["hr"] - (8 if night else 0) + 22 * a + self.drift + g(0, 1.5),
            rr=b["rr"] - (2 if night else 0) + 4 * a + g(0, 0.6),
            spo2=b["spo2"] - 0.3 * a + g(0, 0.4),
            temp=b["temp"] + 0.3 * circ + 0.15 * a + 0.05 * self.drift + g(0, 0.05),
            hrv=b["hrv"] * (1.2 if night else 1.0) * math.exp(-0.3 * a + g(0, 0.08)),  # HRV rises asleep, falls with effort
            pi=b["pi"] * (1 - 0.1 * min(a, 2)) * math.exp(g(0, 0.06)),
            irr=0.002,   # the watch's own irregular-rhythm flag has a small false-positive rate
        )
        accel = 0.02 + 0.35 * a + abs(g(0, 0.02))  # g-force magnitude, activity proxy
        if self.pre or self.dec:
            self._shape(v)

        label = "normal"
        if self.event:
            label = self.event
            k = 1 - self.event_left / EVENTS[self.event]  # 0 -> 1 progress through event
            if self.event == "cardiac_spike":
                v["hr"], accel = 160 + g(0, 3), 0.02 + abs(g(0, 0.01))
                v["hrv"] *= 0.3
                v["pi"] *= 0.6
                self.activity = self.target = self.burst = 0
            elif self.event == "hypoxia":
                v["spo2"] -= 10 * min(1, k * 3)
                v["hr"] += 25 * min(1, k * 3)
                v["rr"] += 8 * min(1, k * 3)
                v["pi"] *= 1 - 0.3 * min(1, k * 3)
                v["hrv"] *= 1 - 0.25 * min(1, k * 3)
            elif self.event == "fever":
                rise = 2.0 * min(1, k * 2)
                v["temp"] += rise
                v["hr"] += 10 * rise
                v["rr"] += 2 * rise
                v["hrv"] *= 1 - 0.1 * rise
                v["pi"] *= 1 + 0.05 * rise
            elif self.event == "fall":
                accel = 3.5 if self.event_left == EVENTS["fall"] else 0.01
                v["hr"] += 15
                self.activity = self.target = self.burst = 0
            elif self.event == "afib":
                v["hr"] += 20 + g(0, 10)
                v["hrv"] *= 2.5 * math.exp(g(0, 0.3))
                v["pi"] *= 0.85
                v["irr"] = 0.85
            self.event_left -= 1
            if self.event_left <= 0:
                self.event = None

        return dict(
            pid=self.pid, t=self.t, hour=round(h, 2),
            hr=round(v["hr"]), spo2=round(min(100.0, v["spo2"]), 1), temp=round(v["temp"], 2),
            rr=round(v["rr"], 1), accel=round(accel, 2), activity=round(self.activity, 2),
            hrv=round(v["hrv"], 1), pi=round(v["pi"], 2), irregular=int(self.rng.random() < v["irr"]),
            label=label,  # hidden ground truth, for the scorecard only
        )


if __name__ == "__main__":
    import sys
    import time

    live = "--live" in sys.argv
    p = Patient("P1", seed=1)
    rows = []
    for i in range(180):
        if i == 90:
            p.inject("cardiac_spike")
        r = p.tick()
        rows.append(r)
        if live or i % 10 == 0 or 88 <= i <= 95:
            print(r)
        if live:
            time.sleep(1)

    normal = [r for r in rows if r["label"] == "normal"]
    spike = [r for r in rows if r["label"] == "cardiac_spike"]
    assert all(40 <= r["hr"] <= 140 for r in normal), "normal HR out of range"
    assert all(90 <= r["spo2"] <= 100 for r in normal), "normal SpO2 out of range"
    assert all(10 <= r["hrv"] <= 200 and 0.5 <= r["pi"] <= 10 for r in normal), "normal HRV / pulse strength out of range"
    assert len(spike) == 60
    assert all(150 <= r["hr"] <= 170 and r["accel"] < 0.1 for r in spike), "spike not HR~160 stationary"
    assert sum(r["hrv"] for r in spike) / 60 < 0.5 * sum(r["hrv"] for r in normal) / len(normal), "HRV should collapse in a spike"
    for ev in EVENTS:  # every event runs and labels its readings
        q = Patient("P2", seed=2)
        q.inject(ev)
        assert all(q.tick()["label"] == ev for _ in range(EVENTS[ev]))
        assert q.tick()["label"] == "normal"
    q = Patient("P2", seed=5)
    q.inject("afib")
    flags = [q.tick()["irregular"] for _ in range(90)]
    assert sum(flags) > 60, "afib should raise the irregular-rhythm flag most seconds"
    calm = Patient("P2", seed=5)
    assert sum(calm.tick()["irregular"] for _ in range(2000)) < 15, "too many false irregular flags"
    print("OK: stream plausible, spike HR~160 with activity ~0, all events labelled, HRV/pulse/irregular behave")
