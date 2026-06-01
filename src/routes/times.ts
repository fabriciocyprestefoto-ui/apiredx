import { FastifyPluginAsync } from 'fastify'
import { TIMES_BRASILEIROS } from '../data/times'
import { scraperElencoESPN, scraperJogosPorTimeESPN, ESPN_TEAM_IDS } from '../scrapers/espn'
import { getJogosPorTime } from '../services/jogosService'
import { cache, TTL } from '../cache'

function fotoAvatar(nome: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(nome)}&background=21262d&color=e6edf3&size=128&rounded=true&bold=true`
}

function normalizarFotosElenco(elenco: Array<{ nome: string; foto: string | null }>): Array<{ nome: string; foto: string | null }> {
  return elenco.map(j => {
    const foto = j.foto ?? ''
    return {
      ...j,
      foto: foto || fotoAvatar(j.nome),
    }
  })
}

export const timesRoutes: FastifyPluginAsync = async (app) => {
  app.get('/times', async (_req, reply) => {
    return reply.send({ success: true, data: TIMES_BRASILEIROS, total: TIMES_BRASILEIROS.length, timestamp: new Date().toISOString() })
  })

  app.get<{ Params: { slug: string } }>('/times/:slug', async (req, reply) => {
    const { slug } = req.params
    const time = TIMES_BRASILEIROS.find(t => t.slug === slug)
    if (!time) return reply.status(404).send({ success: false, error: 'Time não encontrado' })

    const ck = `time:${slug}`
    const cached = cache.get(ck)
    if (cached) {
      const data = cached as Record<string, unknown>
      const elenco = normalizarFotosElenco((data.elenco as Array<{ nome: string; foto: string | null }>) ?? [])
      return reply.send({ success: true, data: { ...data, elenco }, cache: true, timestamp: new Date().toISOString() })
    }

    const espnId = ESPN_TEAM_IDS[slug]
    const { jogos } = await getJogosPorTime(slug)

    const [elenco, { proximos, resultados }] = await Promise.all([
      espnId ? scraperElencoESPN(espnId) : Promise.resolve([]),
      espnId ? scraperJogosPorTimeESPN(espnId) : Promise.resolve({ proximos: [], resultados: [] }),
    ])

    const detalhado = {
      ...time,
      elenco: normalizarFotosElenco(elenco),
      jogosHoje: jogos,
      proximosJogos: proximos,
      ultimosJogos: resultados,
    }
    cache.set(ck, detalhado, TTL.ELENCO)
    return reply.send({ success: true, data: detalhado, cache: false, timestamp: new Date().toISOString() })
  })

  app.get<{ Params: { slug: string } }>('/times/:slug/elenco', async (req, reply) => {
    const { slug } = req.params
    const time = TIMES_BRASILEIROS.find(t => t.slug === slug)
    if (!time) return reply.status(404).send({ success: false, error: 'Time não encontrado' })

    const ck = `elenco:${slug}`
    const cached = cache.get(ck)
    if (cached) {
      const data = normalizarFotosElenco((cached as Array<{ nome: string; foto: string | null }>) ?? [])
      return reply.send({ success: true, data, cache: true, timestamp: new Date().toISOString() })
    }

    const espnId = ESPN_TEAM_IDS[slug]
    const elenco = espnId ? await scraperElencoESPN(espnId) : []
    const normalizado = normalizarFotosElenco(elenco)
    cache.set(ck, normalizado, TTL.ELENCO)
    return reply.send({ success: true, data: normalizado, total: normalizado.length, cache: false, timestamp: new Date().toISOString() })
  })
}
