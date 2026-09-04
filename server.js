require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const OpenAI = require('openai');
const consumerRights = require('./consumerRights');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'demo-mode'
});

const SYSTEM_PROMPT = `You are an expert Terms & Conditions analyzer and consumer rights advisor. Your role is to:

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

Be thorough, specific, and cite actual consumer protection laws. Use markdown formatting for readability. Always provide actionable advice.`;

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

app.get('/api/rights', (req, res) => {
  res.json(consumerRights);
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { terms, question } = req.body;

    if (!terms && !question) {
      return res.status(400).json({ error: 'Please provide terms and conditions text or a question.' });
    }

    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'demo-mode') {
      let userMessage = '';
      if (terms && question) {
        userMessage = `Analyze the following Terms & Conditions and answer this question: "${question}"\n\n--- TERMS & CONDITIONS ---\n${terms}`;
      } else if (terms) {
        userMessage = `Perform a comprehensive analysis of the following Terms & Conditions:\n\n--- TERMS & CONDITIONS ---\n${terms}`;
      } else {
        userMessage = question;
      }

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.3,
        max_tokens: 4000
      });

      const content = completion.choices[0].message.content;
      res.json({ response: content, mode: 'ai' });
    } else {
      const result = analyzeTermsDemo(terms, question);
      res.json({ response: result, mode: 'demo' });
    }
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Analysis failed. Please try again.' });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history, termsContext } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'demo-mode') {
      const messages = [
        { role: 'system', content: SYSTEM_PROMPT + (termsContext ? `\n\nThe user has previously provided these Terms & Conditions for analysis:\n---\n${termsContext}\n---` : '') }
      ];

      if (history) {
        history.forEach(msg => {
          messages.push({ role: msg.role, content: msg.content });
        });
      }

      messages.push({ role: 'user', content: message });

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        temperature: 0.3,
        max_tokens: 2000
      });

      const content = completion.choices[0].message.content;
      res.json({ response: content, mode: 'ai' });
    } else {
      const result = chatDemo(message, termsContext);
      res.json({ response: result, mode: 'demo' });
    }
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Chat failed. Please try again.' });
  }
});

function analyzeTermsDemo(terms, question) {
  if (!terms) {
    return `## Welcome to T&C Risk Analyzer! 🛡️

I'm currently running in **demo mode** (no OpenAI API key configured).

To get full AI-powered analysis, add your OpenAI API key to the \`.env\` file:
\`\`\`
OPENAI_API_KEY=sk-your-key-here
\`\`\`

### In demo mode, here's what I can tell you:

${question ? `**Your Question:** ${question}\n\n` : ''}
### Consumer Rights Overview

Here are key consumer rights that Terms & Conditions should respect:

${consumerRights.fundamental_rights.map(r => `**${r.name}**: ${r.description}`).join('\n\n')}

### Common Risky Clauses to Watch For:

${consumerRights.risky_clauses.map(r => `- **${r.type}** (Risk: ${r.risk_level}): ${r.description}`).join('\n')}

### To use the full analyzer:
1. Get an OpenAI API key from [platform.openai.com](https://platform.openai.com)
2. Add it to your \`.env\` file
3. Paste any Terms & Conditions for detailed analysis

*Note: This is demo output. Connect an OpenAI API key for real AI analysis.*`;
  }

  let riskAnalysis = '';
  const termsLower = terms.toLowerCase();
  const foundRisks = [];

  consumerRights.risky_clauses.forEach(clause => {
    const found = clause.keywords.some(kw => termsLower.includes(kw));
    if (found) {
      foundRisks.push(clause);
    }
  });

  const foundFutureRisks = [];
  consumerRights.future_risks.forEach(frisk => {
    const found = frisk.warning_signs.some(ws => termsLower.includes(ws));
    if (found) {
      foundFutureRisks.push(frisk);
    }
  });

  riskAnalysis = `## 📋 Terms & Conditions Analysis Report\n\n`;
  riskAnalysis += `**Mode:** Demo Analysis (keyword-based)\n`;
  riskAnalysis += `**Text Length:** ${terms.length} characters\n\n`;

  if (foundRisks.length > 0) {
    riskAnalysis += `### ⚠️ Detected Risks (${foundRisks.length} found)\n\n`;
    foundRisks.forEach((risk, i) => {
      const emoji = risk.risk_level === 'high' ? '🔴' : risk.risk_level === 'medium' ? '🟡' : '🟢';
      riskAnalysis += `${emoji} **${i + 1}. ${risk.type}** (Risk Level: ${risk.risk_level.toUpperCase()})\n`;
      riskAnalysis += `> ${risk.description}\n\n`;
    });
  } else {
    riskAnalysis += `### ✅ No Common Risky Clauses Detected\n\n`;
    riskAnalysis += `This doesn't mean the terms are safe. A full AI analysis is recommended.\n\n`;
  }

  if (foundFutureRisks.length > 0) {
    riskAnalysis += `### 🔮 Potential Future Risks\n\n`;
    foundFutureRisks.forEach((frisk, i) => {
      riskAnalysis += `**${i + 1}. ${frisk.type}**\n`;
      riskAnalysis += `> ${frisk.description}\n\n`;
    });
  }

  riskAnalysis += `### 📚 Consumer Rights Reference\n\n`;
  consumerRights.fundamental_rights.slice(0, 4).forEach(right => {
    riskAnalysis += `**${right.name}:** ${right.description}\n\n`;
  });

  if (question) {
    riskAnalysis += `\n### ❓ Your Question\n\n`;
    riskAnalysis += `**Q:** ${question}\n\n`;
    riskAnalysis += `For a detailed answer to your question, please configure an OpenAI API key for full AI-powered analysis.\n`;
  }

  riskAnalysis += `\n---\n*This is a demo analysis based on keyword matching. For comprehensive AI-powered analysis, add your OpenAI API key.*`;

  return riskAnalysis;
}

