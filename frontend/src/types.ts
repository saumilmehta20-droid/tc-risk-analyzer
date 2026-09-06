export interface RiskData {
  score: number
  level: string
  verdict: string
  verdict_color: string
  recommendation: string
  breakdown: {
    high_risk_clauses: number
    medium_risk_clauses: number
    future_risks: number
    total_text_length: number
    word_count: number
  }
}

export interface ApiResponse {
  response: string
  mode: string
  risk?: RiskData | null
  error?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface FetchUrlResult {
  terms?: string
  url?: string
  title?: string
  length?: number
  error?: string
}