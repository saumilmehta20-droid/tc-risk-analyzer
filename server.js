require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
const consumerRights = require('./consumerRights');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const BASE_DIR = __dirname;
const PUBLIC_DIR = path.join(BASE_DIR, 'public');
const LOG_FILE = path.join(BASE_DIR, 'app.log');

function logLine(msg) {
  try {
    fs.appendFileSync(LOG_FILE, `${new Date().toISOString().slice(0, 19)} ${msg}\n`);
  } catch (e) { /* ignore */ }
}

function asText(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof value.value === 'string') return value.value;
  if (value == null) return '';
  return String(value);
}

function isDemoMode() {
  const key = process.env.OPENAI_API_KEY || '';
  return !key || key === 'demo-mode';
}

function getAiClientAndModel() {
  const key = process.env.OPENAI_API_KEY || '';
  if (key.startsWith('gsk_')) {
    const client = new OpenAI({ apiKey: key, baseURL: 'https://api.groq.com/openai/v1' });
    const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
    return { client, model, provider: 'groq' };
  }
  const client = new OpenAI({ apiKey: key });
  const model = process.env.OPENAI_MODEL || 'gpt-4o';
  return { client, model, provider: 'openai' };
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const ANALYST_SYSTEM = `You are Fineprint's senior legal analyst. You advise ordinary consumers, not lawyers. You are precise, evidence-driven, and honest about uncertainty.

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

*General information only - not legal advice. For significant money or rights at stake, consult a qualified lawyer in your jurisdiction.*`;

const CHAT_SYSTEM = `You are Fineprint's consumer-rights assistant, chatting with an ordinary consumer. Be warm, direct, and precise. Use markdown.

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
- UK: Citizens Advice and the Competition and Markets Authority (CMA); data matters: Information Commissioner's Office (ICO).`;

// Backwards-compatible alias
const SYSTEM_PROMPT = ANALYST_SYSTEM;

function calculateRiskScore(terms) {
  let score = 0;
  const termsLower = (terms || '').toLowerCase();

  let highHits = 0;
  let mediumHits = 0;

  for (const clause of consumerRights.risky_clauses) {
    const hits = (clause.keywords || []).filter((kw) => termsLower.includes(kw));
    if (hits.length) {
      if (clause.risk_level === 'high') {
        highHits += hits.length;
        score += Math.min(24, 12 * hits.length);
      } else if (clause.risk_level === 'medium') {
        mediumHits += hits.length;
        score += Math.min(14, 7 * hits.length);
      } else {
        score += Math.min(6, 3 * hits.length);
      }
    }
  }

  let futureCount = 0;
  for (const frisk of consumerRights.future_risks) {
    if ((frisk.warning_signs || []).some((ws) => termsLower.includes(ws))) {
      futureCount += 1;
      score += 5;
    }
  }

  const words = termsLower.split(/\s+/).filter(Boolean).length;
  if (words > 5000) score += 5;
  if (words > 10000) score += 5;

  if (termsLower.includes('class action waiver') || termsLower.includes('waive right to sue')) score += 15;
  if (termsLower.includes('arbitration') && termsLower.includes('mandatory')) score += 12;
  if (termsLower.includes('non-refundable') || termsLower.includes('no refund')) score += 10;
  if (termsLower.includes('without notice') && (termsLower.includes('change') || termsLower.includes('modify'))) score += 10;
  if (termsLower.includes('indemnify') || termsLower.includes('hold harmless')) score += 10;
  if (termsLower.includes('sell data') || termsLower.includes('share with third')) score += 8;
  if (termsLower.includes('unlimited liability') || termsLower.includes('sole responsibility')) score += 12;

  score = Math.min(score, 100);

  let level, verdict, verdictColor, recommendation;
  if (score <= 20) {
    level = 'low'; verdict = 'Generally Safe'; verdictColor = 'success';
    recommendation = 'These terms appear relatively fair. Minor risks exist but are within normal bounds.';
  } else if (score <= 45) {
    level = 'medium'; verdict = 'Caution Advised'; verdictColor = 'warning';
    recommendation = 'Several clauses may not be in your best interest. Review carefully before accepting.';
  } else if (score <= 70) {
    level = 'high'; verdict = 'Significant Risks'; verdictColor = 'danger';
    recommendation = 'Multiple risky clauses detected. Consider negotiating terms or seeking alternatives.';
  } else {
    level = 'critical'; verdict = 'Unacceptable'; verdictColor = 'critical';
    recommendation = 'These terms contain serious risks to your rights. Strongly consider rejecting or seeking legal advice.';
  }

  return {
    score,
    level,
    verdict,
    verdict_color: verdictColor,
    recommendation,
    breakdown: {
      high_risk_clauses: highHits,
      medium_risk_clauses: mediumHits,
      future_risks: futureCount,
      total_text_length: (terms || '').length,
      word_count: words,
    },
  };
}

function generateDemoOverview(question) {
  let result = '## Welcome to Fineprint\n\n';
  result += 'The analyst is currently running in **demo mode** (no AI engine key configured).\n\n';
  result += 'To get full AI-powered analysis, add an AI engine key to the `.env` file:\n```\nOPENAI_API_KEY=gsk-your-groq-key-here\n```\n\n';
  result += '### Consumer rights overview\n\n';
  for (const right of consumerRights.fundamental_rights) {
    result += `**${right.name}**: ${right.description}\n\n`;
  }
  result += '### Common risky clauses to watch for:\n\n';
  for (const risk of consumerRights.risky_clauses) {
    result += `- **${risk.type}** (risk: ${risk.risk_level}): ${risk.description}\n`;
  }
  if (question) {
    result += `\n### Your question: ${question}\n\nConnect an AI engine key for detailed answers.\n`;
  }
  result += '\n*Note: this is demo output. Connect an AI engine key for real AI analysis.*';
  return result;
}

function analyzeTermsDemo(terms, question) {
  if (!terms) return generateDemoOverview(question);

  const termsLower = terms.toLowerCase();
  const foundRisks = consumerRights.risky_clauses.filter((c) =>
    (c.keywords || []).some((kw) => termsLower.includes(kw))
  );
  const foundFuture = consumerRights.future_risks.filter((f) =>
    (f.warning_signs || []).some((ws) => termsLower.includes(ws))
  );

  let result = '## Terms & Conditions Analysis Report\n\n';
  result += '**Mode:** Demo analysis (keyword-based)\n';
  result += `**Text length:** ${terms.length} characters\n\n`;

  if (foundRisks.length) {
    result += `### Detected risks (${foundRisks.length} found)\n\n`;
    foundRisks.forEach((risk, i) => {
      const tag = risk.risk_level === 'high' ? 'HIGH' : risk.risk_level === 'medium' ? 'MEDIUM' : 'LOW';
      result += `**${i + 1}. ${risk.type}** (risk level: ${tag})\n> ${risk.description}\n\n`;
    });
  } else {
    result += '### No common risky clauses detected\n\nThis doesn\'t mean the terms are safe. A full AI analysis is recommended.\n\n';
  }

  if (foundFuture.length) {
    result += '### Potential future risks\n\n';
    foundFuture.forEach((frisk, i) => {
      result += `**${i + 1}. ${frisk.type}**\n> ${frisk.description}\n\n`;
    });
  }

  result += '### Consumer rights reference\n\n';
  consumerRights.fundamental_rights.slice(0, 4).forEach((right) => {
    result += `**${right.name}:** ${right.description}\n\n`;
  });

  if (question) {
    result += `\n### Your question\n\n**Q:** ${question}\n\nFor a detailed answer, connect an AI engine key.\n`;
  }

  result += '\n---\n*This is a demo analysis based on keyword matching. For comprehensive AI-powered analysis, add an AI engine key.*';
  return result;
}

function chatDemo(message, termsContext) {
  const msgLower = (message || '').toLowerCase();

  if (msgLower.includes('arbitration')) {
    return `## About arbitration clauses\n\n**Arbitration clauses** are common in T&C agreements and can significantly limit your legal rights.\n\n### What you should know\n- Mandatory arbitration prevents you from going to court\n- Class action waivers prevent you from joining group lawsuits\n- Arbitration decisions are usually final with limited appeal options\n\n### Recommended actions\n1. Look for opt-out provisions in the agreement\n2. Send a written opt-out notice if available\n3. Document everything in case of disputes\n\n*For specific advice about your situation, connect an AI engine key.*`;
  }
  if (msgLower.includes('privacy') || msgLower.includes('data')) {
    return `## Privacy and data protection\n\n### What to watch for\n- **Data collection**: excessive collection beyond what is necessary\n- **Data retention**: indefinite or excessive retention of personal data\n\n### Recommended actions\n1. Review what personal data is being collected\n2. Check if data is shared with third parties\n3. Exercise your right to data deletion (GDPR / CCPA)\n\n*For comprehensive privacy analysis, connect an AI engine key.*`;
  }
  if (msgLower.includes('refund') || msgLower.includes('return')) {
    return `## Refund and return rights\n\n### Key consumer rights\n- **Right to redressal**: seek compensation for unfair practices\n- **Cooling-off period**: many jurisdictions allow cancellation within 14-30 days\n\n### Your legal options\n1. Check local consumer protection laws for mandatory return periods\n2. Document defects with photos and receipts\n3. File complaints with consumer protection agencies\n\n*For specific advice, connect an AI engine key.*`;
  }
  if (msgLower.includes('help') || msgLower.includes('how')) {
    return `## How to use Fineprint\n\n### Getting started\n1. **Add a document** - paste it, fetch it from a URL, or attach a file\n2. Click **Run the audit** for a full risk assessment\n3. **Ask questions** about specific clauses\n\n### Example questions\n- "What data does this company collect?"\n- "Can I get a refund after cancellation?"\n- "Is this auto-renewal clause legal?"`;
  }
  return `## Thank you for your question\n\n**Your message:** "${message}"\n\n### Demo-mode response\n\nThe analyst is running in demo mode with keyword-based answers.\n\n**Consumer rights that may be relevant:**\n${consumerRights.fundamental_rights.slice(0, 3).map((r) => `- **${r.name}**: ${r.description}`).join('\n')}\n\n**Common T&C risks:**\n${consumerRights.risky_clauses.slice(0, 3).map((r) => `- **${r.type}** (${r.risk_level}): ${r.description}`).join('\n')}\n\n${termsContext ? '**Note:** I have the terms you provided earlier. For detailed analysis, connect an AI engine key.\n' : ''}\n---\n*For full AI-powered analysis, add an AI engine key to the .env file.*`;
}

// ---- API ----

app.get('/api/rights', (req, res) => {
  res.json(consumerRights);
});

app.post('/api/analyze', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const terms = asText(body.terms).slice(0, 60000);
    const question = asText(body.question);

    if (!terms && !question) {
      return res.status(400).json({ error: 'Please provide terms and conditions text or a question.' });
    }

    if (!isDemoMode()) {
      const { client, model, provider } = getAiClientAndModel();
      const riskData = terms ? calculateRiskScore(terms) : null;
      const screenNote = riskData
        ? `\n\nAUTOMATED SCREEN (keyword-based, computed from this same document): score ${riskData.score}/100, label "${riskData.verdict}". Your closing VERDICT label must match this label.`
        : '';

      let userMessage;
      if (terms && question) {
        userMessage = `Analyze the following Terms & Conditions and answer this question: "${question}"\n\n--- TERMS & CONDITIONS ---\n${terms}${screenNote}`;
      } else if (terms) {
        userMessage = `Perform a comprehensive analysis of the following Terms & Conditions:\n\n--- TERMS & CONDITIONS ---\n${terms}${screenNote}`;
      } else {
        userMessage = question;
      }

      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: ANALYST_SYSTEM },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 6000,
      });

      let content = (completion.choices[0].message.content || '').trim();
      if (!content) {
        logLine('[analyze] EMPTY model content received');
        return res.status(502).json({ error: 'The AI engine returned an empty response. Please try again.' });
      }
      const disclaimer = '\n\n*General information only - not legal advice. For significant money or rights at stake, consult a qualified lawyer in your jurisdiction.*';
      if (!content.includes('not legal advice')) content = content.replace(/\s+$/, '') + '\n' + disclaimer;

      console.log(`[analyze] terms_len=${terms.length} mode=${provider} risk=${riskData ? riskData.score : 'none'}`);
      logLine(`[analyze] path=/api/analyze terms_len=${terms.length} mode=${provider} risk_returned=${riskData !== null} risk_score=${riskData ? riskData.score : 'none'}`);
      return res.json({ response: content, mode: provider, risk: riskData });
    }

    const result = analyzeTermsDemo(terms, question);
    const riskData = terms ? calculateRiskScore(terms) : null;
    return res.json({ response: result, mode: 'demo', risk: riskData });
  } catch (error) {
    console.error('Analysis error:', error);
    logLine(`[analyze] ERROR ${error && error.name}: ${error && error.message}`);
    res.status(500).json({ error: 'Analysis failed. Please try again.' });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const message = asText(body.message);
    const history = Array.isArray(body.history) ? body.history : [];
    const termsContext = asText(body.termsContext).slice(0, 12000);

    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    if (!isDemoMode()) {
      const { client, model, provider } = getAiClientAndModel();
      let systemMsg = CHAT_SYSTEM;
      if (termsContext) {
        systemMsg += `\n\nThe user has previously provided these Terms & Conditions for analysis:\n---\n${termsContext}\n---`;
      }
      const messages = [{ role: 'system', content: systemMsg }];
      for (const msg of history.slice(-10)) {
        if (!msg || typeof msg !== 'object') continue;
        const role = msg.role === 'assistant' || msg.role === 'system' ? msg.role : 'user';
        messages.push({ role, content: asText(msg.content) });
      }
      messages.push({ role: 'user', content: message });

      const completion = await client.chat.completions.create({
        model,
        messages,
        temperature: 0.3,
        max_tokens: 3000,
      });

      const content = completion.choices[0].message.content;
      console.log(`[chat] message_len=${message.length} terms_ctx=${termsContext.length} mode=${provider}`);
      logLine(`[chat] path=/api/chat message_len=${message.length} terms_ctx=${termsContext.length} mode=${provider}`);
      return res.json({ response: content, mode: provider });
    }

    const result = chatDemo(message, termsContext);
    return res.json({ response: result, mode: 'demo' });
  } catch (error) {
    console.error('Chat error:', error);
    logLine(`[chat] ERROR ${error && error.name}: ${error && error.message}`);
    res.status(500).json({ error: 'Chat failed. Please try again.' });
  }
});

