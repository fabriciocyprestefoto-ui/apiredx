/**
 * Copa do Mundo 2026 — rotas no formato novo.
 *
 * GET /api/world-cup/2026
 * GET /api/world-cup/2026/teams
 * GET /api/world-cup/2026/groups
 * GET /api/world-cup/2026/matches
 * GET /api/world-cup/2026/stadiums
 * GET /api/world-cup/2006
 */

import { FastifyPluginAsync } from 'fastify'
import { cache, TTL } from '../cache'
import {
  INFO_COPA_MUNDO_2026,
  SEDES_COPA_MUNDO_2026,
  SELECOES_COPA_MUNDO_2026,
} from '../data/copaMundo'
import { COPA_MUNDO_2006 } from '../data/copaMundo2006'
import { scraperProximosJogosLiga } from '../scrapers/futebolInternacional'

// ─── Grupos simulados (sorteio Copa 2026 — atualizar quando FIFA divulgar) ────

const GRUPOS_2026 = [
  { grupo: 'A', selecoes: ['Estados Unidos', 'Inglaterra', 'Panamá', 'Arábia Saudita'] },
  { grupo: 'B', selecoes: ['Espanha', 'Croácia', 'Marrocos', 'Japão'] },
  { grupo: 'C', selecoes: ['Argentina', 'Polônia', 'Peru', 'Nova Zelândia'] },
  { grupo: 'D', selecoes: ['França', 'Áustria', 'Camarões', 'Austrália'] },
  { grupo: 'E', selecoes: ['Brasil', 'México', 'Suíça', 'Egito'] },
  { grupo: 'F', selecoes: ['Alemanha', 'Bélgica', 'Costa Rica', 'Gana'] },
  { grupo: 'G', selecoes: ['Portugal', 'Turquia', 'Senegal', 'Coreia do Sul'] },
  { grupo: 'H', selecoes: ['Holanda', 'Dinamarca', 'Equador', 'Tunísia'] },
  { grupo: 'I', selecoes: ['Canadá', 'Uruguai', 'Congo RD', 'China'] },
  { grupo: 'J', selecoes: ['Itália', 'Noruega', 'Colômbia', 'Argélia'] },
  { grupo: 'K', selecoes: ['Inglaterra', 'Eslovênia', 'Nigéria', 'Cuba'] },
  { grupo: 'L', selecoes: ['Paraguai', 'República Checa', 'Camarões', 'Catar'] },
]

// Enriquece seleções com bandeiras e dados dos dados semente
function enriquecerSelecao(pais: string) {
  const seed = SELECOES_COPA_MUNDO_2026.find(s => s.pais === pais)
  return {
    pais,
    bandeira: seed?.bandeira ?? '🏳️',
    confederacao: seed?.confederacao ?? 'N/A',
    ranking: seed?.ranking ?? null,
    pote: seed?.pote ?? null,
  }
}

export const worldCup2026Routes: FastifyPluginAsync = async (app) => {
  app.get('/world-cup/2006', async (_req, reply) => {
    return reply.send({
      success: true,
      data: COPA_MUNDO_2006,
      timestamp: new Date().toISOString(),
    })
  })

  // GET /api/world-cup/2026 — info geral
  app.get('/world-cup/2026', async (_req, reply) => {
    return reply.send({
      success: true,
      data: {
        nome: 'Copa do Mundo FIFA 2026',
        edicao: INFO_COPA_MUNDO_2026.edicao,
        ano: INFO_COPA_MUNDO_2026.ano,
        paises: INFO_COPA_MUNDO_2026.paises,
        bandeiras: INFO_COPA_MUNDO_2026.bandeiras,
        selecoesParticipantes: INFO_COPA_MUNDO_2026.selecoesParticipantes,
        totalJogos: INFO_COPA_MUNDO_2026.totalJogos,
        inicio: INFO_COPA_MUNDO_2026.inicio,
        fim: INFO_COPA_MUNDO_2026.fim,
        mascote: INFO_COPA_MUNDO_2026.mascote,
        bola: INFO_COPA_MUNDO_2026.bola,
        totalSelecoesClassificadas: SELECOES_COPA_MUNDO_2026.length,
        totalSedes: SEDES_COPA_MUNDO_2026.length,
        grupos: GRUPOS_2026.length,
      },
      timestamp: new Date().toISOString(),
    })
  })

  // GET /api/world-cup/2026/teams — seleções classificadas
  app.get('/world-cup/2026/teams', async (_req, reply) => {
    const teams = SELECOES_COPA_MUNDO_2026.map(s => ({
      id: s.pais.toLowerCase().replace(/\s+/g, '-'),
      name: s.pais,
      flag: s.bandeira,
      confederation: s.confederacao,
      ranking: s.ranking,
      pot: s.pote,
    }))
    return reply.send({
      success: true,
      data: teams,
      total: teams.length,
      timestamp: new Date().toISOString(),
    })
  })

  // GET /api/world-cup/2026/groups — grupos (sorteio estimado)
  app.get('/world-cup/2026/groups', async (_req, reply) => {
    const groups = GRUPOS_2026.map(g => ({
      group: g.grupo,
      teams: g.selecoes.map(enriquecerSelecao),
    }))
    return reply.send({
      success: true,
      data: groups,
      total: groups.length,
      note: 'Grupos estimados — atualizar após sorteio oficial da FIFA',
      timestamp: new Date().toISOString(),
    })
  })

  // GET /api/world-cup/2026/matches — jogos via ESPN (quando disponíveis) + fallback
  app.get('/world-cup/2026/matches', async (_req, reply) => {
    const ck = 'world-cup:2026:matches'
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    const jogos = await scraperProximosJogosLiga('copa-do-mundo', 60).catch(() => [])

    const normalized = jogos.map(j => ({
      id: j.id,
      homeTeam: { name: j.mandante, logo: j.escudoMandante },
      awayTeam: { name: j.visitante, logo: j.escudoVisitante },
      date: j.data,
      time: j.horario,
      venue: j.estadio,
      city: j.cidade,
      status: j.status,
      score: j.placarMandante != null ? { home: j.placarMandante, away: j.placarVisitante } : null,
      broadcast: j.transmissoes.map(t => t.canal),
    }))

    cache.set(ck, normalized, TTL.CAMPEONATOS)
    return reply.send({
      success: true,
      data: normalized,
      total: normalized.length,
      note: normalized.length === 0 ? 'Copa 2026 começa em junho/2026 — jogos serão disponibilizados em breve' : undefined,
      cache: false,
      timestamp: new Date().toISOString(),
    })
  })

  // GET /api/world-cup/2026/stadiums — estádios/sedes
  app.get('/world-cup/2026/stadiums', async (_req, reply) => {
    const stadiums = SEDES_COPA_MUNDO_2026.map((s, idx) => ({
      id: `wc2026-stadium-${idx + 1}`,
      city: s.cidade,
      country: s.pais,
      name: s.estadio,
      capacity: s.capacidade,
      scheduledMatches: s.jogosPrevistos,
    }))
    return reply.send({
      success: true,
      data: stadiums,
      total: stadiums.length,
      countries: ['EUA', 'Canadá', 'México'],
      timestamp: new Date().toISOString(),
    })
  })
}
