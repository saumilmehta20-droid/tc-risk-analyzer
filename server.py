import os
import json
import re
import requests as http_requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin
from flask import Flask, send_from_directory, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder='public')
CORS(app)

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', 'demo-mode')
PORT = int(os.getenv('PORT', 3000))

from consumer_rights import consumer_rights

SYSTEM_PROMPT = """You are an expert Terms & Conditions analyzer and consumer rights advisor. Your role is to:

1. ANALYZE the provided Terms & Conditions document thoroughly
2. DETECT RISKS - identify clauses that are risky or potentially harmful to consumers
3. PREDICT FUTURE RISKS - identify terms that could cause problems in the future
4. COMPARE WITH CONSUMER RIGHTS - evaluate which terms may violate consumer protection laws
5. PROVIDE LEGAL STEPS - recommend specific legal actions if problems arise

When analyzing, use this JSON structure for your response:
{
  "summary": "Brief overall assessment of the T&C (2-3 sentences)",
  "overall_risk_level": "low|medium|high|critical",
  "risk_score": 0-100,
  "detected_risks": [
    {
      "clause": "The problematic clause or section",
      "risk_level": "low|medium|high|critical",
      "explanation": "Why this is risky",
      "consumer_rights_violated": ["Right to ..."],
      "relevant_laws": ["Law name"],
      "suggestion": "What consumers should do"
    }
  ],
  "future_risks": [
    {
      "scenario": "What could happen in the future",
      "probability": "low|medium|high",
      "impact": "Description of impact",
      "prevention": "How to prevent or prepare"
    }
  ],
  "consumer_rights_violations": [
    {
      "right": "The consumer right being violated",
      "violation": "How it is being violated",
      "legal_reference": "Applicable law",
      "severity": "low|medium|high"
    }
  ],
  "legal_steps": [
    {
      "situation": "When to take this step",
      "action": "What to do",
      "timeframe": "When to do it",
      "resources": "Where to get help"
    }
  ],
  "recommendations": [
    "Overall recommendation 1",
    "Overall recommendation 2"
  ]
}

Be thorough, specific, and cite actual consumer protection laws. Use markdown formatting for readability. Always provide actionable advice."""


@app.route('/')
def index():
    return send_from_directory('public', 'index.html')


@app.route('/chat')
def chat_page():
    return send_from_directory('public', 'chat.html')


@app.route('/<path:path>')
def static_files(path):
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
            if clause['risk_level'] == 'high':
                high_risk_hits += len(hits)
                score += 12 * len(hits)
            elif clause['risk_level'] == 'medium':
                medium_risk_hits += len(hits)
                score += 7 * len(hits)
            else:
                low_risk_hits += len(hits)
                score += 3 * len(hits)

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
        terms = data.get('terms', '')
        question = data.get('question', '')

        if not terms and not question:
            return jsonify({'error': 'Please provide terms and conditions text or a question.'}), 400

        if OPENAI_API_KEY and OPENAI_API_KEY != 'demo-mode':
            import openai
            client = openai.OpenAI(api_key=OPENAI_API_KEY)

            if terms and question:
                user_message = f'Analyze the following Terms & Conditions and answer this question: "{question}"\n\n--- TERMS & CONDITIONS ---\n{terms}'
            elif terms:
                user_message = f'Perform a comprehensive analysis of the following Terms & Conditions:\n\n--- TERMS & CONDITIONS ---\n{terms}'
            else:
                user_message = question

            completion = client.chat.completions.create(
                model='gpt-4o',
                messages=[
                    {'role': 'system', 'content': SYSTEM_PROMPT},
                    {'role': 'user', 'content': user_message}
                ],
                temperature=0.3,
                max_tokens=4000
            )
            content = completion.choices[0].message.content

            risk_data = calculate_risk_score(terms) if terms else None
            return jsonify({'response': content, 'mode': 'ai', 'risk': risk_data})
        else:
            result = analyze_terms_demo(terms, question)
            risk_data = calculate_risk_score(terms) if terms else None
            return jsonify({'response': result, 'mode': 'demo', 'risk': risk_data})

    except Exception as e:
        print(f'Analysis error: {e}')
        return jsonify({'error': 'Analysis failed. Please try again.'}), 500


