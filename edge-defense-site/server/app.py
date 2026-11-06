"""Edge Defense Lab — optional Edge API (FastAPI).

Serves the static site from the project root and exposes the paper's three XGBoost models, TreeSHAP, the
SHAP-attribution PSI drift monitor and the Square-style attack, so a capture agent can stream real flows into
the same web UI.

  uvicorn server.app:app --port 8000

Environment (all optional):
  EDGE_API_KEY       if set, /api/ingest requires the header  x-api-key: <value>
  EDGE_DOMAIN        reference network for the rolling drift monitor: iot (default) | enterprise
  EDGE_WINDOW        rolling window size: 250 (default) | 500 | 1000
  EDGE_CORS_ORIGINS  comma-separated allowed origins (default: none — same-origin only)
"""
from __future__ import annotations
import asyncio, json, os, time
from collections import deque
from pathlib import Path
from typing import Any

import numpy as np
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

try:  # works both as `server.app` and as a plain script
    from . import edge_engine as ee
except ImportError:  # pragma: no cover
    import edge_engine as ee

ROOT = Path(__file__).resolve().parent.parent
ENGINE = ee.Engine(ROOT / 'data')
DOMAIN = os.environ.get('EDGE_DOMAIN', 'iot').lower()
WINDOW = int(os.environ.get('EDGE_WINDOW', '250'))
API_KEY = os.environ.get('EDGE_API_KEY')
MAX_FLOWS = 5000
THR = 0.5

app = FastAPI(title='Edge Defense Lab API', version='2.0')
_origins = [o.strip() for o in os.environ.get('EDGE_CORS_ORIGINS', '').split(',') if o.strip()]
if _origins:
    app.add_middleware(CORSMiddleware, allow_origins=_origins, allow_methods=['GET', 'POST'], allow_headers=['*'])

STATE = dict(ingested=0, window=deque(maxlen=WINDOW), alarms=0, last_psi=None, subscribers=set(), started=time.time())


class FlowsIn(BaseModel):
    flows: list[dict[str, Any]] = Field(..., min_length=1)


class OneFlow(BaseModel):
    flow: dict[str, Any]


class PredictIn(BaseModel):
    flow: dict[str, Any] | None = None
    flows: list[dict[str, Any]] | None = None
    explain: bool = False


class DriftIn(BaseModel):
    flows: list[dict[str, Any]] = Field(..., min_length=20)
    domain: str = 'iot'
    window: int = 250


class AttackIn(BaseModel):
    flow: dict[str, Any]
    eps: float = Field(0.1, gt=0, le=1)
    max_queries: int = Field(1000, ge=10, le=5000)
    seed: int = 0


def _verdicts(probs):
    return {k: ('attack' if p >= THR else 'benign') for k, p in probs.items()}


@app.get('/api/health')
def health():
    return dict(status='ok', models=list(ENGINE.models), domain=DOMAIN, window=WINDOW, flows_ingested=STATE['ingested'],
                uptime_s=round(time.time() - STATE['started'], 1), auth_required_for_ingest=bool(API_KEY))


@app.post('/api/predict')
async def predict(body: PredictIn):
    flows = body.flows or ([body.flow] if body.flow else [])
    if not flows or len(flows) > MAX_FLOWS:
        raise HTTPException(422, f'send 1..{MAX_FLOWS} flows')
    raw = [ee.flow_to_raw(f) for f in flows]
    probs = await run_in_threadpool(ENGINE.score, raw)
    out = dict(probabilities=probs, verdicts=[_verdicts({k: probs[k][i] for k in probs}) for i in range(len(raw))])
    if body.explain:
        shap = await run_in_threadpool(ENGINE.shap_c, raw[:50])
        out['shap_model_C'] = [dict(zip(ee.FEATURES, map(float, row))) for row in shap]
        out['expected_margin_C'] = ENGINE.models['C'].expected
    return out


@app.post('/api/predict-batch')
async def predict_batch(body: FlowsIn):
    if len(body.flows) > MAX_FLOWS:
        raise HTTPException(422, f'at most {MAX_FLOWS} flows per request')
    raw = [ee.flow_to_raw(f) for f in body.flows]
    probs = await run_in_threadpool(ENGINE.score, raw)
    flagged = {k: int(sum(p >= THR for p in v)) for k, v in probs.items()}
    return dict(n=len(raw), probabilities=probs, flagged=flagged)


