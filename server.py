import os
import json
import re
import requests as http_requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin
from flask import Flask, send_from_directory, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, 'public')

LOG_FILE = os.path.join(BASE_DIR, 'app.log')


def _as_text(value):
    """Coerce a request field to plain text (guards against odd client shapes)."""
    if isinstance(value, str):
        return value
    if isinstance(value, dict) and isinstance(value.get('value'), str):
        return value.get('value')
    if value is None:
        return ''
    return str(value)


def log_line(msg):
    try:
        with open(LOG_FILE, 'a', encoding='utf-8') as f:
            f.write(f"{datetime.now().isoformat(timespec='seconds')} {msg}\n")
    except Exception:
        pass

app = Flask(__name__, static_folder=PUBLIC_DIR, static_url_path='')
CORS(app)

# Force no debug reloader under WSGI
if 'PA_WSGI' in os.environ:
    app.debug = False
else:
    app.debug = (os.getenv('FLASK_DEBUG', '') == '1')

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', 'demo-mode')
PORT = int(os.getenv('PORT', 3000))


def is_demo_mode():
    return not OPENAI_API_KEY or OPENAI_API_KEY == 'demo-mode'


def get_ai_client_and_model():
    import openai

    if OPENAI_API_KEY.startswith('gsk_'):
        client = openai.OpenAI(
            api_key=OPENAI_API_KEY,
            base_url='https://api.groq.com/openai/v1'
        )
        model = os.getenv('GROQ_MODEL', 'openai/gpt-oss-120b')
        provider = 'groq'
    else:
        client = openai.OpenAI(api_key=OPENAI_API_KEY)
        model = os.getenv('OPENAI_MODEL', 'gpt-4o')
        provider = 'openai'

    return client, model, provider

from consumer_rights import consumer_rights

ANALYST_SYSTEM = """You are Fineprint's senior legal analyst. You advise ordinary consumers, not lawyers. You are precise, evidence-driven, and honest about uncertainty.

HARD RULES
1. Ground every claim in the document text. For each risk you flag, quote the exact clause (40 words or fewer). If a point is your interpretation rather than explicit text, label it "Interpretation:".
2. NEVER invent clause text, section numbers, statute names, case law, or regulator URLs. If you are unsure a law applies, write "may be relevant - verify" instead of citing it as fact.
3. Laws: cite only real, well-established statutes. Safe references include: India's Consumer Protection Act 2019 and DPDP Act 2023; the US FTC Act Section 5, Fair Credit Billing Act, and CCPA/CPRA; the EU's GDPR, Unfair Contract Terms Directive 93/13/EEC, and Consumer Rights Directive 2011/83/EU; the UK's Consumer Rights Act 2015. If the document names a governing law or jurisdiction, apply that country's law first; otherwise note briefly which parts depend on jurisdiction.
4. Calibrate severity: HIGH means the clause can cost the user significant money, data, or legal rights. MEDIUM means unfavorable but common or avoidable. LOW means minor or easily mitigated. Do not inflate.
5. If the input is not terms/privacy text (gibberish, a lone question, marketing copy), say so plainly in one short paragraph and ask for the document instead of fabricating an audit.
6. The text may be truncated. If a key section (termination, refunds, liability, privacy, dispute resolution) is missing from what you received, name the sections you could not assess.
7. Rank risks by severity, most severe first. Flag at most 8 - do not pad the list to look thorough.
8. Your closing VERDICT label must match the automated-screen label given in the user message (it is computed from the same document). Justify it from the evidence you found; if you believe it is off by one step, say so in "Should you accept?" but keep the required label on the VERDICT line.

VERIFIED REGULATOR REFERENCES (use these exact names, do not invent others):
- US federal: FTC, complaint at reportfraud.ftc.gov; card billing disputes under the Fair Credit Billing Act (60-day window).
- California: Attorney General, complaint at oag.ca.gov/consumer.
- India: National Consumer Helpline 1915, e-Daakhil portal; data matters: Data Protection Board of India.
- EU: ECC-Net (European Consumer Centres Network) and the national data-protection authority of the user's country.
- UK: Citizens Advice and the Competition and Markets Authority (CMA).

OUTPUT FORMAT (markdown, exactly these sections, in this order):

## Bottom line
2-3 sentences: what this document is, who it favors, and the single most important thing to know.

## Key risks
Numbered list. Each item has:
- A bold title with a severity tag [HIGH], [MEDIUM], or [LOW]
- "Clause:" the exact quote (40 words or fewer)
- "Why it matters:" 1-2 sentences of plain-language consequence
- "Law check:" the right or statute it implicates, or "No clear violation - but unfavorable"
- "What you can do:" one concrete action

## Rights check
For each flagged risk, one line mapping it to the consumer right and statute. Mark each as "Likely violation" or "Unfavorable but likely enforceable".

## What could go wrong later
Up to 4 realistic future scenarios. Each: trigger, impact, and one preventive step.

## If things go wrong
Concrete steps in order: preserve evidence, contact the company, payment/chargeback options, regulator complaint (name the actual body - e.g. US: FTC at reportfraud.ftc.gov or the state attorney general; India: National Consumer Helpline 1915 or e-Daakhil; EU: the national consumer centre or ECC-Net), then legal help. Include realistic timeframes.

## Should you accept?
One of: Accept / Accept with changes / Walk away - with the 1-2 deal-breaker clauses named.

End the report with this line on its own:
VERDICT: <Generally Safe | Caution Advised | Significant Risks | Unacceptable>
followed by one sentence justifying it.

*General information only - not legal advice. For significant money or rights at stake, consult a qualified lawyer in your jurisdiction.*"""