@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        message = data.get('message', '')
        history = data.get('history', [])
        terms_context = data.get('termsContext', '')

        if not message:
            return jsonify({'error': 'Message is required.'}), 400

        if OPENAI_API_KEY and OPENAI_API_KEY != 'demo-mode':
            import openai
            client = openai.OpenAI(api_key=OPENAI_API_KEY)

            system_msg = SYSTEM_PROMPT
            if terms_context:
                system_msg += f'\n\nThe user has previously provided these Terms & Conditions for analysis:\n---\n{terms_context}\n---'

            messages = [{'role': 'system', 'content': system_msg}]

            for msg in history[-10:]:
                messages.append({'role': msg['role'], 'content': msg['content']})

            messages.append({'role': 'user', 'content': message})

            completion = client.chat.completions.create(
                model='gpt-4o',
                messages=messages,
                temperature=0.3,
                max_tokens=2000
            )
            content = completion.choices[0].message.content
            return jsonify({'response': content, 'mode': 'ai'})
        else:
            result = chat_demo(message, terms_context)
            return jsonify({'response': result, 'mode': 'demo'})

    except Exception as e:
        print(f'Chat error: {e}')
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

    result = f"## 📋 Terms & Conditions Analysis Report\n\n"
    result += f"**Mode:** Demo Analysis (keyword-based)\n"
    result += f"**Text Length:** {len(terms)} characters\n\n"

    if found_risks:
        result += f"### ⚠️ Detected Risks ({len(found_risks)} found)\n\n"
        for i, risk in enumerate(found_risks):
            emoji = '🔴' if risk['risk_level'] == 'high' else '🟡' if risk['risk_level'] == 'medium' else '🟢'
            result += f"{emoji} **{i + 1}. {risk['type']}** (Risk Level: {risk['risk_level'].upper()})\n"
            result += f"> {risk['description']}\n\n"
    else:
        result += "### ✅ No Common Risky Clauses Detected\n\n"
        result += "This doesn't mean the terms are safe. A full AI analysis is recommended.\n\n"

    if found_future_risks:
        result += "### 🔮 Potential Future Risks\n\n"
        for i, frisk in enumerate(found_future_risks):
            result += f"**{i + 1}. {frisk['type']}**\n"
            result += f"> {frisk['description']}\n\n"

    result += "### 📚 Consumer Rights Reference\n\n"
    for right in consumer_rights['fundamental_rights'][:4]:
        result += f"**{right['name']}:** {right['description']}\n\n"

    if question:
        result += f"\n### ❓ Your Question\n\n"
        result += f"**Q:** {question}\n\n"
        result += "For a detailed answer, please configure an OpenAI API key.\n"

    result += "\n---\n*This is a demo analysis based on keyword matching. For comprehensive AI-powered analysis, add your OpenAI API key.*"
    return result


def generate_demo_overview(question):
    result = "## Welcome to T&C Risk Analyzer! 🛡️\n\n"
    result += "I'm currently running in **demo mode** (no OpenAI API key configured).\n\n"
    result += "To get full AI-powered analysis, add your OpenAI API key to the `.env` file:\n"
    result += "```\nOPENAI_API_KEY=sk-your-key-here\n```\n\n"
    result += "### Consumer Rights Overview\n\n"

    for right in consumer_rights['fundamental_rights']:
        result += f"**{right['name']}**: {right['description']}\n\n"

    result += "### Common Risky Clauses to Watch For:\n\n"
    for risk in consumer_rights['risky_clauses']:
        result += f"- **{risk['type']}** (Risk: {risk['risk_level']}): {risk['description']}\n"

    if question:
        result += f"\n### Your Question: {question}\n\n"
        result += "Configure an OpenAI API key for detailed answers.\n"

    result += "\n*Note: This is demo output. Connect an OpenAI API key for real AI analysis.*"
    return result