@app.post('/api/drift')
async def drift(body: DriftIn):
    dom = body.domain.lower()
    if dom not in ENGINE.monitors or body.window not in ENGINE.monitors[dom]:
        raise HTTPException(422, 'domain must be enterprise|iot and window 250|500|1000')
    if len(body.flows) > MAX_FLOWS:
        raise HTTPException(422, f'at most {MAX_FLOWS} flows')
    mon = ENGINE.monitors[dom][body.window]
    shap = await run_in_threadpool(ENGINE.shap_c, [ee.flow_to_raw(f) for f in body.flows])
    psi, per = mon.psi(shap)
    return dict(psi=psi, threshold=mon.threshold, alarm=psi > mon.threshold, ratio=psi / mon.threshold, n=len(body.flows),
                window_calibrated_for=body.window, per_feature=dict(zip(ee.FEATURES, per)))


@app.post('/api/attack')
async def attack(body: AttackIn):
    res = await run_in_threadpool(ENGINE.square_attack, ee.flow_to_raw(body.flow), body.eps, body.max_queries, THR, body.seed)
    x = np.array(res['x_adv'], dtype=np.float32)
    res['probabilities_after'] = {k: float(m.proba(x)[0]) for k, m in ENGINE.models.items()}
    res['raw_after'] = dict(zip(ee.FEATURES, map(float, np.expm1(x[:ee.N_CONT]).tolist() + x[ee.N_CONT:].tolist())))
    return res


def _score_one(flow: dict):
    raw = ee.flow_to_raw(flow)
    X = ee.prep(raw)
    probs = {k: float(m.proba(X)[0]) for k, m in ENGINE.models.items()}
    shap = ENGINE.models['C'].shap(X)
    return raw, probs, shap


@app.post('/api/ingest')
async def ingest(body: OneFlow, x_api_key: str | None = Header(default=None)):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(401, 'bad or missing x-api-key')
    raw, probs, shap = await run_in_threadpool(_score_one, body.flow)
    STATE['ingested'] += 1
    STATE['window'].append(shap)
    psi = None
    if len(STATE['window']) == WINDOW and DOMAIN in ENGINE.monitors and WINDOW in ENGINE.monitors[DOMAIN]:
        mon = ENGINE.monitors[DOMAIN][WINDOW]
        v, per = mon.psi(list(STATE['window']))
        psi = dict(value=v, threshold=mon.threshold, alarm=v > mon.threshold, ratio=v / mon.threshold)
        STATE['last_psi'] = psi
        if psi['alarm']:
            STATE['alarms'] += 1
    flow = dict(zip(ee.FEATURES, raw))
    for k in ('is_attack', 'domain', 'attack_type', 'label'):
        if k in body.flow:
            flow[k] = body.flow[k]
    ev = dict(ts=time.time(), flow=flow, scores=probs, verdicts=_verdicts(probs), psi=psi)
    msg = 'data: ' + json.dumps(ev) + '\n\n'
    for q in list(STATE['subscribers']):
        try:
            q.put_nowait(msg)
        except asyncio.QueueFull:
            pass
    return dict(scores=probs, verdicts=ev['verdicts'], psi=psi, window_fill=len(STATE['window']))


@app.get('/api/state')
def state():
    return dict(ingested=STATE['ingested'], window_fill=len(STATE['window']), window=WINDOW, domain=DOMAIN, alarms=STATE['alarms'],
                last_psi=STATE['last_psi'], subscribers=len(STATE['subscribers']))


@app.get('/api/stream')
async def stream():
    q: asyncio.Queue = asyncio.Queue(maxsize=2000)
    STATE['subscribers'].add(q)

    async def gen():
        try:
            yield ': connected\n\n'
            while True:
                try:
                    yield await asyncio.wait_for(q.get(), timeout=15)
                except asyncio.TimeoutError:
                    yield ': keep-alive\n\n'
        finally:
            STATE['subscribers'].discard(q)

    return StreamingResponse(gen(), media_type='text/event-stream', headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'})


# The static site is mounted last so /api/* wins.
app.mount('/', StaticFiles(directory=str(ROOT), html=True), name='site')
