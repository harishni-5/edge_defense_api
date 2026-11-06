# Edge Defense API

A single-model intrusion detection system for enterprise and IoT networks — companion code for the paper *"A Single Model for Enterprise and IoT Intrusion Detection: Cross-Domain Failure, Adversarial Robustness, and Edge Deployment"*.

Runs three XGBoost models (A = Enterprise, B = IoT, C = pooled) with TreeSHAP explanations, a drift monitor, and an evasion-attack sandbox. Served as a FastAPI backend and an interactive static site.

## Repo layout

    app/                    FastAPI backend (main.py, schemas.py)
    artifacts/              Model artifacts (xgboost json, feature stats, thresholds)
    models_v2/              Trained models (A/B/C) + drift threshold + benchmark results
    edge-defense-site/      Static companion site (hash-routed, no build step)
    figure_scripts/         Paper figure regeneration
    live_traffic/           Live-capture notebooks + results
    project understanding/  Project reports and presentations
    requirements.txt        Python deps for the API
    run.sh                  Local dev server (uvicorn --reload)
    render.yaml / railway.json   Deploy configs

## Run the API

```bash
pip install -r requirements.txt
bash run.sh          # http://localhost:8000
```

## Run the static site

```bash
cd edge-defense-site
python3 -m http.server 8080   # http://localhost:8080
```

See `edge-defense-site/README.md` for the site's own details (optional backend, packet agent, build scripts).

## Datasets (not in this repo)

The raw training datasets are too large for GitHub and are not included. They are public and can be re-downloaded:

- **CSE-CIC-IDS2018** — https://www.unb.ca/cic/datasets/ids-2018.html (place under `dataset/CSE-CIC-IDS2018/`)
- **CIC IoT 2023** — https://www.unb.ca/cic/datasets/iotdataset-2023.html (place under `dataset/archive 2/`)

The derived `.pcap.csv` feature files under `CSV/` are generated from these datasets.
