# CONTEXT

## Event
- Hackathon: 6-hour vibe-coding hackathon (Hackseries 2026).
- Track: Healthcare. Topic: Real-Time Wearable Health Anomaly Radar.
- Working directory: E:\Mohit2\Hackathon\Hackseries2026 (not a git repo).

## Problem (from brief)
Wearables produce constant readings, so users ignore alerts ("warning fatigue"). Build a system that learns each person's normal physiology, detects real emergencies (including multi-signal ones), alerts clearly, and notifies the primary care doctor with a ready-to-send message.
Judging: detection accuracy, personal baseline, multi-signal awareness, responsiveness, alert quality. Live judging uses an "Emergency Health Spike" injection control (e.g. heart rate 160 while stationary).
Rules from the user: must use an external API, must include AI and ML, and the webpage design should be strong.

## Decisions made
- Stack (proposed, not yet confirmed): FastAPI backend (Python) + scikit-learn; single-page HTML/JS frontend. Streamlit is the fallback if we need to go faster.
- External API: Claude API, model `claude-haiku-5-5` (Haiku 5.5). Sonnet 5.5 is an option for richer summaries.
- Claude API key: NOT yet provided. Stored in an environment variable, never in code. Without it, Claude features fall back to templates.
- Data: synthetic (simulated) data is the core, because the live demo needs a stream that reacts to the injection button and needs ground-truth labels for the scorecard. Optional: tune simulator ranges and noise from a public dataset (PhysioNet BIDMC for HR/RR/SpO2; Sleep-EDF or MESA for sleep). Check dataset access terms before downloading. No scraping. Demo wording: "simulated physiology calibrated to published ranges".
- Build method (agreed): stage by stage. Data -> clean -> arrange -> train -> test -> implement for the ML; build -> test -> integrate for each app feature. Get a thin end-to-end slice working early (reading in, spike detected, alert on screen), then deepen each stage. Each stage has a "done when" check.
- Prototype rule: the user does NOT want code built before a plan is approved. An earlier single-file prototype (radar.html) was built by mistake and deleted at the user's request.

## Feature list (proposed; user has NOT yet confirmed final set)
Must-have:
1. Multi-signal stream: heart rate, SpO2, skin temperature, activity, respiratory rate.
2. Personal baseline learned from the person's own readings.
3. Time-aware baseline (day vs night).
4. Isolation Forest anomaly detection (ML).
5. Z-score rules (stats), used for explanation and as a fallback.
6. Explainable alerts (contribution bars per signal).
7. Claude doctor summary (API).
8. Three-tier alerts with merging and suppression.
9. Ward view (several simulated patients, sorted by risk).
10. Scenario library: cardiac spike, sleep apnea, fever onset, overexertion, fall.
11. Live detection scorecard: precision, recall, detection latency.
12. Dark "radar" UI with ECG-style traces.

Stretch:
13. Predictive early warning — PROMOTED TO PRIORITY by the user and BUILT (src/forecast.py, supervised gradient boosting, tested on unseen people).
14. Escalation chain with acknowledgement timers.
15. Claude triage chat (doctor asks questions about an event).
16. Voice alert (browser text-to-speech).
17. Sleep-stage prediction (awake, light, deep, REM) with a small classifier; used as alert context.

Signals now BUILT: heart rate, SpO2, respiratory rate, skin temp, activity (accel), HRV, perfusion index ("pulse strength"), irregular-rhythm flag (AFib event), fall, inactivity welfare check. Not built: sleep apnea, sleep stage/quality; blood pressure skipped (unreliable on watches).

## Working rules
- Ask before building. Present a plan, get approval, then code.
- Keep each change small and shippable. No speculative abstractions.
- Mark simplifications with a `ponytail:` comment naming the ceiling and upgrade path.
- Keep the demo offline-capable except the Claude API calls, which have a template fallback.
- Keep the design clean and clinical: dark theme, status and alert are the most prominent elements, colour is never the only signal (use icons and text).

## Open questions for the user
1. Confirm the final feature list (must-have and stretch).
2. Provide a Claude API key (set as an environment variable), or accept template fallback.
3. Confirm the stack (FastAPI + scikit-learn vs Streamlit).
4. Choose the model for summaries (Haiku 5.5 default, or Sonnet 5.5).
5. Model training: train at startup on simulated normal data, with rolling updates (default proposal).
