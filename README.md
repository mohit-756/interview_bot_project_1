# AI Interview Platform

An AI-driven interview platform with:
- FastAPI backend (API-only, session-based auth)
- React + Vite frontend
- Resume/JD matching
- Timed interview sessions with webcam proctoring

## Current Architecture

This project is now split into:

1. Backend (`main.py`, `routes/api_routes.py`)
- Serves JSON APIs under `/api/*`
- Handles authentication, candidate workflow, HR workflow, and interview flow
- Stores data in SQLite by default (`app.db`)

2. Frontend (`interview-frontend/`)
- React app served by Vite
- Uses Vite proxy to call backend APIs
- Includes candidate dashboard, HR dashboard, and interview flow (`/interview/:resultId`)

## Key Features

- Candidate and HR signup/login
- Candidate can:
  - Select company/JD
  - Upload resume for selected JD
  - View score and explanation
  - Schedule interview and receive interview link
- HR can:
  - Upload multiple JDs
  - Give custom JD title
  - Review and update skill weights per selected JD
  - Configure per-JD shortlist cutoff score
  - Configure per-JD interview question count
  - View shortlisted candidates
- Resume scoring is local, deterministic, and includes an explainable score breakdown
- Interview question bank generation:
  - Built automatically per application from resume + JD
  - 80% project/deep-dive style prompts
  - 20% self-introduction + theory prompts
  - Project question distribution follows HR-defined JD skill weights
- Interview flow:
  - Candidate-authenticated pre-check and timed live interview
  - Per-question timer with auto-skip on timeout
  - Webcam-based proctoring with baseline and periodic/suspicious captures
  - HR review of answers and proctoring timeline

## Environment Variables

Create `.env` in project root:

```env
DATABASE_URL=sqlite:///./app.db
SECRET_KEY=replace_with_a_long_random_secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Whisper STT (live transcription) configuration:
WHISPER_MODEL_SIZE=small
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=int8
WHISPER_BEAM_SIZE=1
WHISPER_VAD_FILTER=true
# Optional: local path to a pre-downloaded faster-whisper model directory.
# If set, this overrides WHISPER_MODEL_SIZE.
WHISPER_MODEL_PATH=
# Optional: set true to ignore HTTP(S)_PROXY env vars during model load.
WHISPER_IGNORE_PROXY=false

# Required for interview email sending:
EMAIL_ADDRESS=
EMAIL_PASSWORD=

# Optional frontend URL used in interview links sent by email:
FRONTEND_URL=http://localhost:5173
```

Notes:
- For Gmail, `EMAIL_PASSWORD` must be an App Password (not your normal account password).
- The default local Whisper model is `small` for better CPU performance.
- Use `medium` on stronger machines; treat `large-v3` as an opt-in quality upgrade.
- First transcription call downloads the selected Whisper model, so startup can be slow.
- If download fails due proxy/network, set `WHISPER_MODEL_PATH` to a local model folder.

## Installation

### 1. Backend

```powershell
cd C:\Users\mohit\Documents\interview_bot_project
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. Frontend

```powershell
cd C:\Users\mohit\Documents\interview_bot_project\interview-frontend
npm install
```

## Run Locally

Open two terminals.

### Terminal A: Backend

```powershell
cd C:\Users\mohit\Documents\interview_bot_project
.\venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Health check:

```text
http://127.0.0.1:8000/health
```

### Terminal B: Frontend

```powershell
cd C:\Users\mohit\Documents\interview_bot_project\interview-frontend
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

## API Overview

Main router: `routes/api_routes.py`

Auth:
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Candidate:
- `GET /api/candidate/dashboard`
- `POST /api/candidate/upload-resume`
- `POST /api/candidate/select-interview-date`

HR:
- `GET /api/hr/dashboard`
- `GET /api/hr/jobs`
- `POST /api/hr/upload-jd`
- `POST /api/hr/confirm-jd`
- `POST /api/hr/update-skill-weights` (also updates JD cutoff/question count)

Interview:
- `POST /api/interview/start`
- `POST /api/interview/answer`
- `POST /api/proctor/frame`
- `GET /api/hr/proctoring/{session_id}`

## Project Structure

```text
interview_bot_project/
|-- ai_engine/
|   |-- phase1/
|   |   |-- matching.py
|   |   `-- scoring.py
|   |-- phase2/
|   |   `-- question_builder.py
|   `-- phase3/
|       `-- question_flow.py
|-- docs/
|   `-- PHASE_MAP.md
|-- interview-frontend/
|   `-- src/
|-- routes/
|   |-- api_routes.py
|   |-- auth/
|   |   `-- sessions.py
|   |-- candidate/
|   |   `-- workflow.py
|   |-- hr/
|   |   |-- management.py
|   |   `-- interview_review.py
|   `-- interview/
|       `-- runtime.py
|-- tests/
|-- utils/
|-- auth.py
|-- database.py
|-- main.py
|-- models.py
`-- requirements.txt
```

Phase-wise explanation map: `docs/PHASE_MAP.md`.

## Troubleshooting

1. `ECONNREFUSED 127.0.0.1:8000` in Vite logs
- Backend is not running or crashed.
- Restart backend and verify `http://127.0.0.1:8000/health`.

2. Interview page shows request failures
- Ensure backend is running.
- Login as candidate and open the interview link from dashboard.

3. No interview email received
- Check `EMAIL_ADDRESS` and `EMAIL_PASSWORD` in `.env`.
- Verify Gmail App Password usage.
- Check spam/promotions folder.

## Notes

- Backend includes a lightweight schema backfill at startup for `jobs.jd_title` if missing.
- Session cookies are required for authenticated APIs.
- Uploaded files are saved under `uploads/`.
