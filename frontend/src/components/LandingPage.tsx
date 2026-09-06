import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from './Navbar'

const tickerItems = [
  'Automatic renewal', 'Binding arbitration', 'Class action waiver', 'Unlimited liability',
  'No refund policy', 'Data resale', 'Price change without notice', 'Indemnification',
  'Mandatory arbitration', 'Right to terminate'
]

const features = [
  {
    icon: 'fa-magnifying-glass-chart',
    title: 'Clause-by-clause risk audit',
    desc: 'Every sentence is cross-checked against a catalog of high-risk patterns — auto-renewal traps, liability caps, forced arbitration, data resale, unilateral changes and more.',
    tag: 'Detection'
  },
  {
    icon: 'fa-clock',
    title: 'Future-risk projection',
    desc: 'Terms don\'t just describe today — they license tomorrow. The analyst flags clauses that could bite later: price hikes, silent policy swaps, service shutdowns.',
    tag: 'Forecasting'
  },
  {
    icon: 'fa-scale-balanced',
    title: 'Consumer-law comparison',
    desc: 'Findings are mapped against GDPR, CCPA, the FTC Act and India\'s Consumer Protection Act, so you know which clauses actually cross legal lines.',
    tag: 'Compliance'
  },
  {
    icon: 'fa-gavel',
    title: 'A redress plan, not a verdict',
    desc: 'If a clause is wrong for you, get the concrete next steps — an opt-out letter, a regulator complaint, a refund request — with the right timing and authority.',
    tag: 'Action'
  },
  {
    icon: 'fa-comments',
    title: 'Ask the document anything',
    desc: 'Treat the whole policy as interviewable. Ask "what happens if I cancel?", "who owns my data?", "can I be charged twice?" and get cited answers.',
    tag: 'Dialogue'
  },
  {
    icon: 'fa-shield-halved',
    title: 'A safety score you can act on',
    desc: 'One number, three buttons: approve, negotiate, or reject. Built from the same evidence a human reviewer would weigh — not a vibe check.',
    tag: 'Verdict'
  }
]

const steps = [
  {
    no: '01',
    title: 'Submit the document',
    desc: 'Paste the terms or privacy policy, drop in a URL, or upload a PDF or text file. Up to 20,000 words — the parts that matter most.'
  },
  {
    no: '02',
    title: 'The analyst reads it',
    desc: 'On Groq hardware, every clause is read in seconds. Risks, legal violations and future hazards are extracted and cross-referenced.'
  },
  {
    no: '03',
    title: 'Get the verdict',
    desc: 'A safety score out of 100, a plain-language report, and a call: approve, negotiate, or reject — plus exactly how to do each.',
  }
]

const rights = [
  { icon: 'fa-eye', name: 'Right to information', desc: 'Clear, honest disclosure of price, quality and terms.', laws: ['Consumer Protection Act', 'FTC Act'] },
  { icon: 'fa-hand', name: 'Right to choose', desc: 'No forced bundles or unfair lock-in arrangements.', laws: ['Competition Act', 'EU Directive'] },
  { icon: 'fa-heart-pulse', name: 'Right to safety', desc: 'Goods and services that won\'t harm or defraud you.', laws: ['Product liability law'] },
  { icon: 'fa-shield-halved', name: 'Right to privacy', desc: 'Your data collected, used and deleted lawfully.', laws: ['GDPR', 'CCPA', 'DPDP Act'] },
  { icon: 'fa-receipt', name: 'Right to redressal', desc: 'A real path to complaint, compensation and repair.', laws: ['Consumer courts', 'ADR'] },
  { icon: 'fa-file-contract', name: 'Right to fair contract', desc: 'No trap terms, hidden fees or one-sided clauses.', laws: ['Unfair Contract Terms'] }
]

const noVideos = ['Legal', 'Practical', 'Third-party', 'Everyday']

function Reveal({ children }: { children?: React.ReactNode }) {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.reveal')
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target) } }),
      { threshold: 0.12 }
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [])
  return <>{children}</>
}

