/**
 * Lutas / MMA / UFC — rotas premium para o app de TV.
 *
 * GET /api/fights/events
 * GET /api/fights/events/upcoming
 * GET /api/fights/events/:id
 * GET /api/fights/fighters/:id
 */

import { FastifyPluginAsync } from 'fastify'
import { cache, TTL } from '../cache'
import { scraperUFCProximos, scraperUFCCalendario, scraperEventoUFC } from '../scrapers/ufc'
import { EventoUFC } from '../types'
import axios from 'axios'
import { withRetry } from '../utils/retry'
import { logger } from '../utils/logger'

const ESPN_MMA = 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc'
const H = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9',
}

function normalizeEvento(ev: EventoUFC) {
  const luta = ev.lutaPrincipal
  return {
    id: ev.id,
    sport: 'mma',
    name: ev.nome,
    nickname: ev.apelido,
    date: ev.data,
    time: ev.horario,
    venue: ev.local,
    city: ev.cidade,
    country: ev.pais,
    status: ev.status === 'agendado' ? 'scheduled' : ev.status === 'ao_vivo' ? 'live' : 'finished',
    mainEvent: luta ? {
      fighter1: {
        id: luta.lutador1.id,
        name: luta.lutador1.nome,
        nickname: luta.lutador1.apelido,
        country: luta.lutador1.pais,
        flag: luta.lutador1.bandeira,
        record: luta.lutador1.cartel,
        photo: luta.lutador1.foto,
      },
      fighter2: {
        id: luta.lutador2.id,
        name: luta.lutador2.nome,
        nickname: luta.lutador2.apelido,
        country: luta.lutador2.pais,
        flag: luta.lutador2.bandeira,
        record: luta.lutador2.cartel,
        photo: luta.lutador2.foto,
      },
      weightClass: luta.categoria,
      rounds: luta.rounds,
      winner: luta.vencedor,
      method: luta.metodo,
    } : null,
    card: ev.lutas.map(l => ({
      id: l.id,
      weightClass: l.categoria,
      rounds: l.rounds,
      fighter1: {
        name: l.lutador1.nome,
        nickname: l.lutador1.apelido,
        record: l.lutador1.cartel,
        photo: l.lutador1.foto,
        country: l.lutador1.pais,
      },
      fighter2: {
        name: l.lutador2.nome,
        nickname: l.lutador2.apelido,
        record: l.lutador2.cartel,
        photo: l.lutador2.foto,
        country: l.lutador2.pais,
      },
      winner: l.vencedor,
      method: l.metodo,
      status: l.status,
    })),
    broadcast: ev.transmissoes.map(t => t.canal),
    updatedAt: new Date().toISOString(),
  }
}

// Busca detalhes de um lutador via ESPN athletes endpoint
async function fetchFighter(athleteId: string) {
  try {
    const { data } = await withRetry(
      () => axios.get(`${ESPN_MMA}/athletes/${athleteId}`, { headers: H, timeout: 10000 }),
      { retries: 2, label: `espn:ufc:fighter:${athleteId}` }
    )
    const a = (data.athlete ?? data) as Record<string, unknown>
    const flag = (a.flag as Record<string, string> | undefined)
    const headshot = (a.headshot as Record<string, string> | undefined)
    const records = (a.records as Record<string, unknown>[]) ?? []
    const stats = (a.statistics as Record<string, unknown>[]) ?? []

    return {
      id: String(a.id ?? athleteId),
      name: String(a.fullName ?? a.displayName ?? ''),
      nickname: (a.nickname as string) ?? null,
      photo: headshot?.href ?? null,
      country: flag?.alt ?? null,
      flag: flag?.href ?? null,
      birthDate: (a.dateOfBirth as string) ?? null,
      age: (a.age as number) ?? null,
      height: (a.displayHeight as string) ?? null,
      weight: (a.displayWeight as string) ?? null,
      reach: null,
      stance: null,
      record: String(records[0]?.summary ?? ''),
      weightClass: (a.weightClass as string) ?? null,
      ranking: (a.ranking as number) ?? null,
      stats: stats.slice(0, 5).map((s: Record<string, unknown>) => ({
        name: String(s.displayName ?? s.name ?? ''),
        value: String(s.displayValue ?? s.value ?? ''),
      })),
    }
  } catch (e) {
    logger.error(`[ufc:fighter:${athleteId}] ${e}`)
    return null
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export const fightsApiRoutes: FastifyPluginAsync = async (app) => {

  // GET /api/fights/events — próximo evento (ao vivo ou mais próximo)
  app.get('/fights/events', async (_req, reply) => {
    const ck = 'fights:events:current'
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    const eventos = await scraperUFCProximos().catch(() => [] as EventoUFC[])
    const data = eventos.map(normalizeEvento)
    cache.set(ck, data, TTL.JOGOS_HOJE)
    return reply.send({ success: true, data, total: data.length, cache: false, timestamp: new Date().toISOString() })
  })

  // GET /api/fights/events/upcoming — calendário completo
  app.get('/fights/events/upcoming', async (_req, reply) => {
    const ck = 'fights:events:upcoming'
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    const eventos = await scraperUFCCalendario().catch(() => [] as EventoUFC[])
    const data = eventos.map(normalizeEvento)
    cache.set(ck, data, TTL.CAMPEONATOS)
    return reply.send({ success: true, data, total: data.length, cache: false, timestamp: new Date().toISOString() })
  })

  // GET /api/fights/events/:id — evento específico com card completo
  app.get<{ Params: { id: string } }>('/fights/events/:id', async (req, reply) => {
    const { id } = req.params
    const ck = `fights:event:${id}`
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    const evento = await scraperEventoUFC(id).catch(() => null)
    if (!evento) return reply.status(404).send({ success: false, error: 'Evento não encontrado' })

    const data = normalizeEvento(evento)
    cache.set(ck, data, TTL.JOGOS_HOJE)
    return reply.send({ success: true, data, cache: false, timestamp: new Date().toISOString() })
  })

  // GET /api/fights/fighters/:id — perfil de lutador
  app.get<{ Params: { id: string } }>('/fights/fighters/:id', async (req, reply) => {
    const { id } = req.params
    const ck = `fights:fighter:${id}`
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    const fighter = await fetchFighter(id)
    if (!fighter) return reply.status(404).send({ success: false, error: 'Lutador não encontrado' })

    cache.set(ck, fighter, TTL.ELENCO)
    return reply.send({ success: true, data: fighter, cache: false, timestamp: new Date().toISOString() })
  })
}
