/**
 * Gemini REST yardımcısı — sunucu ve scriptler için ortak (Next'e bağımlı değil).
 * Anahtar her zaman `x-goog-api-key` başlığında gider; URL'de asla.
 */

export interface GeminiPart {
  text?: string
  inline_data?: { mime_type: string; data: string }
}

export interface GeminiJsonOptions {
  models?: string[]
  timeoutMs?: number
  temperature?: number
  apiKey?: string
}

// Model başına ücretsiz kota ayrıdır; ilk model 429 verirse sıradaki denenir
export const GEMINI_TEXT_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.8-flash']
export const GEMINI_VISION_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.8-flash']

export class GeminiError extends Error {
  constructor(message: string, public status?: number) {
    super(message)
    this.name = 'GeminiError'
  }
}

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    const m = text.match(/```json([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/)
    if (!m) throw new GeminiError('Gemini yanıtı JSON değil')
    return JSON.parse(m[1] || m[0])
  }
}

/** JSON modunda tek istek; modeller sırayla denenir, zaman aşımında GeminiError fırlatır. */
export async function geminiJson<T = unknown>(parts: GeminiPart[], opts: GeminiJsonOptions = {}): Promise<T> {
  const apiKey = (opts.apiKey ?? process.env.GEMINI_API_KEY)?.trim()
  if (!apiKey) throw new GeminiError('GEMINI_API_KEY tanımlı değil')
  const models = opts.models ?? GEMINI_TEXT_MODELS
  const timeoutMs = opts.timeoutMs ?? 8000
  let lastError: GeminiError | null = null

  for (const model of models) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { response_mime_type: 'application/json', temperature: opts.temperature ?? 0.1 },
        }),
        signal: ctrl.signal,
      })
      if (!res.ok) {
        lastError = new GeminiError(`Gemini ${model}: HTTP ${res.status}`, res.status)
        // Kota (429) veya yetki (403) hatasında diğer model de aynı anahtarı kullanır; yine de dene
        continue
      }
      const data: any = await res.json()
      const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) {
        lastError = new GeminiError(`Gemini ${model}: boş yanıt`)
        continue
      }
      return extractJson(text) as T
    } catch (e: any) {
      lastError = e instanceof GeminiError ? e : new GeminiError(e?.name === 'AbortError' ? `Gemini ${model}: zaman aşımı` : String(e?.message || e))
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError ?? new GeminiError('Gemini yanıt vermedi')
}
