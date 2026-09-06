import { useState } from 'react'
import { Link } from 'react-router-dom'

interface NavbarProps {
  dark?: boolean
  onNavigate?: (id: string) => void
  onStart?: () => void
}

export default function Navbar({ dark = false, onNavigate, onStart }: NavbarProps) {
  const [open, setOpen] = useState(false)

  const go = (id: string) => {
    setOpen(false)
    onNavigate?.(id)
  }

  return (
    <nav className={`nav${dark ? ' dark' : ''}`}>
      <div className="container nav-inner">
        <Link to="/" className="wordmark">
          A<span className="mark">//</span>Fineprint
        </Link>
        {!dark && (
          <>
            <div className="nav-links">
              <a onClick={() => go('capabilities')}>Capabilities</a>
              <a onClick={() => go('process')}>Process</a>
              <a onClick={() => go('rights')}>Your rights</a>
              <button className="btn btn-red" onClick={onStart}>Open the analyzer</button>
            </div>
            <button className="hamb" onClick={() => setOpen(!open)} aria-label="Menu">
              <i className={`fas ${open ? 'fa-times' : 'fa-bars'}`}></i>
            </button>
          </>
        )}
      </div>
      {!dark && open && (
        <div className="mobile-menu">
          <a onClick={() => go('capabilities')}>Capabilities</a>
          <a onClick={() => go('process')}>Process</a>
          <a onClick={() => go('rights')}>Your rights</a>
          <a onClick={onStart}>Open the analyzer</a>
        </div>
      )}
    </nav>
  )
}