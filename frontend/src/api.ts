import type { ApiResponse, FetchUrlResult } from './types'

export async function analyzeTerms(terms: string): Promise<ApiResponse> {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ terms })
  })
  return res.json()
}

export async function sendChatMessage(
  message: string,
  history: { role: string; content: string }[],
  termsContext: string
): Promise<ApiResponse> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      history: history.slice(-10),
      termsContext
    })
  })
  return res.json()
}

export async function fetchUrl(url: string): Promise<FetchUrlResult> {
  const res = await fetch('/api/fetch-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  })
  return res.json()
}