CHAT_SYSTEM = """You are Fineprint's consumer-rights assistant, chatting with an ordinary consumer. Be warm, direct, and precise. Use markdown.

HARD RULES
1. When a document was provided, answer FROM it: quote the relevant clause briefly (40 words or fewer), then explain what it means in plain language.
2. If the document does not cover the question, say so explicitly, then give a general answer based only on real statutes (India's Consumer Protection Act 2019 / DPDP Act 2023; US FTC Act Section 5 / FCBA / CCPA; EU GDPR / UCTD 93/13/EEC / CRD 2011/83/EU; UK Consumer Rights Act 2015). NEVER invent laws, cases, or clause text.
3. Distinguish document fact from your interpretation. If you are unsure, say so and say how the user could verify.
4. Keep answers focused: under 250 words unless the user asks for detail. No JSON, no full audit report in chat - that belongs to the audit view.
5. End with one concrete next step or a single sharp follow-up question.
6. This is general information, not legal advice.

VERIFIED REGULATOR REFERENCES (use these exact names, do not invent others):
- US federal: FTC, complaint at reportfraud.ftc.gov.
- California: Attorney General, complaint at oag.ca.gov/consumer.
- India: National Consumer Helpline 1915, e-Daakhil portal; data matters: Data Protection Board of India.
- EU: ECC-Net and the national data-protection authority of the user's country.
- UK: Citizens Advice and the Competition and Markets Authority (CMA); data matters: Information Commissioner's Office (ICO)."""


# Backwards-compatible alias used by older code paths.
SYSTEM_PROMPT = ANALYST_SYSTEM


@app.after_request
def no_cache_html(response):
    try:
        if response.content_type and 'text/html' in response.content_type:
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
    except Exception:
        pass
    return response


@app.route('/')
def index():
    return _send_static('index.html')


@app.route('/chat')
def chat_page():
    return _send_static('index.html')


def _send_static(name):
    target = os.path.join(PUBLIC_DIR, name)
    if os.path.exists(target):
        return send_from_directory(PUBLIC_DIR, name)
    return send_from_directory('public', name)


@app.route('/<path:path>')
def static_files(path):
    target = os.path.join(PUBLIC_DIR, path)
    if os.path.exists(target):
        return send_from_directory(PUBLIC_DIR, path)
    return send_from_directory('public', path)


@app.route('/api/rights', methods=['GET'])
def get_rights():
    return jsonify(consumer_rights)


