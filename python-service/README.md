# ConstructAI — Compliance ML Service

Lightweight FastAPI micro-service that serves the trained `compliance_model.pkl`
classifier for Authority officers.

## Setup

```bash
cd python-service
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

Ensure the model file exists at `model/compliance_model.pkl` (copied from
`backend/app/models/compliance_model.pkl` by default).

## Run

```bash
uvicorn main:app --reload --port 8002
```

## API

### `POST /api/predict-compliance`

```json
{ "inspection_text": "Setbacks verified. Road width 11ft — below 12ft minimum." }
```

Response:

```json
{
  "label": "Minor Violation",
  "confidence": 0.87,
  "probabilities": {
    "Compliant": 0.04,
    "Pending Approval": 0.09,
    "Minor Violation": 0.87,
    "High Risk Violation": 0.00
  }
}
```

### `GET /health`

Readiness probe.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `COMPLIANCE_MODEL_PATH` | `model/compliance_model.pkl` | Path to the trained model |
| `PORT` | `8002` | HTTP port |

The Next.js frontend proxies requests through `/api/predict-compliance` so the
service URL stays server-side (`COMPLIANCE_SERVICE_URL`).
