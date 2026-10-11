"""Stage 4: per-person Isolation Forest on activity-adjusted rolling-window features."""
import numpy as np
from sklearn.ensemble import IsolationForest

from detect import STD_FLOOR, bucket
from pipeline import SIGNALS, Windows

FEATURES = [s + sfx for s in SIGNALS for sfx in ("", "_mean", "_std")] + ["accel_max", "irr_frac", "night"]
IX = {k: i for i, k in enumerate(FEATURES)}
ADJUSTED = ("hr", "spo2", "temp", "rr", "hrv", "pi")   # signals judged relative to what the current activity predicts
DRIFT_ALPHA = 1 / 600   # drift tracker: ~10-min running offset per signal, so slow physiological drift isn't "anomalous"
THR_PCT = 96   # ponytail: Isolation Forest can't score far outside its training range much higher than the
               # training extremes, so the cut sits at a lowish percentile (~5% raw false positives per tick);
               # the persistence filter (Stage 7 blend) absorbs them. Upgrade: fuse with the z-score score.


def vector(f, hour):
    return [f[k] for k in FEATURES if k != "night"] + [1.0 if bucket(hour) == "night" else 0.0]


def windows_of(patient, ticks, event_at=None, event=None):
    """Run the simulator; return [(feature vector, label)] for every tick once the window is full."""
    win, out = Windows(), []
    for i in range(ticks):
        if event and i == event_at:
            patient.inject(event)
        r = patient.tick()
        if win.add(r) and win.ready(r["pid"]):
            f = win.features(r["pid"])
            out.append((vector(f, r["hour"]), f["label"]))
    return out


class MLDetector:
    def __init__(self, seed=0):
        self.m = IsolationForest(n_estimators=100, random_state=seed)
        self.coef, self.sd, self.thr, self.ema = {}, None, None, None

    def _design(self, X, sfx):
        # latest values are judged against the latest movement, window means against mean movement
        # (judging the latest HR against the 30 s mean movement made every walk start/stop look anomalous)
        return np.c_[np.ones(len(X)), X[:, IX["accel" + sfx]], X[:, IX["night"]]]

    def _residuals(self, X):
        """Each signal minus what this person's activity and time of day predict (last value, then window mean)."""
        return np.column_stack([X[:, IX[s + sfx]] - self._design(X, sfx) @ self.coef[s + sfx]
                                for s in ADJUSTED for sfx in ("", "_mean")])

    def _center(self, R):
        """Subtract the person's slow running offset (drift tracker). STATEFUL: rows must arrive in time order.
        The offset learns only from rows within 3 sd, so an illness can't drag the baseline with it."""
        C = np.empty_like(R)
        ema = self.ema
        for i, r in enumerate(R):
            C[i] = c = r - ema
            if np.all(np.abs(c) < 3 * self.sd):
                ema = ema + DRIFT_ALPHA * c
        self.ema = ema
        return C

    def _features(self, X, C):
        """Few, dense features: Isolation Forest dilutes badly across many columns, so the six residuals
        are collapsed into 'worst deviation' (in this person's own standard deviations)."""
        Z = np.abs(C) / self.sd
        last, mean = Z[:, 0::2], Z[:, 1::2]
        return np.column_stack([last.max(1), mean.max(1), (last > 2).sum(1), X[:, IX["accel_max"]], X[:, IX["irr_frac"]]])

    def fit(self, X):
        X = np.asarray(X, float)
        for s in ADJUSTED:
            for sfx in ("", "_mean"):
                self.coef[s + sfx] = np.linalg.lstsq(self._design(X, sfx), X[:, IX[s + sfx]], rcond=None)[0]
        # same minimum spreads as the rules: a 0.1 C skin-temperature wobble is never "3 sigma" just because training was calm
        floor = np.array([STD_FLOOR[s] for s in ADJUSTED for _ in ("", "_mean")])
        R = self._residuals(X)
        self.sd, self.ema = np.maximum(R.std(0), floor), np.zeros(R.shape[1])
        C = self._center(R)                          # training rows in time order; leaves the tracker at "now"
        self.sd = np.maximum(C.std(0), floor)
        F = self._features(X, C)
        self.m.fit(F)
        self.thr = float(np.percentile(-self.m.score_samples(F), THR_PCT))
        return self

    def score(self, X):
        """Anomaly score: higher = stranger. Above self.thr means anomalous for this person.
        Rows must be this person's windows in time order (it advances the drift tracker)."""
        X = np.atleast_2d(np.asarray(X, float))
        return -self.m.score_samples(self._features(X, self._center(self._residuals(X))))

    def is_anomaly(self, X):
        return self.score(X) > self.thr


def train_person(pid, seed):
    from simulator import Patient
    p = Patient(pid, seed=seed, start_hour=2.0)   # night first, then day, so the test continues seamlessly
    rows = windows_of(p, 3000)
    p.start_hour = 14.0 - p.t / 3600         # day (one clock jump, inside training only)
    rows += windows_of(p, 6000)
    return MLDetector().fit([v for v, _ in rows]), p


if __name__ == "__main__":
    from simulator import EVENTS

    ml, p = train_person("P1", seed=10)
    ns = ml.score([v for v, _ in windows_of(p, 1200)])
    fp = float(np.mean(ns > ml.thr))
    print(f"normal: mean score {ns.mean():.3f}, thr {ml.thr:.3f}, false-positive rate {fp:.1%}")
    assert fp < 0.10, "too many false positives on normal data"

    for ev in EVENTS:
        ml, p = train_person("P1", seed=10)
        rows = windows_of(p, 40 + EVENTS[ev] + 30, event_at=40, event=ev)   # 40 quiet ticks, then the event
        sc, lab = ml.score([v for v, _ in rows]), np.array([l for _, l in rows])
        e = sc[lab == ev]
        print(f"{ev}: mean score {e.mean():.3f}, flagged {np.mean(e > ml.thr):.0%} of event windows")
        assert e.mean() > ns.mean() and np.mean(e > ml.thr) > 0.4, f"{ev} not separated from normal"
    print("OK: anomalies score higher than normal data")