app.post('/api/fetch-url', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    let url = asText(body.url).trim();
    if (!url) return res.status(400).json({ error: 'URL is required.' });
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) {
      return res.status(502).json({ error: `Website returned an error: ${response.status}` });
    }
    const html = await response.text();
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim().slice(0, 200) : url;

    // Strip scripts/styles/nav/footer/header/aside/iframe/noscript, then tags
    let text = html
      .replace(/<(script|style|nav|footer|header|aside|iframe|noscript)[\s\S]*?<\/\1\s*>/gi, ' ')
      .replace(/<[^>]+>/g, '\n')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"');
    const lines = text.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    // Drop very short nav-ish lines, keep the longest coherent body
    const cleaned = lines.filter((l) => l.length > 1).join('\n');

    if (cleaned.length < 50) {
      return res.status(422).json({ error: 'Could not extract meaningful content from this URL. The page may require JavaScript or have restricted access.', url, title });
    }

    return res.json({ terms: cleaned.slice(0, 60000), url, title, length: cleaned.length });
  } catch (error) {
    if (error && error.name === 'AbortError') {
      return res.status(408).json({ error: 'Request timed out. The website took too long to respond.' });
    }
    console.error('URL fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch the URL. Please try again.' });
  }
});

// ---- Static + SPA fallback (must come AFTER /api routes) ----
app.use(express.static(PUBLIC_DIR, { index: false }));

function sendIndex(req, res) {
  const target = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(target)) return res.sendFile(target);
  return res.sendFile(path.join(BASE_DIR, 'public', 'index.html'));
}

app.get('/', sendIndex);
app.get('/chat', sendIndex);

// SPA fallback: any non-API GET serves the React app
app.get(/^(?!\/api\/).*/, sendIndex);

app.listen(PORT, () => {
  console.log(`\nFineprint running at http://localhost:${PORT}`);
  console.log(`Chat at http://localhost:${PORT}/chat`);
  if (isDemoMode()) {
    console.log('\nRunning in DEMO mode. Add OPENAI_API_KEY to .env for full AI analysis.\n');
  } else {
    const { model, provider } = getAiClientAndModel();
    console.log(`\n${provider.toUpperCase()} API key detected. AI analysis enabled (model: ${model}).\n`);
  }
});
