"""Write the train / validation / test datasets to data/*.csv (same people and seeds as forecast.py)."""
import csv
from pathlib import Path

from forecast import HORIZON, make_stream, people, targets

OUT = Path(__file__).parent.parent / "data"
SPLITS = {"train": (people(30, 1, "train"), range(100, 108)),
          "val": (people(12, 2, "val"), range(200, 205)),
          "test": (people(10, 3, "test"), range(300, 305))}
COLS = ["person", "seed", "t", "hour", "hr", "spo2", "temp", "rr", "hrv", "pi", "irregular", "accel", "state"] + \
       [f"event_within_{h}s_{ev}" for ev, h in HORIZON.items()]


def main(ticks=4000):
    OUT.mkdir(exist_ok=True)
    for name, (profiles, seeds) in SPLITS.items():
        n = 0
        with open(OUT / f"{name}.csv", "w", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(COLS)
            for prof in profiles:
                for sd in seeds:
                    S, log, dlog = make_stream(prof, sd, ticks)
                    y, _ = targets(log, ticks)
                    state = ["normal"] * ticks
                    for kind, a, b in dlog:
                        state[a - 1:b] = ["decoy_" + kind] * (b - a + 1)
                    for ev, onset, end, lead in log:
                        if lead:
                            state[onset - 1 - lead:onset - 1] = ["precursor_" + ev] * lead
                        state[onset - 1:end] = [ev] * (end - onset + 1)
                    for i in range(ticks):
                        w.writerow([prof["name"], sd, i + 1, S["hour"][i], S["hr"][i], S["spo2"][i], S["temp"][i],
                                    S["rr"][i], S["hrv"][i], S["pi"][i], S["irregular"][i], S["accel"][i], state[i]] + [int(y[ev][i]) for ev in HORIZON])
                        n += 1
        print(f"{name}: {n} rows -> {(OUT / f'{name}.csv').name}")


if __name__ == "__main__":
    main()