@app.route('/api/fetch-url', methods=['POST'])
def fetch_url():
    try:
        data = request.get_json()
        url = data.get('url', '').strip()

        if not url:
            return jsonify({'error': 'URL is required.'}), 400

        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }

        response = http_requests.get(url, headers=headers, timeout=15, allow_redirects=True)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')

        for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'aside', 'iframe', 'noscript']):
            tag.decompose()

        selectors = [
            '[class*="terms"]', '[class*="terms-and-conditions"]',
            '[class*="legal"]', '[class*="privacy"]', '[class*="policy"]',
            '[id*="terms"]', '[id*="legal"]', '[id*="privacy"]', '[id*="policy"]',
            'main', 'article', '.content', '#content', '.main-content',
            'body'
        ]

        terms_text = ''
        for selector in selectors:
            elements = soup.select(selector)
            for el in elements:
                text = el.get_text(separator='\n', strip=True)
                if len(text) > len(terms_text):
                    terms_text = text

        lines = terms_text.split('\n')
        cleaned_lines = [line.strip() for line in lines if line.strip()]
        terms_text = '\n'.join(cleaned_lines)

        if len(terms_text) < 50:
            return jsonify({
                'error': 'Could not extract meaningful content from this URL. The page may require JavaScript or have restricted access.',
                'url': url,
                'title': soup.title.string if soup.title else url
            }), 422

        title = soup.title.string.strip() if soup.title else urlparse(url).path

        return jsonify({
            'terms': terms_text,
            'url': url,
            'title': title,
            'length': len(terms_text)
        })

    except http_requests.exceptions.Timeout:
        return jsonify({'error': 'Request timed out. The website took too long to respond.'}), 408
    except http_requests.exceptions.ConnectionError:
        return jsonify({'error': 'Could not connect to the website. Please check the URL.'}), 502
    except http_requests.exceptions.HTTPError as e:
        return jsonify({'error': f'Website returned an error: {e.response.status_code}'}), 502
    except Exception as e:
        print(f'URL fetch error: {e}')
        return jsonify({'error': 'Failed to fetch the URL. Please try again.'}), 500


def calculate_risk_score(terms):
    score = 0
    terms_lower = terms.lower()
    breakdown = {}

    high_risk_hits = 0
    medium_risk_hits = 0
    low_risk_hits = 0

    for clause in consumer_rights['risky_clauses']:
        hits = [kw for kw in clause['keywords'] if kw in terms_lower]
        if hits:
            # Cap per-clause-type contribution so one repeated phrase
            # cannot single-handedly max out the score.
            if clause['risk_level'] == 'high':
                high_risk_hits += len(hits)
                score += min(24, 12 * len(hits))
            elif clause['risk_level'] == 'medium':
                medium_risk_hits += len(hits)
                score += min(14, 7 * len(hits))
            else:
                low_risk_hits += len(hits)
                score += min(6, 3 * len(hits))

    future_risk_count = 0
    for frisk in consumer_rights['future_risks']:
        if any(ws in terms_lower for ws in frisk['warning_signs']):
            future_risk_count += 1
            score += 5

    total_keywords = len(terms_lower.split())
    if total_keywords > 5000:
        score += 5
    if total_keywords > 10000:
        score += 5

    if 'class action waiver' in terms_lower or 'waive right to sue' in terms_lower:
        score += 15
    if 'arbitration' in terms_lower and 'mandatory' in terms_lower:
        score += 12
    if 'non-refundable' in terms_lower or 'no refund' in terms_lower:
        score += 10
    if 'without notice' in terms_lower and ('change' in terms_lower or 'modify' in terms_lower):
        score += 10
    if 'indemnify' in terms_lower or 'hold harmless' in terms_lower:
        score += 10
    if 'sell data' in terms_lower or 'share with third' in terms_lower:
        score += 8
    if 'unlimited liability' in terms_lower or 'sole responsibility' in terms_lower:
        score += 12

    score = min(score, 100)

    if score <= 20:
        level = 'low'
        verdict = 'Generally Safe'
        verdict_color = 'success'
        recommendation = 'These terms appear relatively fair. Minor risks exist but are within normal bounds.'
    elif score <= 45:
        level = 'medium'
        verdict = 'Caution Advised'
        verdict_color = 'warning'
        recommendation = 'Several clauses may not be in your best interest. Review carefully before accepting.'
    elif score <= 70:
        level = 'high'
        verdict = 'Significant Risks'
        verdict_color = 'danger'
        recommendation = 'Multiple risky clauses detected. Consider negotiating terms or seeking alternatives.'
    else:
        level = 'critical'
        verdict = 'Unacceptable'
        verdict_color = 'critical'
        recommendation = 'These terms contain serious risks to your rights. Strongly consider rejecting or seeking legal advice.'

    breakdown = {
        'high_risk_clauses': high_risk_hits,
        'medium_risk_clauses': medium_risk_hits,
        'future_risks': future_risk_count,
        'total_text_length': len(terms),
        'word_count': total_keywords
    }

    return {
        'score': score,
        'level': level,
        'verdict': verdict,
        'verdict_color': verdict_color,
        'recommendation': recommendation,
        'breakdown': breakdown
    }