def chat_demo(message, terms_context):
    msg_lower = message.lower()

    if 'arbitration' in msg_lower:
        return """## ⚖️ About Arbitration Clauses

**Arbitration clauses** are common in T&C agreements and can significantly limit your legal rights.

### What you should know:
- Mandatory arbitration prevents you from going to court
- Class action waivers prevent you from joining group lawsuits
- Arbitration decisions are usually final with limited appeal options

### Your Rights:
- Some jurisdictions allow you to opt out of arbitration within 30 days
- The FTC has been cracking down on unfair arbitration clauses
- Certain consumer protection laws override arbitration agreements

### Recommended Actions:
1. Look for opt-out provisions in the agreement
2. Send a written opt-out notice if available
3. Document everything in case of disputes
4. Consult a consumer rights attorney for significant issues

*For specific advice about your situation, configure an OpenAI API key.*"""

    if 'privacy' in msg_lower or 'data' in msg_lower:
        return """## 🔒 Privacy & Data Protection

### Your Privacy Rights:
- **Right to Privacy**: Protection of personal data and privacy rights
  - Laws: GDPR (EU), CCPA (California), DPDP Act (India), IT Act (India)

### What to Watch For:
- **Data Collection**: Excessive data collection beyond what is necessary
- **Data Retention**: Indefinite or excessive retention of personal data

### Recommended Actions:
1. Review what personal data is being collected
2. Check if data is shared with third parties
3. Exercise your right to data deletion (GDPR/CCPA)
4. Use privacy-focused alternatives when possible

*For comprehensive privacy analysis, configure an OpenAI API key.*"""

    if 'refund' in msg_lower or 'return' in msg_lower:
        return """## 💰 Refund & Return Rights

### Key Consumer Rights:
- **Right to Redressal**: Consumers have the right to seek compensation for unfair practices
- **Cooling-off Period**: Many jurisdictions allow cancellation within 14-30 days
- **Product Liability**: Sellers are responsible for defective products

### Common Problematic Clauses:
- **No Refund Policy**: Strict no-refund policies that may violate consumer protection laws

### Your Legal Options:
1. Check local consumer protection laws for mandatory return periods
2. Document product defects with photos and receipts
3. File complaints with consumer protection agencies
4. Consider small claims court for significant amounts

*For specific advice, configure an OpenAI API key.*"""

    if 'help' in msg_lower or 'how' in msg_lower:
        return """## 🤖 How to Use T&C Risk Analyzer

### Getting Started:
1. **Paste Terms & Conditions** in the input area above
2. Click **Analyze** for a comprehensive risk assessment
3. **Ask questions** about specific clauses or concerns

### What I Analyze:
- 🔴 **Risk Detection** - Identifies harmful clauses
- 🔮 **Future Risk Prediction** - Warns about potential issues
- ⚖️ **Consumer Rights Comparison** - Checks for violations
- 📋 **Legal Steps** - Recommends actions if problems arise

### Tips:
- Paste the full T&C text for best results
- Ask specific questions like "Is this arbitration clause fair?"
- Upload T&C from any service: apps, websites, subscriptions

### Example Questions:
- "What data does this company collect?"
- "Can I get a refund?"
- "Is this auto-renewal clause legal?"
- "What are my rights if they change the terms?" """

    return f"""## 💬 Thank you for your question!

**Your message:** "{message}"

### Demo Mode Response:

I'm currently running in demo mode with keyword-based analysis. Here's what I can tell you:

**Consumer Rights that may be relevant:**
- **Right to Information**: Be informed about quality, quantity, and pricing of goods and services.
- **Right to Choose**: Access to a variety of goods and services at competitive prices.
- **Right to Safety**: Protection against hazardous goods and unsafe services.

**Common T&C Risks:**
- **Unlimited Liability** (high): Terms that expose consumers to unlimited financial liability.
- **Arbitration Clause** (medium): Mandatory arbitration that waives the right to a jury trial.
- **Unilateral Modification** (high): Terms that allow the company to change the agreement without notice.

{f'**Note:** I have the terms you previously provided. For detailed analysis, please configure an OpenAI API key.' if terms_context else ''}

---
*For full AI-powered analysis, add your OpenAI API key to the .env file.*"""


if __name__ == '__main__':
    print(f"\nT&C Risk Analyzer running at http://localhost:{PORT}")
    print(f"Chat at http://localhost:{PORT}/chat")
    if not OPENAI_API_KEY or OPENAI_API_KEY == 'demo-mode':
        print(f"\nRunning in DEMO mode. Add OPENAI_API_KEY to .env for full AI analysis.\n")
    else:
        print(f"\nOpenAI API key detected. Full AI analysis enabled.\n")

    app.run(host='0.0.0.0', port=PORT, debug=True)