export default function LandingPage() {
  const navigate = useNavigate()

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="landing">
      <Navbar onNavigate={scrollTo} onStart={() => navigate('/chat')} />

      {/* ticker */}
      <div className="ticker">
        <div className="ticker-track">
          {[...tickerItems, ...tickerItems].map((t, i) => (
            <span className="ticker-item" key={i}><i className="fas fa-circle"></i>{t}</span>
          ))}
        </div>
      </div>

      {/* hero */}
      <section className="hero">
        <div className="hero-rule-top"></div>
        <div className="container hero-grid">
          <div className="hero-left">
            <div className="hero-kicker micro rise d1">AI terms &amp; privacy analyst</div>
            <h1 className="display rise d1">Every contract has a catch.<br /><span className="rule">Find it first.</span></h1>
            <p className="hero-sub rise d2">
              Tired of pasting 12,000 words into a chat box and praying? <strong>Fineprint</strong> reads the
              whole Terms &amp; Conditions or Privacy Policy — pasted, from a <strong>URL</strong>, or an uploaded
              <strong> file</strong> — scores its danger, and tells you in plain language what it means and what to do.
            </p>
            <div className="hero-cta rise d3">
              <button className="btn btn-red" onClick={() => navigate('/chat')}>
                <i className="fas fa-arrow-right"></i> Open the analyzer
              </button>
              <button className="btn btn-paper" onClick={() => scrollTo('process')}>How it reads</button>
            </div>
            <div className="hero-note rise d4">No sign-up. No card. Your document never leaves the app.</div>

            <div className="hero-statline rise d4">
              <div className="hero-stat">
                <div className="n num">100<span className=""><sup>/</sup></span></div>
                <div className="l">Point risk scale</div>
              </div>
              <div className="hero-stat">
                <div className="n num">3<span><sup> min</sup></span></div>
                <div className="l">From paste to verdict</div>
              </div>
              <div className="hero-stat">
                <div className="n num">6<span><sup> rights</sup></span></div>
                <div className="l">Tracked against the law</div>
              </div>
            </div>
          </div>

          <div className="hero-right rise d3">
            <div className="hero-scan"></div>
            {/* dossier mock */}
            <div className="dossier" aria-hidden="true">
              <div className="dossier-head">
                <div className="dossier-title">Risk <b>dossier</b> /* sample */</div>
                <div className="dossier-stamp">HIGH RISK</div>
              </div>
              <div className="dossier-gauge">
                <div className="gauge-label">Safety score</div>
                <div className="gauge-row">
                  <div className="gauge-score num" id="gaugeNumber">78</div>
                  <div className="gauge-label" style={{ marginBottom: 0 }}>of 100</div>
                </div>
                <div className="gauge-scale">
                  <div className="gauge-bar">
                    <div className="gauge-fill" id="gaugeFill"></div>
                    <div className="gauge-notch" id="gaugeNotch"></div>
                  </div>
                </div>
              </div>
              <div className="dossier-clauses">
                <div className="dclause"><div className="ic"><i className="fas fa-repeat"></i></div><div className="tx">Auto-renews every month, silently</div><div className="lvl red">HIGH</div></div>
                <div className="dclause"><div className="ic amber"><i className="fas fa-scale-balanced"></i></div><div className="tx">Forced binding arbitration</div><div className="lvl">MED</div></div>
                <div className="dclause"><div className="ic"><i className="fas fa-file-invoice-dollar"></i></div><div className="tx">Prices change without notice</div><div className="lvl red">HIGH</div></div>
                <div className="dclause"><div className="ic ok"><i className="fas fa-database"></i></div><div className="tx">Data shared with partners</div><div className="lvl">LOW</div></div>
              </div>
              <div className="dossier-foot">
                <span>GENERATED IN 2.1s</span>
                <span>ORIGIN: URL</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* seam marquee */}
      <div className="seam">
        <div className="seam-track">
          {[...noVideos, ...noVideos, ...noVideos, ...noVideos].map((w, i) => (
            <div className="seam-item" key={i}>No <span>kludge</span> assistants here · <span>{w}</span> meaning only</div>
          ))}
        </div>
      </div>

      {/* capabilities */}
      <section className="section" id="capabilities">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="section-no">§ 01 — Capabilities</div>
              <h2 className="display section-title">A reviewer who reads the <em style={{ fontStyle: 'normal', color: 'var(--red)' }}>whole</em> document</h2>
            </div>
            <p className="section-lead">Most checkers sample a paragraph and guess. Fineprint ingests everything you submit and reviews it the way a diligent clerk would — in seconds, with sources.</p>
          </div>
          <div className="spec">
            {features.map((f, i) => (
              <div className="spec-cell reveal" key={f.title}>
                <span className="idx num">0{i + 1}</span>
                <div className="ic"><i className={`fas ${f.icon}`}></i></div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
                <span className="tag">{f.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* process */}
      <section className="section section-alt" id="process">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="section-no">§ 02 — Process</div>
              <h2 className="display section-title">From paste to verdict, one desk</h2>
            </div>
            <p className="section-lead">You should not need a law degree to read a contract. Fineprint is the clerk, the paralegal and the plain-language translator.</p>
          </div>
          <div className="process">
            {steps.map((s, i) => (
              <div className="pstep reveal" key={s.no}>
                <div className="no num">{s.no}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
                {i < steps.length - 1 && <div className="arr"><i className="fas fa-arrow-right"></i></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* rights */}
      <section className="section" id="rights">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="section-no">§ 03 — Your rights</div>
              <h2 className="display section-title">The six protections we check for</h2>
            </div>
            <p className="section-lead">Every finding is framed as a question: does this clause impair one of the rights below? If it does, you'll see the law it collides with.</p>
          </div>
          <div className="rights-board">
            {rights.map((r) => (
              <div className="right-item reveal" key={r.name}>
                <div className="rc"><i className={`fas ${r.icon}`}></i></div>
                <h4>{r.name}</h4>
                <p>{r.desc}</p>
                <div className="laws">{r.laws.map((l) => <span key={l}>{l}</span>)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* final CTA */}
      <section className="cta-band">
        <div className="container cta-inner">
          <div className="micro rise">Your next click, vetted</div>
          <h2 className="display rise">Sign what you've <span>read.</span> Read what you'd <span>sign.</span></h2>
          <p className="rise">Feed it the app you're about to install, the gym you're about to join, the SaaS you're about to bill — and see the fine print before it sees your card.</p>
          <div className="cta-actions rise">
            <button className="btn btn-red-solid" onClick={() => navigate('/chat')}>
              <i className="fas fa-arrow-right"></i> Analyze a document
            </button>
            <button className="btn btn-red-outline" onClick={() => navigate('/chat')}>Ask a question first</button>
          </div>
        </div>
      </section>

      <Reveal />

      {/* footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="brand">
              <div className="wordmark">A<span className="mark">//</span>Fineprint</div>
              <p>An AI analyst for the terms, conditions and privacy policies that decide how software treats you. Read before you click.</p>
            </div>
            <div className="f-links">
              <div className="f-rule">Navigate</div>
              <a onClick={() => scrollTo('capabilities')}>Capabilities</a>
              <a onClick={() => scrollTo('process')}>Process</a>
              <a onClick={() => scrollTo('rights')}>Your rights</a>
              <a onClick={() => navigate('/chat')}>Analyze now</a>
            </div>
            <div className="f-links">
              <div className="f-rule">Statutes</div>
              <a href="https://gdpr-info.eu/" target="_blank" rel="noreferrer">GDPR — EU</a>
              <a href="https://oag.ca.gov/privacy/ccpa" target="_blank" rel="noreferrer">CCPA — California</a>
              <a href="https://www.ftc.gov/" target="_blank" rel="noreferrer">FTC Act — US</a>
              <a href="https://consumeraffairs.nic.in/" target="_blank" rel="noreferrer">Consumer Protection Act — India</a>
            </div>
            <div className="f-links">
              <div className="f-rule">Stack</div>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--muted)' }}>Groq · GPT-OSS-120B</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--muted)' }}>React · Flask · Python</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--muted)' }}>Your data: analyzed, not stored</span>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© 2026 Fineprint — an AI terms &amp; privacy analyst.</p>
            <p>FOR INFORMATION, NOT LEGAL ADVICE.</p>
          </div>
        </div>
      </footer>

      {/* gauge animation */}
      <GaugeAnim />
    </div>
  )
}

function GaugeAnim() {
  useEffect(() => {
    const fill = document.getElementById('gaugeFill')
    const notch = document.getElementById('gaugeNotch')
    const num = document.getElementById('gaugeNumber')
    if (!fill || !notch || !num) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          obs.disconnect()
          const target = 78
          let start: number | null = null
          const dur = 1500
          const step = (ts: number) => {
            if (!start) start = ts
            const p = Math.min((ts - start) / dur, 1)
            const eased = 1 - Math.pow(1 - p, 3)
            const val = Math.round(eased * target)
            fill.style.width = val + '%'
            notch.style.left = `calc(${val}% - 1.5px)`
            num.textContent = String(val)
            if (p < 1) requestAnimationFrame(step)
          }
          requestAnimationFrame(step)
        }
      },
      { threshold: 0.4 }
    )
    obs.observe(fill)
    return () => obs.disconnect()
  }, [])
  return null
}