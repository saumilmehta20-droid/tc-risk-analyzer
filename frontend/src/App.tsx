import { Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './components/LandingPage'
import ChatPage from './components/ChatPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/chat" element={<ChatPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}