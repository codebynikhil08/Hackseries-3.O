"""Stage 4: per-person Isolation Forest on activity-adjusted rolling-window features."""
import numpy as np
from sklearn.ensemble import IsolationForest

from detect import bucket
from pipeline import SIGNALS, Windows

FEATURES = [s + sfx for s in SIGNALS for sfx in ("", "_mean", "_std")] + ["accel_max", "irr_frac", "night"]
IX = {k: i for i, k in enumerate(FEATURES)}
ADJUSTED = ("hr", "spo2", "temp", "rr", "hrv", "pi")   # signals judged relative to what the current activity predicts
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
        self.coef, self.sd, self.thr = {}, None, None

    def _design(self, X):
        return np.c_[np.ones(len(X)), X[:, IX["accel_mean"]], X[:, IX["night"]]]

    def _residuals(self, X):
        """Each signal minus what this person's activity and time of day predict (last value, then window mean)."""
        D = self._design(X)
        return np.column_stack([X[:, IX[s + sfx]] - D @ self.coef[s + sfx] for s in ADJUSTED for sfx in ("", "_mean")])

    def _features(self, X):
        """Few, dense features: Isolation Forest dilutes badly across many columns, so the six residuals
        are collapsed into 'worst deviation' (in this person's own standard deviations)."""
        Z = np.abs(self._residuals(X)) / self.sd
        last, mean = Z[:, 0::2], Z[:, 1::2]
        return np.column_stack([last.max(1), mean.max(1), (last > 2).sum(1), X[:, IX["accel_max"]], X[:, IX["irr_frac"]]])

    def fit(self, X):
        X = np.asarray(X, float)
        D = self._design(X)
        for s in ADJUSTED:
            for sfx in ("", "_mean"):
                self.coef[s + sfx] = np.linalg.lstsq(D, X[:, IX[s + sfx]], rcond=None)[0]
        self.sd = self._residuals(X).std(0) + 1e-6
        F = self._features(X)
        self.m.fit(F)
        self.thr = float(np.percentile(-self.m.score_samples(F), THR_PCT))
        return self

    def score(self, X):
        """Anomaly score: higher = stranger. Above self.thr means anomalous for this person."""
        return -self.m.score_samples(self._features(np.atleast_2d(np.asarray(X, float))))

    def is_anomaly(self, X):
        return self.score(X) > self.thr


def train_person(pid, seed):
    from simulator import Patient
    p = Patient(pid, seed=seed)
    rows = windows_of(p, 6000)
    p.start_hour = 2.0 - p.t / 3600          # night
    rows += windows_of(p, 3000)
    p.start_hour = 14.0 - p.t / 3600
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
