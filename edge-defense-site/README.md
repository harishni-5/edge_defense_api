# Edge Defense Lab

An interactive companion to the paper *"A Single Model for Enterprise and IoT Intrusion Detection: Cross-Domain
Failure, Adversarial Robustness, and Edge Deployment"*. It runs the paper's three trained XGBoost models
(A = Enterprise, B = IoT, C = pooled) with exact TreeSHAP, the SHAP-attribution PSI drift monitor and a
Square-style evasion attack — **in the browser, with no backend** — and it can optionally be fed *real captured
flows* through a small FastAPI server and a packet-capture agent.

## 1. Run the site (no backend needed)

    python3 -m http.server 8080        # from this folder
    # open http://localhost:8080

Any static host works (GitHub Pages, Netlify, Vercel, S3). Nothing leaves the browser: the models, the
6,070-flow demo sample and the paper text are all in `data/*.js`.

## 2. Optional: Edge API + live capture

    pip install -r server/requirements.txt
    uvicorn server.app:app --port 8000          # also serves the site at http://localhost:8000

Endpoints: `GET /api/health`, `POST /api/predict`, `POST /api/predict-batch`, `POST /api/drift`,
`POST /api/attack`, `POST /api/ingest`, `GET /api/state`, `GET /api/stream` (server-sent events).

Environment variables (all optional): `EDGE_API_KEY` (require `x-api-key` on `/api/ingest`),
`EDGE_DOMAIN` (`iot` default | `enterprise` — the reference network for the rolling drift monitor),
`EDGE_WINDOW` (`250` | `500` | `1000`), `EDGE_CORS_ORIGINS` (comma-separated; default same-origin only).

Packet agent (browsers cannot sniff packets, so this is the only part that needs Python + root):

    pip install scapy
    sudo python agent/live_agent.py --iface en0 --api http://127.0.0.1:8000     # live interface
    python agent/live_agent.py --pcap capture.pcap --api http://127.0.0.1:8000  # replay a capture
    python agent/live_agent.py --pcap capture.pcap --jsonl flows.jsonl --no-post
    # flows.jsonl can be pasted into the site: Live lab → Connect live traffic → Route 1

Flags: `--iface`, `--pcap`, `--api`, `--api-key`, `--jsonl`, `--no-post`, `--bpf`, `--idle-timeout`,
`--active-timeout`. Only capture networks you own or are authorised to monitor.

**Extractor mismatch caveat.** The agent re-implements CICFlowMeter-style features from packets. The paper's two
datasets already disagree on what `header_len_total` and `byte_rate` mean, and that alone breaks naive transfer —
so validate the agent's output against flows from your training extractor before trusting live scores.

## 3. Merging with the existing `edge-defense-api`

The site is plain static files, so it can be served as-is from the existing FastAPI app
(`app.mount('/lab', StaticFiles(directory='edge-defense-site', html=True))`) or dropped behind the existing
React/Vite shell in an iframe or route. `server/edge_engine.py` is a dependency-light (numpy-only) port of the
browser engine; if the existing API already loads the XGBoost models natively, keep that and reuse only the drift
monitor and attack code. Clerk/Supabase are only needed if you want per-user history or alerting — the lab itself
needs neither.

## 4. How faithful is it?

* **Engine:** the browser TreeSHAP engine and the Python port both match `xgboost` + `shap` to ~1e-6 on margins,
  probabilities and SHAP values (`tools/validate_engine.js`, `tools/validation_ref.json`). Float32 comparisons
  follow xgboost exactly.
* **Reproduce page:** recomputes the paper's AUCs on the demo sample within ~0.01 and the evasion rates
  (JS: 86.8 % / 100 % vs. paper 84.5 % / 100 %); the domain-shift PSI fires at every window size.
* **Python SHAP is slow** (~21 ms per flow in this port) — it is for the API/agent, not the Table VII latency.
  Browser latency in *Latency benchmark* is *not* comparable to the Raspberry Pi numbers in the paper.

## 5. Honest caveats (also shown on the *Limits & honesty* page)

* The "live" simulator is a **replay of a labeled, class-balanced demo sample**, not live traffic, and the sample may
  contain rows the models trained on. Numbers are illustrative; they will not match the paper's test-set intervals.
* PSI thresholds are **recalibrated per window size** (250/500/1000) because null PSI scales ~1/N; the paper's
  0.0125 applies to its own window. Changing the attack share also moves PSI — see the *Quiet hours* / *Burst*
  scenarios.
* On the demo sample, Model C's SHAP-vs-value correlation for `header_len_total` is +0.55 (Enterprise) and −0.19
  (IoT). The paper states the pooled model shows no sign flip; the Mechanism and Reproduce pages show what the
  sample gives — **check this against the full test set before relying on that sentence**.
* `models_v2/edge_benchmark_results.json` reports 2.00 / 4.91 / 10.03 ms whereas paper Table VII reports
  4.31 / 10.29 / 17.49 ms. The site uses the paper's numbers; reconcile the source of the difference.
* Enterprise-network evasion results are exploratory.

## 6. Rebuilding the data bundles

Run from this folder (needs Node ≥ 16 and `data-src/demo_sample.csv`, `enterprise_quantiles.csv`,
`iot_quantiles.csv`): `node tools/build_data.js` regenerates `data/models.js`, `pool.js`, `monitor.js` and
`shapdep.js` from `tools/models_raw.json` + the CSVs (verified byte-identical to the shipped bundles);
`node tools/validate_engine.js` re-checks the engine against the xgboost/shap reference; `node tools/experiments.js`
re-runs the numbers shown on *Reproduce* into `tools/experiments_out.json`. `data/paper.js` and `data/results.js`
are hand-curated from the paper text and are not regenerated.

## Layout

    index.html, css/, js/        the site (hash-routed, no framework, no build step)
    data/*.js                    models, demo sample, monitor reference, paper text, results
    assets/                      fig1–4, paper.pdf, paper.tex
    server/                      optional FastAPI Edge API  (+ edge_engine.py)
    agent/live_agent.py          optional scapy packet-capture agent
    tools/                       data build + validation scripts
    data-src/                    (on your Mac) demo_sample.csv, *_quantiles.csv
