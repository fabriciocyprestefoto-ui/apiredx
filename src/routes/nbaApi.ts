/**
 * NBA — rotas no formato premium para o app de TV.
 *
 * GET /api/nba/games/today
 * GET /api/nba/games/upcoming
 * GET /api/nba/standings
 * GET /api/nba/teams
 * GET /api/nba/teams/:id
 * GET /api/nba/players/:id
 */

import { FastifyPluginAsync } from 'fastify'
import { cache, TTL } from '../cache'
import {
  scraperJogosNBAHoje,
  scraperProximosJogosNBA,
  scraperTabelaNBA,
} from '../scrapers/nba'
import {
  scraperNBAEnriquecido,
  scraperTimesNBABR,
  scraperNoticiasNBABR,
  scraperClassificacaoNBABR,
  scraperArtilhariaNA,
} from '../scrapers/nbaEnriquecido'
import axios from 'axios'
import { withRetry } from '../utils/retry'
import { logger } from '../utils/logger'

const ESPN_NBA = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba'
const H = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9',
}

// ─── Fetch NBA teams from ESPN ────────────────────────────────────────────────

async function fetchNBATeams() {
  try {
    const { data } = await withRetry(
      () => axios.get(`${ESPN_NBA}/teams?limit=50`, { headers: H, timeout: 10000 }),
      { retries: 2, label: 'espn:nba:teams' }
    )
    const sports = (data.sports ?? []) as Record<string, unknown>[]
    const leagues = (sports[0]?.leagues as Record<string, unknown>[]) ?? []
    const teams = (leagues[0]?.teams as Record<string, unknown>[]) ?? []
    return teams.map((t: Record<string, unknown>) => {
      const team = t.team as Record<string, unknown>
      const logos = (team.logos as Record<string, unknown>[]) ?? []
      return {
        id: String(team.id ?? ''),
        name: String(team.displayName ?? team.name ?? ''),
        shortName: String(team.abbreviation ?? ''),
        logo: (logos[0]?.href as string) ?? null,
        color: (team.color as string) ? `#${team.color}` : null,
        alternateColor: (team.alternateColor as string) ? `#${team.alternateColor}` : null,
        conference: null, // ESPN não retorna conferência nesta rota
        slug: String(team.slug ?? ''),
      }
    })
  } catch (e) {
    logger.error(`[nba:teams] ${e}`)
    return []
  }
}

// ─── Fetch NBA team detail ────────────────────────────────────────────────────

async function fetchNBATeamDetail(teamId: string) {
  try {
    const [teamRes, rosterRes] = await Promise.allSettled([
      withRetry(() => axios.get(`${ESPN_NBA}/teams/${teamId}`, { headers: H, timeout: 10000 }), { retries: 2, label: `espn:nba:team:${teamId}` }),
      withRetry(() => axios.get(`${ESPN_NBA}/teams/${teamId}/roster`, { headers: H, timeout: 10000 }), { retries: 2, label: `espn:nba:roster:${teamId}` }),
    ])

    let teamData: Record<string, unknown> = {}
    let squad: unknown[] = []

    if (teamRes.status === 'fulfilled') {
      const t = (teamRes.value.data?.team ?? teamRes.value.data) as Record<string, unknown>
      const logos = (t.logos as Record<string, unknown>[]) ?? []
      const venue = (t.franchise as Record<string, unknown>)?.venue as Record<string, unknown> | undefined
      teamData = {
        id: String(t.id ?? teamId),
        name: String(t.displayName ?? t.name ?? ''),
        shortName: String(t.abbreviation ?? ''),
        logo: (logos[0]?.href as string) ?? null,
        color: (t.color as string) ? `#${t.color}` : null,
        location: String(t.location ?? ''),
        venue: venue ? {
          name: String(venue.fullName ?? ''),
          capacity: Number(venue.capacity ?? 0),
        } : null,
        slug: String(t.slug ?? ''),
      }
    }

    if (rosterRes.status === 'fulfilled') {
      const athletes = (rosterRes.value.data?.athletes as Record<string, unknown>[]) ?? []
      squad = athletes.flatMap((group: Record<string, unknown>) => {
        const items = (group.items as Record<string, unknown>[]) ?? []
        return items.map((a: Record<string, unknown>) => {
          const pos = (a.position as Record<string, string> | undefined)
          const headshot = (a.headshot as Record<string, string> | undefined)
          return {
            id: String(a.id ?? ''),
            name: String(a.fullName ?? a.displayName ?? ''),
            jersey: (a.jersey as string) ?? null,
            position: pos?.abbreviation ?? null,
            photo: headshot?.href ?? null,
            age: (a.age as number) ?? null,
            nationality: null,
          }
        })
      })
    }

    return { ...teamData, squad }
  } catch (e) {
    logger.error(`[nba:team:${teamId}] ${e}`)
    return null
  }
}

// ─── Fetch NBA player detail ──────────────────────────────────────────────────

