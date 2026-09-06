import { useEffect, useRef, useState } from 'react'
import type { ChatMessage, RiskData } from '../types'
import { analyzeTerms, sendChatMessage } from '../api'
import Sidebar from './Sidebar'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const WELCOME: ChatMessage = {
  role: 'assistant',
  content:
    `**The analyst is ready.** Drop a contract into the dossier on the left — paste it, pull it from a URL, or attach a file.\n\nOnce the audit runs you'll get a **safety score**, a clause-by-clause report, and a verdict. Or start by asking:`,
}

const quickStart: ChatMessage = {
  role: 'assistant',
  content: `**Suggested first question**\n\n> "What should I look for before I install an app without reading its terms?"`
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME, quickStart])
  const [input, setInput] = useState('')
  const [terms, setTerms] = useState('')
  const [termsContext, setTermsContext] = useState('')
  const [risk, setRisk] = useState<RiskData | null>(null)
  const [decision, setDecision] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [sending, setSending] = useState(false)
  const [mode, setMode] = useState('demo')
  const [docketClosed, setDocketClosed] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.body.classList.add('chat-body')
    return () => document.body.classList.remove('chat-body')
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, analyzing, sending])

  const render = (content: string) => {
    const raw = marked.parse(content, { async: false })
    return { __html: DOMPurify.sanitize(typeof raw === 'string' ? raw : '') }
  }

  const handleAnalyze = async () => {
    if (terms.trim().length < 40 || analyzing) return
    setAnalyzing(true)
    setDecision(null)
    setRisk(null)
    setTermsContext(terms.slice(0, 6000))
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: `Audit this for risks, future hazards and rights violations:\n\n${terms.length > 900 ? terms.slice(0, 900) + '\n\n…' + terms.slice(-120) : terms}` },
    ])

    const res = await analyzeTerms(terms)
    setAnalyzing(false)

    if (res.error) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `**The analyst hit a snag.**\n\n${res.error}` }])
      return
    }

    setMode(res.mode)
    if (res.risk) {
      setRisk(res.risk)
      const v = res.risk
      const flag = v.verdict_color === 'red' || v.verdict_color === 'danger' || v.verdict_color === 'critical'
        ? '**HIGH RISK**'
        : (v.verdict_color === 'yellow' || v.verdict_color === 'warning')
          ? '**CAUTION**'
          : '**SAFE**'
      setMessages((prev) => [...prev, { role: 'assistant', content: res.response + `\n\n---\n\n${flag} — Safety score **${v.score}/100** (${v.verdict}). ${v.recommendation}` }])
    } else {
      setMessages((prev) => [...prev, { role: 'assistant', content: res.response }])
    }
  }

  const handleSend = async (override?: string) => {
    const text = (override ?? input).trim()
    if (!text || sending) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setSending(true)
    const res = await sendChatMessage(text, messages, termsContext)
    setSending(false)
    if (res.mode && res.mode !== mode) setMode(res.mode)
    setMessages((prev) => [...prev, { role: 'assistant', content: res.error || res.response }])
  }

  const handleClear = () => {
    setMessages([WELCOME, quickStart])
    setRisk(null)
    setDecision(null)
    setTerms('')
    setTermsContext('')
    setMode('demo')
  }

  const humanize = (m: string) => {
    switch (m) {
      case 'groq': return 'AI native'
      case 'openai': return 'OpenAI'
      default: return 'Demo'
    }
  }

  const hexFor = (c: string) => {
    switch (c) {
      case 'green': case 'success': case '#10b981': return '#3ECF8E'
      case 'yellow': case 'warning': case '#f59e0b': return '#F0A13C'
      default: return '#FF5635'
    }
  }

  return (
    <div className="app">
      <header className="app-top">
        <div className="app-brand">
          <span className="wordmark">A<span className="mark">//</span>Fineprint</span>
          <span className="app-session">Case file: <span style={{ color: 'var(--mutedD)' }}>{termsContext ? (terms.length ? `${terms.length.toLocaleString()} words in review` : 'document staged') : 'no document'}</span></span>
        </div>
        <div className="app-top-actions">
          <span className={`chip${mode === 'demo' ? ' demo' : ' live'}`}>
            <span className="dot"></span>{humanize(mode)} engine
          </span>
          <button className="chip" style={{ cursor: 'pointer' }} onClick={handleClear}>
            <i className="fas fa-rotate-left" style={{ fontSize: 10 }}></i> New case
          </button>
        </div>
      </header>

      {risk && (
        <div className="score-banner" style={{ borderLeftColor: hexFor(risk.verdict_color) }}>
          <div className="sb-left">
            <span className="sb-dot" style={{ background: hexFor(risk.verdict_color) }}></span>
            <span className="micro">Safety verdict</span>
          </div>
          <div className="sb-center">
            <span className="num" style={{ color: hexFor(risk.verdict_color) }}>{risk.score}/100</span>
            <span className="sb-flag" style={{ color: hexFor(risk.verdict_color) }}>{risk.verdict.toUpperCase()}</span>
          </div>
          <button className="sb-goto" onClick={() => document.querySelector('.docket')?.scrollIntoView({ behavior: 'smooth' })}>
            <i className="fas fa-arrow-right"></i>
          </button>
        </div>
      )}

      <div className={`app-body${docketClosed ? ' docket-closed' : ''}`}>
        <Sidebar
          terms={terms}
          onTermsChange={(t) => { setTerms(t); setTermsContext(t.slice(0, 6000)) }}
          onAnalyze={handleAnalyze}
          analyzing={analyzing}
          risk={risk}
          decision={decision}
          onDecision={(d) => {
            setDecision(d)
            const copy: Record<string, string> = {
              approve: '**Verdict filed: approve.** Looks acceptable on balance. Keep a copy of the accepted terms for your records — and ask me for anything you still find vague.',
              negotiate: '**Verdict filed: negotiate.** Push back on the risky clauses before you commit. Tell me which clause bothers you and I will draft your counter-offer.',
              reject: '**Verdict filed: reject.** The risk outweighs the reward here. Ask me about safer alternatives or the exact rights you would be surrendering.'
            }
            setMessages((prev) => [...prev, { role: 'assistant', content: copy[d] }])
          }}
          onReset={() => { setRisk(null); setDecision(null) }}
          onQuickQuestion={(q) => handleSend(q)}
        />
        <button className={`docket-toggle${docketClosed ? ' closed' : ''}`} onClick={() => setDocketClosed(!docketClosed)} title="Toggle dossier">
          <i className="fas fa-chevron-right"></i>
        </button>

        <div className="conv">
          <div className="conv-scroll">
            <div className="conv-inner">
              <div className="welcome">
                <div className="micro">New case · {termsContext ? 'document attached' : 'awaiting document'}</div>
                <h2>Read the fine print — before you click.</h2>
                <p>Paste an agreement, drop a URL, or attach a file. The analyst cross-checks every clause against known risk patterns and consumer law, then gives you a plain-language verdict.</p>
                <div className="welcome-grid">
                  <div className="w-feat"><i className="fas fa-file-arrow-up"></i><strong>Any source</strong><span>URL, paste, or file — up to 20k words.</span></div>
                  <div className="w-feat"><i className="fas fa-shield-halved"></i><strong>Safety score</strong><span>A 0–100 verdict you can act on.</span></div>
                  <div className="w-feat"><i className="fas fa-comments"></i><strong>Ask anything</strong><span>Dialogue with the whole document.</span></div>
                </div>
              </div>

              {messages.map((m, i) => (
                <div className={`msg ${m.role}`} key={i}>
                  <div className="msg-ava"><i className={`fas ${m.role === 'user' ? 'fa-user' : 'fa-user-secret'}`}></i></div>
                  <div className="msg-bubble" dangerouslySetInnerHTML={render(m.content)} />
                </div>
              ))}

              {(analyzing || sending) && (
                <div className="msg bot">
                  <div className="msg-ava"><i className="fas fa-user-secret"></i></div>
                  <div className="msg-bubble">
                    <div className="scanning-row">
                      <span>Reading the document</span>
                      <span className="bar"></span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={scrollRef} />
            </div>
          </div>

          <div className="composer">
            <div className="composer-inner">
              <textarea
                placeholder="Ask about a clause, your rights, or what to negotiate…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                rows={1}
              ></textarea>
              <button className="send-btn" onClick={() => handleSend()} disabled={sending || !input.trim()} aria-label="Send">
                <i className="fas fa-paper-plane"></i>
              </button>
            </div>
            <div className="composer-hint">
              Enter to send · Shift+Enter for a new line · Hourly questions are free, answers are cited
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}