@app.route('/api/analyze', methods=['POST'])
def analyze():
    try:
        data = request.get_json()
        terms = _as_text((data.get('terms', '') if isinstance(data, dict) else ''))[:60000]
        question = _as_text(data.get('question', '') if isinstance(data, dict) else '')

        if not terms and not question:
            return jsonify({'error': 'Please provide terms and conditions text or a question.'}), 400

        if not is_demo_mode():
            client, model, provider = get_ai_client_and_model()

            risk_data = calculate_risk_score(terms) if terms else None
            screen_note = ''
            if risk_data:
                screen_note = (
                    f"\n\nAUTOMATED SCREEN (keyword-based, computed from this same document): "
                    f"score {risk_data['score']}/100, label \"{risk_data['verdict']}\". "
                    f"Your closing VERDICT label must match this label."
                )

            if terms and question:
                user_message = f'Analyze the following Terms & Conditions and answer this question: "{question}"\n\n--- TERMS & CONDITIONS ---\n{terms}{screen_note}'
            elif terms:
                user_message = f'Perform a comprehensive analysis of the following Terms & Conditions:\n\n--- TERMS & CONDITIONS ---\n{terms}{screen_note}'
            else:
                user_message = question

            completion = client.chat.completions.create(
                model=model,
                messages=[
                    {'role': 'system', 'content': ANALYST_SYSTEM},
                    {'role': 'user', 'content': user_message}
                ],
                temperature=0.3,
                max_tokens=6000
            )
            content = completion.choices[0].message.content or ''
            if not content.strip():
                log_line('[analyze] EMPTY model content received')
                return jsonify({'error': 'The AI engine returned an empty response. Please try again.'}), 502

            disclaimer = '\n\n*General information only - not legal advice. For significant money or rights at stake, consult a qualified lawyer in your jurisdiction.*'
            if 'not legal advice' not in content:
                content = content.rstrip() + '\n' + disclaimer

            print(f"[analyze] terms_len={len(terms)} mode={provider} risk_returned={risk_data is not None} risk_score={risk_data.get('score') if risk_data else None}"); log_line(f"[analyze] path=/api/analyze terms_len={len(terms)} mode={provider} risk_returned={risk_data is not None} risk_score={risk_data.get('score') if risk_data else None}")
            return jsonify({'response': content, 'mode': provider, 'risk': risk_data})
        else:
            result = analyze_terms_demo(terms, question)
            risk_data = calculate_risk_score(terms) if terms else None
            print(f"[analyze] DEMO terms_len={len(terms)} risk_returned={risk_data is not None} risk_score={risk_data.get('score') if risk_data else None}")
            return jsonify({'response': result, 'mode': 'demo', 'risk': risk_data})

    except Exception as e:
        import traceback as _tb
        print(f'Analysis error: {e}'); log_line(f'[analyze] ERROR {type(e).__name__}: {e} | {_tb.format_exc(limit=6)}')
        return jsonify({'error': 'Analysis failed. Please try again.'}), 500


