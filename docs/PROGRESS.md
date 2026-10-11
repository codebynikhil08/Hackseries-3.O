# PROGRESS

## Status
Planning phase. No application code exists yet.

## Checklist
### Planning
- [x] Problem understood (see CONTEXT.md)
- [x] Brainstorm features (innovation list)
- [x] Architecture proposed (FastAPI + scikit-learn + Claude API + frontend)
- [x] Context and handoff files created
- [ ] User confirms final feature list
- [ ] User provides Claude API key (or accepts template fallback)
- [ ] User confirms stack
- [ ] User confirms model choice

### Build (not started; starts only after approval)
- [x] Phase 1: simulator (signals, noise, drift, activity bursts, scenarios)
- [ ] Phase 2: detection (baseline, time-aware, Isolation Forest, z-score, multi-signal score, persistence filter)
- [ ] Phase 3: API layer (stream endpoint, injection endpoint, Claude summary endpoint with fallback)
- [ ] Phase 4: dashboard (ward view, patient detail, signal cards, banner, explanation, log)
- [ ] Phase 5: doctor notification (Claude summary + copy button + template fallback)
- [ ] Phase 6: scorecard (precision, recall, latency) and scenario library
- [ ] Phase 7: testing and threshold tuning (latency, false alarms on normal run)
- [ ] Phase 8: demo prep (README, judge script, backup recording)
- [ ] Stretch items (see CONTEXT.md 13 to 17)

## Stage order (agreed)
| Stage | Build | Done when |
|---|---|---|
| 1. Data | Simulator | Realistic stream prints; spike appears on command |
| 2. Clean and arrange | Validation, rolling windows | Bad values rejected; windows have the right shape |
| 3. Detect (rules) | Z-score + persistence filter | Spike alerts within ~1 s; idle run stays quiet |
| 4. Train ML | Isolation Forest on normal windows | Anomalies score higher than normal data |
| 5. Test | Scorecard: precision, recall, latency | Numbers printed and as expected |
| 6. Thin UI | One screen: values, banner, alert | Injected spike turns banner red |
| 7. Features | Ward view, Claude summary, explanation, scenarios, stretch items | Each passes its own check before the next |

## Next step
Stage 1 DONE: `src/simulator.py` (stdlib only, Python 3.14). `python src/simulator.py` runs a 3-min stream with a spike at t=91 and self-checks; add `--live` for a 1 reading/s stream.
- 3 patients (P1 Asha HR 62, P2 Ravi HR 74, P3 Meera HR 68); signals hr, spo2, temp, rr, accel, activity; day/night offsets; drift; walk/workout bursts.
- Events: cardiac_spike, hypoxia, fever, fall. `label` field = hidden ground truth.

