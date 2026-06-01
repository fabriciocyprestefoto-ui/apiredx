import { logger } from './logger'

export async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 2, baseDelayMs = 600, label = '' }: { retries?: number; baseDelayMs?: number; label?: string } = {}
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (e) {
      lastError = e
      if (attempt < retries) {
        const delay = baseDelayMs * Math.pow(2, attempt)
        logger.warn(`[retry] ${label} tentativa ${attempt + 1} falhou — aguardando ${delay}ms`)
        await new Promise(r => setTimeout(r, delay))
      }
    }
  }
  throw lastError
}
