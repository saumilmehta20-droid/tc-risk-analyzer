import { Component, type ReactNode } from 'react'

export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ fontFamily: 'var(--mono)', color: '#FF5635', background: '#131110', minHeight: '100vh', padding: 48, lineHeight: 1.6 }}>
          <div style={{ fontSize: 14, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Interface error</div>
          <pre style={{ marginTop: 16, color: '#EDE7DD', whiteSpace: 'pre-wrap' }}>{String(this.state.error)}</pre>
          <button
            onClick={() => { this.setState({ error: null }); window.location.hash = '' }}
            style={{ marginTop: 24, background: '#E0381E', color: '#fff', border: 'none', padding: '10px 20px', cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}