function chatDemo(message, termsContext) {
  const msgLower = message.toLowerCase();

  if (msgLower.includes('arbitration')) {
    return `## ⚖️ About Arbitration Clauses\n\n**Arbitration clauses** are common in T&C agreements and can significantly limit your legal rights.\n\n### What you should know:\n- Mandatory arbitration prevents you from going to court\n- Class action waivers prevent you from joining group lawsuits\n- Arbitration decisions are usually final with limited appeal options\n\n### Your Rights:\n- Some jurisdictions allow you to opt out of arbitration within 30 days\n- The FTC has been cracking down on unfair arbitration clauses\n- Certain consumer protection laws override arbitration agreements\n\n### Recommended Actions:\n1. Look for opt-out provisions in the agreement\n2. Send a written opt-out notice if available\n3. Document everything in case of disputes\n4. Consult a consumer rights attorney for significant issues\n\n*For specific advice about your situation, configure an OpenAI API key.*`;
  }

  if (msgLower.includes('privacy') || msgLower.includes('data')) {
    return `## 🔒 Privacy & Data Protection\n\n### Your Privacy Rights:\n${consumerRights.fundamental_rights.filter(r => r.name.includes('Privacy')).map(r => `- **${r.name}**: ${r.description}\n- Laws: ${r.laws.join(', ')}`).join('\n\n')}\n\n### What to Watch For:\n${consumerRights.risky_clauses.filter(r => ['Data Collection', 'Data Retention'].includes(r.type)).map(r => `- **${r.type}**: ${r.description}`).join('\n')}\n\n### Recommended Actions:\n1. Review what personal data is being collected\n2. Check if data is shared with third parties\n3. Exercise your right to data deletion (GDPR/CCPA)\n4. Use privacy-focused alternatives when possible\n\n*For comprehensive privacy analysis, configure an OpenAI API key.*`;
  }

  if (msgLower.includes('refund') || msgLower.includes('return')) {
    return `## 💰 Refund & Return Rights\n\n### Key Consumer Rights:\n- **Right to Redressal**: Consumers have the right to seek compensation for unfair practices\n- **Cooling-off Period**: Many jurisdictions allow cancellation within 14-30 days\n- **Product Liability**: Sellers are responsible for defective products\n\n### Common Problematic Clauses:\n${consumerRights.risky_clauses.filter(r => r.type === 'No Refund Policy').map(r => `- **${r.type}**: ${r.description}`).join('\n')}\n\n### Your Legal Options:\n1. Check local consumer protection laws for mandatory return periods\n2. Document product defects with photos and receipts\n3. File complaints with consumer protection agencies\n4. Consider small claims court for significant amounts\n\n*For specific advice, configure an OpenAI API key.*`;
  }

  if (msgLower.includes('help') || msgLower.includes('how')) {
    return `## 🤖 How to Use T&C Risk Analyzer\n\n### Getting Started:\n1. **Paste Terms & Conditions** in the input area above\n2. Click **Analyze** for a comprehensive risk assessment\n3. **Ask questions** about specific clauses or concerns\n\n### What I Analyze:\n- 🔴 **Risk Detection** - Identifies harmful clauses\n- 🔮 **Future Risk Prediction** - Warns about potential issues\n- ⚖️ **Consumer Rights Comparison** - Checks for violations\n- 📋 **Legal Steps** - Recommends actions if problems arise\n\n### Tips:\n- Paste the full T&C text for best results\n- Ask specific questions like "Is this arbitration clause fair?"\n- Upload T&C from any service: apps, websites, subscriptions\n\n### Example Questions:\n- "What data does this company collect?"\n- "Can I get a refund?"\n- "Is this auto-renewal clause legal?"\n- "What are my rights if they change the terms?"`;
  }

  return `## 💬 Thank you for your question!\n\n**Your message:** "${message}"\n\n### Demo Mode Response:\n\nI'm currently running in demo mode with keyword-based analysis. Here's what I can tell you:\n\n**Consumer Rights that may be relevant:**\n${consumerRights.fundamental_rights.slice(0, 3).map(r => `- **${r.name}**: ${r.description}`).join('\n')}\n\n**Common T&C Risks:**\n${consumerRights.risky_clauses.slice(0, 3).map(r => `- **${r.type}** (${r.risk_level}): ${r.description}`).join('\n')}\n\n${termsContext ? `\n**Note:** I have the terms you previously provided. For detailed analysis of specific clauses, please configure an OpenAI API key.\n` : ''}\n---\n*For full AI-powered analysis, add your OpenAI API key to the .env file.*`;
}

app.listen(PORT, () => {
  console.log(`\n🛡️  T&C Risk Analyzer running at http://localhost:${PORT}`);
  console.log(`📖  Chat at http://localhost:${PORT}/chat`);
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'demo-mode') {
    console.log(`\n⚠️  Running in DEMO mode. Add OPENAI_API_KEY to .env for full AI analysis.\n`);
  } else {
    console.log(`\n✅  OpenAI API key detected. Full AI analysis enabled.\n`);
  }
});
