# T&C Risk Analyzer

AI-powered Terms & Conditions analyzer that detects risks, predicts future issues, compares with consumer rights, and provides legal guidance.

## Features

- **URL Fetching** - Paste any URL to auto-fetch and extract T&C
- **Risk Detection** - Identifies 12+ types of risky clauses
- **Risk Scoreboard** - Visual 0-100 risk score with Approve/Negotiate/Reject
- **Future Risk Prediction** - Warns about price increases, policy changes, etc.
- **Consumer Rights Comparison** - Checks against GDPR, CCPA, Consumer Protection Act
- **Legal Step Guidance** - Actionable steps for unfair terms, privacy violations, etc.
- **AI Chat Assistant** - Ask questions about any terms

## Tech Stack

- **Backend**: Python, Flask, BeautifulSoup4
- **Frontend**: HTML5, CSS3, JavaScript (vanilla)
- **AI**: OpenAI GPT-4o (optional, runs in demo mode without)

## Setup

### 1. Install Python 3.9+
Download from [python.org](https://python.org)

### 2. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/tc-risk-analyzer.git
cd tc-risk-analyzer
```

### 3. Install dependencies
```bash
pip install flask flask-cors python-dotenv requests beautifulsoup4 openai
```

### 4. Configure environment
Copy `.env.example` to `.env` and add your OpenAI API key (optional):
```bash
cp .env.example .env
```

Edit `.env`:
```
OPENAI_API_KEY=sk-your-key-here
PORT=3000
```

### 5. Run
```bash
python server.py
```

Open [http://localhost:3000](http://localhost:3000)

## Usage

1. **Paste a URL** in the sidebar URL field and click Fetch
2. Or **paste T&C text** directly, or **upload a .txt file**
3. Click **Analyze Terms** for risk assessment
4. View the **Risk Scoreboard** with score and verdict
5. **Approve, Negotiate, or Reject** the terms
6. **Ask questions** in the chat about specific clauses

## Project Structure

```
tc-risk-analyzer/
├── server.py              # Flask backend
├── consumer_rights.py     # Consumer rights database
├── .env.example           # Environment template
├── .gitignore
├── requirements.txt
└── public/
    ├── index.html         # Landing page
    ├── chat.html          # Chat interface
    ├── styles.css         # Styling
    └── app.js             # Frontend logic
```

## License

MIT