Stage 2 DONE: `src/pipeline.py` (`python src/pipeline.py` self-checks). `is_valid` rejects out-of-range/None/NaN/non-numeric; `Windows` keeps a 30-tick deque per patient, also rejects duplicate/out-of-order `t`, counts rejects. `features(pid)` returns per signal: last value, `_mean`, `_std`; plus `accel_max` (keeps 1-tick fall impact) and `label` (newest reading's ground truth).

Stage 3 DONE: `src/detect.py` (`python src/detect.py` self-checks). `Detector.update(reading)` -> dict(tier normal|watch|alert|learning, score, z per signal, reason). Per person x day/night baseline = online linear fit of each signal vs accel (so "normal" follows activity); z-score of residual; score = worst z + half of other off signals; alert needs 3 consecutive ticks >= 5.0 (`PERSIST`); fall impact (accel >= 2.5) alerts at once and holds 15 ticks; baseline learns only from normal-looking data; an activity level with < 20 samples is learned, not judged.
Results: cardiac spike alerts after 2 ticks, hypoxia 9, fever 23, fall 0. 0 false alert ticks over 60 idle runs x 600 ticks; 0 of 80 events missed (20 seeds x 4 events). Needs ~9000 ticks of calibration data in the tests; real startup needs a "learning" period (tier=learning, no alerts).

Stage 4 DONE: `src/model.py` (scikit-learn 1.8 installed; `python src/model.py` self-checks). `MLDetector.fit(X)` per person on normal window vectors (`windows_of`, `train_person` helpers); features = residual of hr/spo2/temp/rr (last + mean) vs a linear fit on activity and night, plus accel_max/accel_mean. `score(X)` higher = stranger; `is_anomaly` uses a threshold at the 96th percentile of training scores.
Results (P1): normal false-positive rate 5.2% per tick; windows flagged during events: spike 100%, hypoxia 96%, fever 87%, fall 100%. Raw features (no residuals) flagged ~0%: Isolation Forest barely separates readings far outside its training range, so activity-adjusting was essential. Per-tick false positives are expected; Stage 7 blends this with the z-score persistence filter.

REGRESSION RULE (user-requested): after every stage run `python src/check_all.py` (whole system: stage self-checks, rules stress over 6 seeds x 3 patients, 3-patient interleaved ward stream, ML across all patients and events), fix every failure, and add the new stage's checks to it. Last run: ALL OK (~25 s).
Stage 4 was reworked after the first full regression: the ML passed only on a lucky seed. Features are now 4 dense ones (worst deviation last/mean in the person's own std, count of signals off, accel_max); across seeds 11-16 spike 100%, hypoxia 94-100%, fever 91-100%, fall 45-100% of event windows flagged, normal FP ~4% per tick. Falls are also covered by the rules' immediate impact alert.

Stage 5 DONE: `src/scorecard.py` (`python src/scorecard.py`, ~4 min; a short version runs inside check_all). `Radar` = rules `Detector` + per-person `MLDetector` (trained from the radar's own normal warm-up windows via `fit_ml()`); blend alerts when rules alert, or ML flagged 3 ticks in a row AND rules score >= `BLEND_MIN` 4.5. `scenario()` streams random events; `score()`/`report()` give event-level precision (alert episodes tied to a real event / all episodes), recall, latency per event type.
Full run (3 seeds x 3 patients, ~75 events): rules precision 100% recall 100% (latency ticks: spike 2.1, fall 0, hypoxia 9.4, fever 24.6); ML alone precision 40% recall 100% (119 false alarms); blend precision 100% recall 100%, 0 false alarms (spike 1.9, fall 0, hypoxia 7.2, fever 22.0). BLEND_MIN was 3.5 at first: 6 false alarms from one long ML streak; 4.5 removed them. Regression: ALL OK.
Known: ML scores ~6 ms per reading (slow for many live patients; batch or score every 2nd tick in the API stage). Simulator is the only data source, so these are simulated-data numbers.

Stage 5b DONE (user made it priority): `src/forecast.py` early warning. Retrain + honest report: `python src/forecast.py` (~1.5 min, saves `src/forecast_model.joblib`). Live: `Forecaster(joblib.load(MODEL_PATH)).update(reading)` -> {event: probability it starts within horizon} after 300 s of buffer.
- Predicts: cardiac_spike (HR surge) within 20 s, hypoxia (SpO2 fall) within 30 s, fever within 60 s. Fall is not forecast (sudden by nature).
- Model: HistGradientBoostingClassifier per target, 26 trend features (per signal: 3 s level vs 5-min personal baseline, 10/30 s slope, curvature, 30 s std; movement level/trend; beat-to-beat HR variability; night).
- Simulator additions: `inject(event, lead)` precursor build-up (label stays normal), `decoy(kind, length)` harmless single-signal bumps, `random_profile`, `Patient(profile=...)`, `Patient.log`. ASSUMPTION (documented): real precursors are multi-signal and (heart) irregular; harmless bumps are single-signal and smooth. 25% of events are sudden (no precursor).
- Honest split: train 30 people x 8 streams (888k rows), validation 12 new people (thresholds chosen here, at <= 1 false warning/hour for both ML and baseline), TEST 10 never-seen people + seeds. Fresh 4th set in check_all.
- TEST results (precursor events warned / median lead / false per hour): HR surge 85% / 12 s / 1.1; SpO2 fall 95% / 18 s / 1.0; fever 95% / 30.5 s / 1.0. Simple "already off baseline" rule at same budget: 4% / 53% / 41%. Sudden events warned ~0% (proves no leak).
- Bugs found and fixed while building: (1) decoys copied precursors exactly -> nothing learnable; (2) events started right after decoys -> leak (sudden events were "predicted" 50%); (3) all test people shared the same seed/schedule -> not independent. All fixed; validation and test now agree.
- Ideas not built: seizure / panic-attack events (accelerometer tremor + HR/RR pattern), per-person fine-tuning, probability calibration, show forecast in Radar/UI with "SpO2 likely to fall in ~15 s".

Datasets exported: `python src/export_data.py` writes `data/train.csv` (960,000 raw rows, 30 people x 8 streams), `data/val.csv` (240,000, 12 x 5), `data/test.csv` (200,000, 10 x 5); same people/seeds as forecast.py. Columns: person, seed, t, hour, hr, spo2, temp, rr, accel, state (normal | precursor_X | X | decoy_Y), and 3 forecast targets (event_within_20s_cardiac_spike, 30s_hypoxia, 60s_fever). Raw rows include each stream's first 299 s warm-up; the model's counts (888k / 222k / 185k) exclude those.
Per-second ML accuracy on TEST (valid rows 147,378): HR surge acc 98.8% prec 60.3% rec 41.1% AUC 0.867; SpO2 fall 98.6% / 71.6% / 50.8% / 0.891; fever 97.0% / 87.5% / 42.6% / 0.878. Always-"no" baseline is 98.6 / 98.0 / 95.2%, so use precision/recall/AUC, not accuracy.

Stage 5c DONE (user approved adding 4 metrics before the UI): HRV, irregular rhythm (AFib), perfusion index, inactivity.
- Simulator: new signals `hrv` (RMSSD ms, rises asleep, falls with effort), `pi` (perfusion %, pulse strength), `irregular` (watch's AFib flag, ~0.2% false-positive rate); new event `afib` (90 s: jittery HR +20, HRV x2.5, pulse weaker, flag ~85% of seconds); every event and precursor now also moves HRV/pulse; new single-signal decoys `hrv_dip` (stress), `pi_dip` (cold hands). Profiles carry hrv/pi.
- Pipeline: validates hrv (2-300), pi (0.05-20), irregular in {0,1}; window feature `irr_frac`.
- Rules: score HRV (both directions) and pulse (low only); irregular-rhythm alert when >= 6 of last 10 s flagged; daytime welfare-check alert after 30 min without movement (`INACTIVE_S`). 0 false alerts over 30 idle runs.
- ML (Isolation Forest) fixes found by regression: (1) latest values now judged against latest movement (window-mean movement made walk start/stop look anomalous); (2) drift tracker: 10-min running offset per signal, learns only from rows within 3 sd (slow HR/temp drift looked anomalous); (3) test harness trains night->day so the test continues without a 12 h clock jump. FP per tick over 30 runs: mean 3.9%, max 7.2%; every event flagged >= 91%.
- Forecaster: 4 targets now (afib within 30 s added), 37 features incl. HRV/pulse trends and irregular-flag share. TEST (unseen people): HR surge warned 87% / 7 s lead; SpO2 fall 95% / 17 s; fever 96% / 32.5 s; afib 98% / 14.5 s; each ~0.6-0.9 false warnings/h; sudden events 0%.
- CSVs re-exported with hrv, pi, irregular columns. Regression ALL OK.
- SAFETY BUG found by the full scorecard and fixed: validation capped HRV at 300 ms, so real AFib readings at night were thrown away as "glitches". Cap now 600 ms; new regression check `check_no_event_rejected` (45,000 readings incl. 150 events, day and night, 0 rejected). Scorecard now tolerates rejected readings.
- Full scorecard (3 seeds x 3 patients, 77 events, 5 types): rules precision 100% recall 98.7% (missed 1 fever); ML alone precision 69% recall 100% (36 false alarms); BLEND precision 100% recall 100%, 0 false alarms; latency ticks: afib 2.0, spike 2.0, fall 0, hypoxia 6.9, fever 18.2.
- Displayable now: HR, SpO2, RR, skin temp, activity, HRV, pulse strength, irregular-rhythm flag, fall, inactivity minutes, resting-HR baseline. Not built: sleep apnea scenario, sleep stage/quality, blood pressure (skip).

FORECASTER NOW TRAINS FROM THE CSV FILES (user request): `python src/forecast.py` reads data/train.csv (fit), data/val.csv (thresholds), data/test.csv (final report); regenerates them via export_data.py only if test.csv is missing or with `--regen`. `load_streams(path)` rebuilds features, targets, valid mask and event log from the `state` + `event_within_*` columns, so real recordings in the same format can be dropped in. Verified: the CSV round-trip gives identical features/labels/results to generating in memory (assert in forecast.py main). Still in memory (not file-based): Isolation Forest + rules baselines (per-person, learned live from the stream).

Stage 6 DONE (FastAPI): `python src/app.py` -> http://127.0.0.1:8000 (also `.claude/launch.json` "health-monitor"). `TICK_S` env var speeds the demo up.
- `src/app.py`: `Ward` runs 3 patients through validation -> rules -> Isolation Forest -> blend -> forecaster each second; warm-up ~6 s at startup (9000 simulated s per person); 55 ms per step for 3 patients. Endpoints: GET / (page, no-cache), GET /api/state (snapshot + 180 s history), GET /api/stream (server-sent events, 1/s), POST /api/inject {pid, event, precursor} (400 unknown, 409 if an event is already running).
- Tiers: normal / watch / warning (forecast >= threshold 3 s in a row) / alert. Alert held >= 10 s (no flashing); fall / AFib / welfare causes stay the headline for the whole incident; log records the upgrade when a specific cause appears. Plain-language reasons built from the SAME 3-s smoothed values the detector judged (detect.py now exposes `expected` and `value`), SpO2 leads on ties, "(unusual combination flagged by ML)" when the blend raised it.
- `src/static/index.html`: neutral token-based CSS (light/dark, restyle by editing :root vars; per memory no committed theme), no external libs (offline). Ward cards sorted by risk (updated in place: rebuilding every second swallowed clicks), banner, 7 signal tiles with live trace + "your normal" band (expected +/- 2 sd), "Why" z-bars, early-warning bars (paused during an alert), inject panel with "with warning signs first", alert log, simulator ground truth (demo only). Every state has icon + text, not colour alone; phone layout checked.
- Verified in the browser: spike -> alert ~3 s; oxygen drop with warning signs -> "Early warning: oxygen drop likely within 30 s" before onset, then alert; AFib -> alert, then upgraded to "Irregular heart rhythm"; fall stays "Fall detected".
- Regression: new `check_api` (TestClient, no background loop). ALL OK.

User changes after Stage 6: monitor/display ONLY Ravi (P2) — `MONITORED = ("P2",)` in app.py (add pids to monitor more; the ward list was removed from the page); each signal is one full-width row (value left, trace right; stacked on phones). check_api updated for one patient (also checks the alert clears after the event). Verified in the browser at phone and 1280 px widths.

Charts added (user request "add all possible graphs"): heart rate vs movement scatter with the personal normal band; day vs night resting values + night-time HR dip (`Ward.resting()`, learned intercept at movement 0); activity timeline (still/walking/exercise/fall, idle minutes); irregular-beat timeline; early-warning probability over 3 min (rows scaled to their threshold); skin-temp trend on the tile (°C/10 min); static test-results panel (latency, rules vs ML vs blend, forecast catch rate/lead; numbers copied from Stage 5c, re-copy after retraining). History points now carry `irr` and `fc_<event>`. Not added: ward ranking (one patient shown), steps, sleep apnea/stages, blood pressure (no data). `.claude/launch.json` autoPort on (8000 was taken by another session). check_api extended; check_all ALL OK.

Stage 7 (next, wait for "go"): Claude doctor summary (needs API key; template fallback), copy button; then scenario library / remaining features. Needs stack confirmed (FastAPI default).

(old) Stage 5 text: scorecard (precision, recall, detection latency) for z-score detector, ML, and the blend.
Stack still to confirm (FastAPI default).

## Known issues / risks
- Too many features for 6 hours. Cut order: triage chat, escalation, voice alert, suppression logic.
- Claude features need an API key. Without it the template fallback is used, and the judges won't see the API.
- The earlier single-file prototype was deleted; nothing to recover or maintain from it.

## Work log
### Session 1
- Reviewed the problem statement and brainstormed innovation features and web design.
- Built a single-file prototype (radar.html) by mistake. Deleted it at the user's request.
- Planned architecture, feature list, and dashboard layout.
- Discussed signals (heart rate, SpO2, temperature, respiratory rate, HRV, fall detection) and sleep-stage prediction.
- Created START_HERE.md, CONTEXT.md, and PROGRESS.md for handoff.
- Model set to claude-haiku-5-5 by the user via /model.
- Agreed: synthetic data as core (public dataset only for optional calibration), stage-by-stage build method, Stage 1 = simulator.
- User switched to claude-opus-5-5 and moved to a new chat to start Stage 1.