@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        message = _as_text(data.get('message', '') if isinstance(data, dict) else '')
        history = data.get('history', []) if isinstance(data, dict) else []
        if not isinstance(history, list):
            history = []
        terms_context = _as_text(data.get('termsContext', '') if isinstance(data, dict) else '')[:12000]

        if not message:
            return jsonify({'error': 'Message is required.'}), 400

        if not is_demo_mode():
            client, model, provider = get_ai_client_and_model()

            system_msg = CHAT_SYSTEM
            if terms_context:
                system_msg += f'\n\nThe user has previously provided these Terms & Conditions for analysis:\n---\n{terms_context}\n---'

            messages = [{'role': 'system', 'content': system_msg}]

            for msg in history[-10:]:
                if not isinstance(msg, dict):
                    continue
                _role = msg.get('role', 'user')
                messages.append({
                    'role': _role if _role in ('user', 'assistant', 'system') else 'user',
                    'content': _as_text(msg.get('content', ''))
                })

            messages.append({'role': 'user', 'content': message})

            completion = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.3,
                max_tokens=3000
            )
            content = completion.choices[0].message.content
            print(f"[chat] message_len={len(message)} terms_ctx={len(terms_context)} mode={provider}"); log_line(f"[chat] path=/api/chat message_len={len(message)} terms_ctx={len(terms_context)} mode={provider}")
            return jsonify({'response': content, 'mode': provider})
        else:
            result = chat_demo(message, terms_context)
            print(f"[chat] DEMO message_len={len(message)} terms_ctx={len(terms_context)}")
            return jsonify({'response': result, 'mode': 'demo'})

    except Exception as e:
        print(f'Chat error: {e}'); log_line(f'[chat] ERROR {type(e).__name__}: {e}')
        return jsonify({'error': 'Chat failed. Please try again.'}), 500


def analyze_terms_demo(terms, question):
    if not terms:
        return generate_demo_overview(question)

    terms_lower = terms.lower()
    found_risks = []
    for clause in consumer_rights['risky_clauses']:
        if any(kw in terms_lower for kw in clause['keywords']):
            found_risks.append(clause)

    found_future_risks = []
    for frisk in consumer_rights['future_risks']:
        if any(ws in terms_lower for ws in frisk['warning_signs']):
            found_future_risks.append(frisk)

    result = f"## Terms & Conditions Analysis Report\n\n"
    result += f"**Mode:** Demo analysis (keyword-based)\n"
    result += f"**Text length:** {len(terms)} characters\n\n"

    if found_risks:
        result += f"### Detected risks ({len(found_risks)} found)\n\n"
        for i, risk in enumerate(found_risks):
            tag = 'HIGH' if risk['risk_level'] == 'high' else 'MEDIUM' if risk['risk_level'] == 'medium' else 'LOW'
            result += f"**{i + 1}. {risk['type']}** (risk level: {tag})\n"
            result += f"> {risk['description']}\n\n"
    else:
        result += "### No common risky clauses detected\n\n"
        result += "This doesn't mean the terms are safe. A full AI analysis is recommended.\n\n"

    if found_future_risks:
        result += "### Potential future risks\n\n"
        for i, frisk in enumerate(found_future_risks):
            result += f"**{i + 1}. {frisk['type']}**\n"
            result += f"> {frisk['description']}\n\n"

    result += "### Consumer rights reference\n\n"
    for right in consumer_rights['fundamental_rights'][:4]:
        result += f"**{right['name']}:** {right['description']}\n\n"

    if question:
        result += f"\n### Your question\n\n"
        result += f"**Q:** {question}\n\n"
        result += "For a detailed answer, connect an AI engine key.\n"

    result += "\n---\n*This is a demo analysis based on keyword matching. For comprehensive AI-powered analysis, add an AI engine key.*"
    return result


def generate_demo_overview(question):
    result = "## Welcome to Fineprint\n\n"
    result += "The analyst is currently running in **demo mode** (no AI engine key configured).\n\n"
    result += "To get full AI-powered analysis, add an AI engine key to the `.env` file:\n"
    result += "```\nOPENAI_API_KEY=gsk-your-groq-key-here\n```\n\n"
    result += "### Consumer rights overview\n\n"

    for right in consumer_rights['fundamental_rights']:
        result += f"**{right['name']}**: {right['description']}\n\n"

    result += "### Common risky clauses to watch for:\n\n"
    for risk in consumer_rights['risky_clauses']:
        result += f"- **{risk['type']}** (risk: {risk['risk_level']}): {risk['description']}\n"

    if question:
        result += f"\n### Your question: {question}\n\n"
        result += "Connect an AI engine key for detailed answers.\n"

    result += "\n*Note: this is demo output. Connect an AI engine key for real AI analysis.*"
    return result


