import { useEffect, useRef, useState } from 'react'
import type { RiskData } from '../types'
import { fetchUrl } from '../api'
import Scoreboard from './Scoreboard'

interface Props {
  terms: string
  onTermsChange: (t: string, meta?: { name?: string; length?: number }) => void
  onAnalyze: () => void
  analyzing: boolean
  risk: RiskData | null
  decision: string | null
  onDecision: (d: string) => void
  onReset: () => void
  onQuickQuestion: (q: string) => void
}

type Tab = 'link' | 'paste' | 'file'

const prompts = [
  { icon: 'fa-triangle-exclamation', q: 'What are the three biggest risks in this document?' },
  { icon: 'fa-scale-balanced', q: 'Which consumer rights does this policy violate?' },
  { icon: 'fa-clock', q: 'What could go wrong with this in six months?' },
  { icon: 'fa-gavel', q: 'What legal steps can I take if they breach it?' },
  { icon: 'fa-pen', q: 'How should I phrase a negotiation counter-offer?' }
]

export default function Sidebar(props: Props) {
  const { terms, onTermsChange, onAnalyze, analyzing } = props
  const [tab, setTab] = useState<Tab>('paste')
  const [url, setUrl] = useState('')
  const [urlBusy, setUrlBusy] = useState(false)
  const [urlStatus, setUrlStatus] = useState<{ t: string; m: string }>({ t: '', m: '' })
  const [file, setFile] = useState<{ name: string; size: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const readFile = (f: File) => {
    if (!f) return
    const maxMB = 1
    if (f.size > maxMB * 1024 * 1024) {
      setUrlStatus({ t: 'err', m: `File too large (max ${maxMB}MB)` })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      const payload = text.length > 100000 ? text.slice(0, 100000) : text
      setFile({ name: f.name, size: payload.length })
      onTermsChange(payload, { name: f.name, length: payload.length })
      setUrlStatus({ t: 'ok', m: `${f.name} loaded — ${payload.length.toLocaleString()} chars` })
    }
    reader.readAsText(f)
  }

  const handleFetch = async () => {
    if (!url.trim() || urlBusy) return
    setUrlBusy(true)
    setUrlStatus({ t: 'busy', m: 'Fetching the document...' })
    const res = await fetchUrl(url.trim())
    setUrlBusy(false)
    if (res.error || !res.terms) {
      setUrlStatus({ t: 'err', m: res.error || 'Could not read that page.' })
    } else {
      setFile(null)
      onTermsChange(res.terms, { name: res.title, length: res.length })
      setUrlStatus({ t: 'ok', m: `${(res.title || res.url || 'Document').slice(0, 36)} — ${(res.length ?? res.terms.length).toLocaleString()} chars` })
    }
  }

  return (
    <div className="docket">
      <div className="docket-section">
        <div className="docket-head"><i className="fas fa-inbox"></i> Source document <span className="micro" style={{ color: 'var(--red-bright)' }}>/* 1 */</span></div>
        <div className="tab-row">
          {(['link', 'paste', 'file'] as Tab[]).map((t) => (
            <button
              key={t}
              className={`tab${tab === t ? ' active' : ''}`}
              onClick={() => setTab(t)}
            >
              <i className={`fas ${t === 'link' ? 'fa-link' : t === 'paste' ? 'fa-paste' : 'fa-file-arrow-up'}`}></i>
              {t}
            </button>
          ))}
        </div>

        {tab === 'link' && (
          <div className="field">
            <div className="field-row">
              <input
                type="text"
                placeholder="https://company.com/terms"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleFetch() }}
              />
              <button className="fp-btn primary" onClick={handleFetch} disabled={urlBusy || !url.trim()}>
                {urlBusy ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-arrow-right"></i>}
              </button>
            </div>
            <div className={`meta-line ${urlStatus.t}`}>{urlStatus.m || 'Pull the policy straight from any public page.'}</div>
            {terms && terms.length >= 40 && (
              <div className="action-row">
                <button className="fp-btn primary" onClick={onAnalyze} disabled={analyzing}>
                  {analyzing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-shield-halved"></i>}
                  {analyzing ? 'Reading…' : 'Run the audit'}
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'paste' && (
          <div className="field">
            <textarea
              placeholder="Paste the full Terms & Conditions or Privacy Policy here…"
              value={terms}
              onChange={(e) => onTermsChange(e.target.value, { name: 'Pasted text', length: e.target.value.length })}
            ></textarea>
            <div className="action-row">
              <button className="fp-btn primary" onClick={onAnalyze} disabled={analyzing || terms.trim().length < 40}>
                {analyzing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-shield-halved"></i>}
                {analyzing ? 'Reading…' : 'Run the audit'}
              </button>
              <button className="fp-btn" onClick={() => onTermsChange('')} disabled={!terms}><i className="fas fa-eraser"></i></button>
            </div>
            <div className="meta-line">{terms.length > 0 ? `${terms.length.toLocaleString()} characters staged` : 'Paste at least ~40 characters to analyze.'}</div>
          </div>
        )}

        {tab === 'file' && (
          <div>
            <div
              className={`dropzone${dragOver ? ' over' : ''}`}
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) readFile(f) }}
            >
              <i className="fas fa-cloud-arrow-up"></i>
              <div className="dz-label">Drop a <strong style={{ color: 'var(--inkD)' }}>.txt</strong>, <strong style={{ color: 'var(--inkD)' }}>.md</strong> or <strong style={{ color: 'var(--inkD)' }}>.pdf-as-text</strong> here</div>
              <div className="dz-sub">or click to browse — max 1 MB</div>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept=".txt,.md,.csv,.html,.pdf,.doc,.docx"
              style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { readFile(f); e.target.value = '' } }}
            />
            {file && (
              <div className="file-info">
                <i className="fas fa-file-lines"></i>
                <span>{file.name}</span>
                <span className="num" style={{ color: 'var(--faintD)' }}>{file.size.toLocaleString()}</span>
                <button onClick={() => { setFile(null); onTermsChange('') }} aria-label="Clear file"><i className="fas fa-xmark"></i></button>
              </div>
            )}
            {file && (
              <div className="action-row">
                <button className="fp-btn primary" onClick={onAnalyze} disabled={analyzing}>
                  <i className="fas fa-shield-halved"></i> Run the audit
                </button>
              </div>
            )}
            <div className={`meta-line ${urlStatus.t}`}>{urlStatus.m || 'Attach the document. It never leaves your machine.'}</div>
          </div>
        )}
      </div>

      <div className="docket-section">
        <div className="docket-head"><i className="fas fa-gavel"></i> Verdict <span className="flex1"></span><span className="micro" style={{ color: 'var(--red-bright)' }}>/* 2 */</span></div>
        <Scoreboard
          risk={props.risk}
          decision={props.decision}
          onDecision={props.onDecision}
          onReset={props.onReset}
        />
      </div>

      <div className="docket-section">
        <div className="docket-head"><i className="fas fa-qrcode"></i> Quick questions <span className="micro" style={{ color: 'var(--red-bright)' }}>/* 3 */</span></div>
        <div className="q-list">
          {prompts.map((p) => (
            <button key={p.q} className="q-item" onClick={() => props.onQuickQuestion(p.q)}>
              <i className={`fas ${p.icon}`}></i>
              <span>{p.q}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="docket-section">
        <div className="docket-head"><i className="fas fa-scale-balanced"></i> Rights on file</div>
        <div className="docket-rights">
          <div className="docket-right"><i className="fas fa-eye"></i> Right to information</div>
          <div className="docket-right"><i className="fas fa-hand"></i> Right to choose</div>
          <div className="docket-right"><i className="fas fa-heart-pulse"></i> Right to safety</div>
          <div className="docket-right"><i className="fas fa-shield-halved"></i> Right to privacy</div>
          <div className="docket-right"><i className="fas fa-receipt"></i> Right to redressal</div>
          <div className="docket-right"><i className="fas fa-file-contract"></i> Right to fair contract</div>
        </div>
      </div>
    </div>
  )
}