import fs from 'fs'
import path from 'path'

interface CacheEntry<T> { data: T; expiresAt: number }

// Na Vercel o filesystem é read-only exceto /tmp
const CACHE_FILE = process.env.VERCEL
  ? '/tmp/.cache.json'
  : path.join(process.cwd(), '.cache.json')

class LocalCache {
  private store = new Map<string, CacheEntry<unknown>>()

  constructor() { this.restore() }

  set<T>(key: string, data: T, ttlSeconds: number): void {
    this.store.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 })
    this.persist()
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) { this.store.delete(key); return null }
    return entry.data as T
  }

  delete(key: string): void { this.store.delete(key); this.persist() }
  clear(): void { this.store.clear(); this.persist() }
  keys(): string[] { return Array.from(this.store.keys()) }

  private persist(): void {
    const obj: Record<string, CacheEntry<unknown>> = {}
    for (const [k, v] of this.store) obj[k] = v
    fs.writeFile(CACHE_FILE, JSON.stringify(obj), 'utf8', () => {})
  }

  private restore(): void {
    try {
      if (!fs.existsSync(CACHE_FILE)) return
      const raw = fs.readFileSync(CACHE_FILE, 'utf8')
      const obj = JSON.parse(raw) as Record<string, CacheEntry<unknown>>
      const now = Date.now()
      for (const [k, v] of Object.entries(obj)) {
        if (v.expiresAt > now) this.store.set(k, v)
      }
    } catch { /* arquivo corrompido ou ausente — ignora */ }
  }
}

export const cache = new LocalCache()
export const TTL = {
  JOGOS_HOJE: 5 * 60,
  TRANSMISSOES: 30 * 60,
  TABELA: 60 * 60,
  ARTILHARIA: 60 * 60,
  ELENCO: 24 * 60 * 60,
  TIMES: 24 * 60 * 60,
  CAMPEONATOS: 6 * 60 * 60,
  CONTEUDOS: 15 * 60,
} as const
