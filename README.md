# Fineprint — AI Terms & Privacy Analyst

Read the whole Terms & Conditions or Privacy Policy — pasted, from a URL, or from an uploaded file — and get a clause-by-clause risk audit, a 0–100 safety score, and a plain-language verdict (approve / negotiate / reject) powered by AI on Groq hardware.

## Features

- **Three ways to submit** — paste text, fetch any public URL, or attach a `.txt` / `.md` file (drag & drop)
- **Clause-by-clause risk audit** — 12+ high-risk patterns (auto-renewal, forced arbitration, liability caps, data resale, unilateral changes…)
- **Safety score** — animated 0–100 scoreboard with a verdict and Approve / Negotiate / Reject actions
- **Future-risk projection** — price hikes, silent policy swaps, service shutdowns
- **Consumer-law comparison** — GDPR, CCPA, FTC Act, India's Consumer Protection Act
- **AI chat assistant** — ask the document anything; answers cite clauses and laws and suggest actions
- **Groq-native** — runs on `gpt-oss-120b` via the Groq API (falls back to OpenAI or a built-in demo mode)

## Tech stack

- **Backend**: Python · Flask · BeautifulSoup4 · openai SDK (Groq-compatible)
- **Frontend**: React 18 · TypeScript · Vite · react-router · marked + DOMPurify
- **AI**: Groq (`openai/gpt-oss-120b`) — set `OPENAI_API_KEY` to your `gsk_...` key

## Setup

### 1. Python backend

```bash
pip install flask flask-cors python-dotenv requests beautifulsoup4 openai
```

Copy `.env.example` to `.env` and set your key. A Groq key (starts with `gsk_`) is auto-detected:

```
OPENAI_API_KEY=gsk_your-groq-key-here
GROQ_MODEL=openai/gpt-oss-120b
PORT=3000
```

### 2. React frontend

```bash
cd frontend
npm install
npm run build     # compiles the React app into ../public
cd ..
```

### 3. Run

```bash
python server.py
```

Open [http://localhost:3000](http://localhost:3000) (landing) and [http://localhost:3000/chat](http://localhost:3000/chat) (the analyzer).

### Development (hot reload)

```bash
cd frontend
npm run dev       # Vite on :5173, proxies /api to Flask on :3000
```

## Project structure

```
├── server.py              # Flask backend (analyze, chat, fetch-url, risk score)
├── consumer_rights.py     # Consumer rights / risk-clause database
├── wsgi.py                # PythonAnywhere WSGI entrypoint
├── .env / .env.example    # Config (keys never committed)
├── requirements.txt
└── frontend/              # React + TypeScript source (build outputs to ../public)
    ├── src/
    │   ├── components/    # LandingPage, ChatPage, Sidebar, Scoreboard, Navbar
    │   ├── api.ts         # API client
    │   ├── types.ts
    │   └── styles.css     # Editorial "legal dossier" design system
    └── index.html
```

## Deployment (PythonAnywhere)

`wsgi.py` exposes the Flask app for WSGI servers. Set `PA_WSGI=1` automatically via the WSGI file and serve the project root with a static mapping to `/public`.

> Fineprint provides information, not legal advice.