def chat_demo(message, terms_context):
    msg_lower = message.lower()

    if 'arbitration' in msg_lower:
        return """## About arbitration clauses

**Arbitration clauses** are common in T&C agreements and can significantly limit your legal rights.

### What you should know
- Mandatory arbitration prevents you from going to court
- Class action waivers prevent you from joining group lawsuits
- Arbitration decisions are usually final with limited appeal options

### Your rights
- Some jurisdictions allow you to opt out of arbitration within 30 days
- The FTC has been cracking down on unfair arbitration clauses
- Certain consumer protection laws override arbitration agreements

### Recommended actions
1. Look for opt-out provisions in the agreement
2. Send a written opt-out notice if available
3. Document everything in case of disputes
4. Consult a consumer rights attorney for significant issues

*For specific advice about your situation, connect an AI engine key.*"""

    if 'privacy' in msg_lower or 'data' in msg_lower:
        return """## Privacy and data protection

### Your privacy rights
- **Right to privacy**: protection of personal data and privacy rights
  - Laws: GDPR (EU), CCPA (California), DPDP Act (India), IT Act (India)

### What to watch for
- **Data collection**: excessive collection beyond what is necessary
- **Data retention**: indefinite or excessive retention of personal data

### Recommended actions
1. Review what personal data is being collected
2. Check if data is shared with third parties
3. Exercise your right to data deletion (GDPR / CCPA)
4. Use privacy-focused alternatives when possible

*For comprehensive privacy analysis, connect an AI engine key.*"""

    if 'refund' in msg_lower or 'return' in msg_lower:
        return """## Refund and return rights

### Key consumer rights
- **Right to redressal**: consumers may seek compensation for unfair practices
- **Cooling-off period**: many jurisdictions allow cancellation within 14-30 days
- **Product liability**: sellers are responsible for defective products

### Common problematic clauses
- **No-refund policy**: strict no-refund policies that may violate consumer protection laws

### Your legal options
1. Check local consumer protection laws for mandatory return periods
2. Document defects with photos and receipts
3. File complaints with consumer protection agencies
4. Consider small claims court for significant amounts

*For specific advice, connect an AI engine key.*"""

    if 'help' in msg_lower or 'how' in msg_lower:
        return """## How to use Fineprint

### Getting started
1. **Add a document** — paste it, fetch it from a URL, or attach a file
2. Click **Run the audit** for a full risk assessment
3. **Ask questions** about specific clauses or concerns

### What the analyst checks
- Risk detection — harmful clauses like auto-renewal and forced arbitration
- Future-risk projection — price hikes, silent policy changes
- Consumer-rights comparison — GDPR, CCPA, FTC Act and more
- Legal steps — what to do if a clause actually bites

### Tips
- Submit the full document for the most accurate score
- Be specific: "Is this arbitration clause fair?" beats "help me"
- Terms, privacy policies, and end-user agreements all work

### Example questions
- "What data does this company collect?"
- "Can I get a refund after cancellation?"
- "Is this auto-renewal clause legal?"
- "What are my rights if they change the terms?" """

    return f"""## Thank you for your question

**Your message:** "{message}"

### Demo-mode response

The analyst is running in demo mode with keyword-based answers. Here is the nearest match:

**Consumer rights that may be relevant:**
- **Right to information**: be informed about quality, quantity, and pricing of goods and services.
- **Right to choose**: access to a variety of goods and services at competitive prices.
- **Right to safety**: protection against hazardous goods and unsafe services.

**Common T&C risks:**
- **Unlimited liability** (high): terms that expose consumers to unlimited financial liability.
- **Arbitration clause** (medium): mandatory arbitration that waives the right to a jury trial.
- **Unilateral modification** (high): terms that allow the company to change the agreement without notice.

{f'**Note:** I have the terms you provided earlier. For detailed analysis, connect an AI engine key.' if terms_context else ''}

---
*For full AI-powered analysis, add an AI engine key to the .env file.*"""


if __name__ == '__main__':
    print(f"\nT&C Risk Analyzer running at http://localhost:{PORT}")
    print(f"Chat at http://localhost:{PORT}/chat")
    if is_demo_mode():
        print(f"\nRunning in DEMO mode. Add OPENAI_API_KEY to .env for full AI analysis.\n")
    else:
        _, model, provider = get_ai_client_and_model()
        print(f"\n{provider.upper()} API key detected. AI analysis enabled (model: {model}).\n")

    app.run(host='0.0.0.0', port=PORT, debug=app.debug)