async function fetchNBAPlayer(playerId: string) {
  try {
    const { data } = await withRetry(
      () => axios.get(`${ESPN_NBA}/athletes/${playerId}`, { headers: H, timeout: 10000 }),
      { retries: 2, label: `espn:nba:player:${playerId}` }
    )
    const a = (data.athlete ?? data) as Record<string, unknown>
    const pos = (a.position as Record<string, string> | undefined)
    const headshot = (a.headshot as Record<string, string> | undefined)
    const team = (a.team as Record<string, unknown> | undefined)
    const logos = (team?.logos as Record<string, unknown>[]) ?? []
    const flag = (a.flag as Record<string, string> | undefined)
    return {
      id: String(a.id ?? playerId),
      name: String(a.fullName ?? a.displayName ?? ''),
      photo: headshot?.href ?? null,
      position: pos?.abbreviation ?? null,
      jersey: (a.jersey as string) ?? null,
      birthDate: (a.dateOfBirth as string) ?? null,
      age: (a.age as number) ?? null,
      height: (a.displayHeight as string) ?? null,
      weight: (a.displayWeight as string) ?? null,
      nationality: flag?.alt ?? null,
      currentTeam: team ? String(team.displayName ?? '') : null,
      teamLogo: (logos[0]?.href as string) ?? null,
      slug: (a.slug as string) ?? null,
    }
  } catch (e) {
    logger.error(`[nba:player:${playerId}] ${e}`)
    return null
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export const nbaApiRoutes: FastifyPluginAsync = async (app) => {

  // GET /api/nba/games/today
  app.get('/nba/games/today', async (_req, reply) => {
    const ck = 'nba:api:games:today'
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    const jogos = await scraperJogosNBAHoje()
    const data = jogos.map(j => ({
      id: j.id,
      sport: 'basketball',
      competition: 'NBA',
      homeTeam: { id: j.abreviacaoMandante, name: j.mandante, logo: j.logoMandante },
      awayTeam: { id: j.abreviacaoVisitante, name: j.visitante, logo: j.logoVisitante },
      date: j.data,
      time: j.horario,
      status: j.status === 'agendado' ? 'scheduled' : j.status === 'ao_vivo' ? 'live' : j.status === 'encerrado' ? 'finished' : 'scheduled',
      score: j.pontosMandante != null ? { home: j.pontosMandante, away: j.pontosVisitante } : null,
      period: j.periodo,
      clock: j.tempoRestante,
      venue: j.arena,
      city: j.cidade,
      broadcast: j.transmissoes.map(t => t.canal),
      leaders: j.destaques,
      updatedAt: new Date().toISOString(),
    }))

    cache.set(ck, data, TTL.JOGOS_HOJE)
    return reply.send({ success: true, data, total: data.length, cache: false, timestamp: new Date().toISOString() })
  })

  // GET /api/nba/games/upcoming
  app.get<{ Querystring: { days?: string } }>('/nba/games/upcoming', async (req, reply) => {
    const dias = Math.min(Number(req.query.days ?? 7), 30)
    const ck = `nba:api:games:upcoming:${dias}`
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    const jogos = await scraperProximosJogosNBA(dias)
    const data = jogos.map(j => ({
      id: j.id,
      sport: 'basketball',
      competition: 'NBA',
      homeTeam: { id: j.abreviacaoMandante, name: j.mandante, logo: j.logoMandante },
      awayTeam: { id: j.abreviacaoVisitante, name: j.visitante, logo: j.logoVisitante },
      date: j.data,
      time: j.horario,
      status: 'scheduled',
      broadcast: j.transmissoes.map(t => t.canal),
      updatedAt: new Date().toISOString(),
    }))

    cache.set(ck, data, TTL.TRANSMISSOES)
    return reply.send({ success: true, data, total: data.length, cache: false, timestamp: new Date().toISOString() })
  })

  // GET /api/nba/standings
  app.get('/nba/standings', async (_req, reply) => {
    const ck = 'nba:api:standings'
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    const { leste, oeste } = await scraperTabelaNBA()
    const data = {
      east: leste.map(p => ({
        position: p.posicao,
        team: p.time,
        logo: p.escudo,
        wins: p.vitorias,
        losses: p.derrotas,
        winPct: p.aproveitamento,
      })),
      west: oeste.map(p => ({
        position: p.posicao,
        team: p.time,
        logo: p.escudo,
        wins: p.vitorias,
        losses: p.derrotas,
        winPct: p.aproveitamento,
      })),
    }

    cache.set(ck, data, TTL.TABELA)
    return reply.send({ success: true, data, cache: false, timestamp: new Date().toISOString() })
  })

  // GET /api/nba/teams
  app.get('/nba/teams', async (_req, reply) => {
    const ck = 'nba:api:teams'
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    const teams = await fetchNBATeams()
    cache.set(ck, teams, TTL.TIMES)
    return reply.send({ success: true, data: teams, total: teams.length, cache: false, timestamp: new Date().toISOString() })
  })

  // GET /api/nba/teams/:id
  app.get<{ Params: { id: string } }>('/nba/teams/:id', async (req, reply) => {
    const { id } = req.params
    const ck = `nba:api:team:${id}`
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    const team = await fetchNBATeamDetail(id)
    if (!team) return reply.status(404).send({ success: false, error: 'Time NBA não encontrado' })

    cache.set(ck, team, TTL.ELENCO)
    return reply.send({ success: true, data: team, cache: false, timestamp: new Date().toISOString() })
  })

  // GET /api/nba/players/:id
  app.get<{ Params: { id: string } }>('/nba/players/:id', async (req, reply) => {
    const { id } = req.params
    const ck = `nba:api:player:${id}`
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    const player = await fetchNBAPlayer(id)
    if (!player) return reply.status(404).send({ success: false, error: 'Jogador NBA não encontrado' })

    cache.set(ck, player, TTL.ELENCO)
    return reply.send({ success: true, data: player, cache: false, timestamp: new Date().toISOString() })
  })

  // ── Endpoints enriquecidos com ESPN Brasil ──────────────────────────────────

  // GET /api/nba/enriquecido — pacote completo com times PT-BR + notícias + artilharia
  app.get('/nba/enriquecido', async (_req, reply) => {
    const ck = 'nba:enriquecido:full:v2'
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    const dados = await scraperNBAEnriquecido()
    cache.set(ck, dados, TTL.TABELA)
    return reply.send({ success: true, data: dados, cache: false, timestamp: new Date().toISOString() })
  })

  // GET /api/nba/times/br — todos os times NBA com nomes em português
  app.get('/nba/times/br', async (_req, reply) => {
    const ck = 'nba:times:br:v1'
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    const times = await scraperTimesNBABR()
    cache.set(ck, times, TTL.TIMES)
    return reply.send({ success: true, data: times, total: times.length, fonte: 'espn.com.br', cache: false, timestamp: new Date().toISOString() })
  })

  // GET /api/nba/noticias/br — notícias NBA em português do ESPN Brasil
  app.get<{ Querystring: { limit?: string } }>('/nba/noticias/br', async (req, reply) => {
    const limite = Math.min(Number(req.query.limit ?? 20), 50)
    const ck = `nba:noticias:br:${limite}:v1`
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    const noticias = await scraperNoticiasNBABR(limite)
    cache.set(ck, noticias, TTL.TRANSMISSOES)
    return reply.send({ success: true, data: noticias, total: noticias.length, fonte: 'espn.com.br/nba', cache: false, timestamp: new Date().toISOString() })
  })

  // GET /api/nba/classificacao/br — classificação com times em PT-BR
  app.get('/nba/classificacao/br', async (_req, reply) => {
    const ck = 'nba:classificacao:br:v1'
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    const [classificacaoBR, tabelaESPN] = await Promise.allSettled([
      scraperClassificacaoNBABR(),
      scraperTabelaNBA(),
    ])

    const br = classificacaoBR.status === 'fulfilled' ? classificacaoBR.value : { leste: [], oeste: [] }
    const espn = tabelaESPN.status === 'fulfilled' ? tabelaESPN.value : { leste: [], oeste: [] }

    // Mescla: usa ESPN como base, enriquece com nomes PT-BR do ESPN Brasil
    const mergeConferencia = (espnList: typeof espn.leste, brList: typeof br.leste) => {
      return espnList.map((entry, idx) => {
        const brEntry = brList.find(b => b.posicao === idx + 1) || brList[idx]
        return {
          posicao: entry.posicao,
          time: entry.time,
          nomePT: brEntry?.time || entry.time,
          abreviacao: brEntry?.abreviacao || '',
          logo: entry.escudo,
          vitorias: entry.vitorias,
          derrotas: entry.derrotas,
          winPct: entry.aproveitamento,
          gb: brEntry?.gb ?? null,
          conferencia: brEntry?.conferencia || (idx < 15 ? 'Leste' : 'Oeste'),
        }
      })
    }

    const data = {
      leste: mergeConferencia(espn.leste, br.leste),
      oeste: mergeConferencia(espn.oeste, br.oeste),
      fontes: br.leste.length ? ['site.api.espn.com', 'espn.com.br'] : ['site.api.espn.com'],
    }

    cache.set(ck, data, TTL.TABELA)
    return reply.send({ success: true, data, cache: false, timestamp: new Date().toISOString() })
  })

  // GET /api/nba/artilharia — líderes de pontos por jogo
  app.get('/nba/artilharia', async (_req, reply) => {
    const ck = 'nba:artilharia:v1'
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    const artilheiros = await scraperArtilhariaNA()
    cache.set(ck, artilheiros, TTL.ARTILHARIA)
    return reply.send({ success: true, data: artilheiros, total: artilheiros.length, fonte: 'site.api.espn.com', cache: false, timestamp: new Date().toISOString() })
  })
}
