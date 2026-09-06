import { useEffect, useRef, useState } from 'react'
import type { RiskData } from '../types'

interface Props {
  risk: RiskData | null
  decision: string | null
  onDecision: (d: string) => void
  onReset: () => void
}

function hexFor(color: string): string {
  switch (color) {
    case 'green': case 'success': case '#10b981': return '#3ECF8E'
    case 'yellow': case 'warning': case '#f59e0b': return '#F0A13C'
    default: return '#FF5635'
  }
}

export default function Scoreboard({ risk, decision, onDecision, onReset }: Props) {
  return (
    <div className="verdict">
      {!risk ? (
        <div className="verdict-empty">
          <i className="fas fa-file-signature"></i>
          <div className="micro">No verdict yet</div>
          <p>Submit a document above and the analyst will return its safety score here.</p>
        </div>
      ) : (
        <Verdict risk={risk} decision={decision} onDecision={onDecision} onReset={onReset} />
      )}
    </div>
  )
}

function Verdict({ risk, decision, onDecision, onReset }: { risk: RiskData; decision: string | null; onDecision: Props['onDecision']; onReset: Props['onReset'] }) {
  const score = Math.max(0, Math.min(100, risk.score || 0))
  const color = hexFor(risk.verdict_color)
  const [display, setDisplay] = useState(0)
  const animated = useRef(false)

  useEffect(() => {
    animated.current = false
    setDisplay(0)
    let raf = 0
    let start: number | null = null
    const dur = 1100
    const step = (ts: number) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / dur, 1)
      setDisplay(Math.round((1 - Math.pow(1 - p, 3)) * score))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [score])

  const R = 52
  const C = 2 * Math.PI * R
  const offset = C - (score / 100) * C

  return (
    <div className="verdict-body">
      <div className="v-score-row">
        <div className="v-score">
          <svg width="132" height="132" viewBox="0 0 132 132">
            <circle className="v-ring-bg" cx="66" cy="66" r={R} />
            <circle
              className="v-ring"
              cx="66" cy="66" r={R}
              stroke={color}
              strokeDasharray={C}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="v-score-txt">
            <div>
              <div className="num">{display}</div>
              <div className="sup">/ 100</div>
            </div>
          </div>
        </div>
        <div className="v-label">
          <div className="vl">Safety score</div>
          <div className="verdict-flag" style={{ color }}>{risk.verdict}</div>
          <div className="rec">{risk.recommendation}</div>
        </div>
      </div>

      <div className="v-meter">
        <div className="v-scale"><span>0 low </span><span>safe</span></div>
        <div className="v-track">
          <div className="v-fill" style={{ width: `${score}%`, background: color }}></div>
          <div className="v-notch" style={{ left: `calc(${score}% - 1.5px)` }}></div>
        </div>
      </div>

      <div className="v-stats">
        <div className="v-stat">
          <div className="ic red"><i className="fas fa-triangle-exclamation"></i></div>
          <div><span className="n num">{risk.breakdown.high_risk_clauses}</span><span className="k"> high-risk clauses</span></div>
        </div>
        <div className="v-stat">
          <div className="ic grn"><i className="fas fa-clock"></i></div>
          <div><span className="n num">{risk.breakdown.future_risks}</span><span className="k"> future hazards</span></div>
        </div>
        <div className="v-stat">
          <div className="ic blu"><i className="fas fa-bars"></i></div>
          <div><span className="n num">{risk.breakdown.medium_risk_clauses}</span><span className="k"> medium clauses</span></div>
        </div>
        <div className="v-stat">
          <div className="ic grn"><i className="fas fa-spell-check"></i></div>
          <div><span className="n num">{risk.breakdown.word_count.toLocaleString()}</span><span className="k"> words read</span></div>
        </div>
      </div>

      {!decision ? (
        <div className="v-actions">
          <button className="act approve" onClick={() => onDecision('approve')}><i className="fas fa-check"></i>Approve</button>
          <button className="act negotiate" onClick={() => onDecision('negotiate')}><i className="fas fa-scale-balanced"></i>Negotiate</button>
          <button className="act reject" onClick={() => onDecision('reject')}><i className="fas fa-xmark"></i>Reject</button>
        </div>
      ) : (
        <div className={`v-decision ${decision}`}>
          <div className="micro">
            {decision === 'approve' && <i className="fas fa-check"></i>} Verdict filed: {decision}
          </div>
          <p>
            {decision === 'approve' && 'Looks fair enough to accept. Keep a copy of the accepted terms for your records.'}
            {decision === 'negotiate' && 'Push back on the risky clauses before you commit. Ask the analyst how to phrase your counter-offer.'}
            {decision === 'reject' && 'The risk outweighs the reward here. Ask the analyst about safer alternatives and your rights.'}
          </p>
          <button className="fp-btn small" onClick={onReset}><i className="fas fa-rotate-left"></i> Re-examine</button>
        </div>
      )}
    </div>
  )
}