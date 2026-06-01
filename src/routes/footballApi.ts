/**
 * Rotas padronizadas para futebol — formato premium para o app de TV.
 *
 * GET /api/football/matches/today
 * GET /api/football/matches/upcoming
 * GET /api/football/matches/live
 * GET /api/football/matches/recent
 * GET /api/football/competitions
 * GET /api/football/competitions/:id/standings
 * GET /api/football/competitions/:id/matches
 * GET /api/football/teams
 * GET /api/football/teams/:id
 * GET /api/football/teams/:id/squad
 */

import { FastifyPluginAsync } from 'fastify'
import { cache, TTL } from '../cache'
import { getJogosHoje } from '../services/jogosService'
import {
  scraperJogosLigaHoje,
  scraperProximosJogosLiga,
  scraperTabelaLiga,
  LIGAS_INTERNACIONAIS,
} from '../scrapers/futebolInternacional'
import { scraperTabelaESPN, scraperArtilhariaESPN, scraperProximosJogosESPN, scraperJogosRecentesESPN, scraperElencoESPN, scraperJogosPorTimeESPN, ESPN_LEAGUE_IDS, ESPN_TEAM_IDS } from '../scrapers/espn'
import { scraperNoticiasEsporte } from '../scrapers/noticias'
import { scraperArtilharia as scraperArtilhariaGE } from '../scrapers/tabela'
import { anexarMelhoresMomentos } from '../scrapers/videosGE'
import { TIMES_BRASILEIROS } from '../data/times'
import { TIMES_ENRIQUECIDOS } from '../data/timesEnriquecidos'
import { buscarClubeBrasileirao2026 } from '../data/brasileirao2026'
import { buscarClubeTransfermarkt, scraperElencoTransfermarkt } from '../scrapers/transfermarkt'
import { CAMPEONATOS } from '../data/campeonatos'
import { Jogo, NoticiaEsporte } from '../types'

function hojeISO(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}

function mapStatus(s: string): string {
  const m: Record<string, string> = {
    agendado: 'scheduled', ao_vivo: 'live', encerrado: 'finished',
    adiado: 'postponed', cancelado: 'cancelled',
  }
  return m[s] ?? 'scheduled'
}

function normalizeMatch(j: Jogo) {
  return {
    id: j.id,
    sport: 'football',
    competition: j.campeonato,
    homeTeam: {
      id: j.id + '-home',
      name: j.mandante,
      logo: j.escudoMandante,
    },
    awayTeam: {
      id: j.id + '-away',
      name: j.visitante,
      logo: j.escudoVisitante,
    },
    date: j.data,
    time: j.horario,
    status: mapStatus(j.status),
    score: (j.placarMandante != null || j.placarVisitante != null)
      ? { home: j.placarMandante, away: j.placarVisitante }
      : null,
    venue: j.estadio,
    city: j.cidade,
    broadcast: j.transmissoes.map(t => t.canal),
    broadcasts: j.transmissoes,
    transmissoes: j.transmissoes,
    melhoresMomentos: j.melhoresMomentos ?? [],
    updatedAt: new Date().toISOString(),
  }
}

function filtrarNoticiasRelacionadas(noticias: NoticiaEsporte[], termos: string[], limite = 8): NoticiaEsporte[] {
  const normalizados = termos
    .map(t => t.toLowerCase().trim())
    .filter(Boolean)

  if (!normalizados.length) return []

  return noticias
    .filter(noticia => {
      const alvo = `${noticia.titulo} ${noticia.resumo ?? ''} ${noticia.url}`.toLowerCase()
      return normalizados.some(termo => alvo.includes(termo))
    })
    .slice(0, limite)
}

function chavePessoa(nome: string): string {
  return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function normalizarElencoTransfermarkt(id: string, elenco: Awaited<ReturnType<typeof scraperElencoTransfermarkt>>) {
  return elenco.map(j => ({
    id: j.id || `${id}-tm-${j.slug}`,
    nome: j.nome,
    posicao: j.posicao,
    numero: j.numero,
    nacionalidade: j.nacionalidade,
    idade: j.idade,
    foto: j.foto,
    fotoReal: Boolean(j.foto),
    perfilUrl: j.perfilUrl,
    valorMercado: j.valorMercado,
    fonte: 'transfermarkt',
  }))
}

async function scraperArtilhariaEnriquecida() {
  const [espn, ge] = await Promise.all([
    scraperArtilhariaESPN().catch(() => []),
    scraperArtilhariaGE('brasileirao-serie-a').catch(() => []),
  ])

  const geComFotos = ge.filter(a => a.foto).length
  if (ge.length && geComFotos >= Math.max(3, Math.floor(ge.length * 0.6))) {
    return ge
  }

  const fotosGE = new Map(ge.filter(a => a.foto).map(a => [chavePessoa(a.jogador), a]))

  if (!espn.length) return ge

  return espn.map(artilheiro => {
    const geItem = fotosGE.get(chavePessoa(artilheiro.jogador))
    if (!geItem?.foto || artilheiro.fotoReal) return artilheiro
    return {
      ...artilheiro,
      foto: geItem.foto,
      fotoReal: true,
      fonteFoto: 'ge.globo',
    }
  })
}

// Todas as ligas disponíveis (BR + internacional)
const ALL_COMPETITIONS = [
  // Brasileiras
  { id: 'brasileirao-serie-a', name: 'Brasileirão Série A', country: 'Brasil', type: 'league', logo: null },
  { id: 'brasileirao-serie-b', name: 'Brasileirão Série B', country: 'Brasil', type: 'league', logo: null },
  { id: 'copa-do-brasil', name: 'Copa do Brasil', country: 'Brasil', type: 'cup', logo: null },
  { id: 'libertadores', name: 'Copa Libertadores', country: 'América do Sul', type: 'continental', logo: null },
  { id: 'sul-americana', name: 'Copa Sul-Americana', country: 'América do Sul', type: 'continental', logo: null },
  // Internacionais
  ...LIGAS_INTERNACIONAIS.map(l => ({
    id: l.slug,
    name: l.nome,
    country: l.pais,
    type: 'league',
    logo: null,
  })),
]

export const footballApiRoutes: FastifyPluginAsync = async (app) => {

  // GET /api/football/matches/today
  app.get('/football/matches/today', async (_req, reply) => {
    const hoje = hojeISO()
    const ck = `football:matches:today:${hoje}`
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    const items: ReturnType<typeof normalizeMatch>[] = []

    // Brasileirão
    const { jogos } = await getJogosHoje().catch(() => ({ jogos: [] as Jogo[] }))
    for (const j of jogos.filter(j => j.data === hoje)) items.push(normalizeMatch(j))

    // Internacional
    const intResults = await Promise.allSettled(
      LIGAS_INTERNACIONAIS.filter(l => l.ativo).map(l => scraperJogosLigaHoje(l.slug, hoje))
    )
    for (const r of intResults) {
      if (r.status === 'fulfilled') for (const j of r.value) items.push(normalizeMatch(j))
    }

    items.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
    cache.set(ck, items, TTL.JOGOS_HOJE)
    return reply.send({ success: true, data: items, total: items.length, cache: false, timestamp: new Date().toISOString() })
  })

  // GET /api/football/matches/live
  app.get('/football/matches/live', async (_req, reply) => {
    const hoje = hojeISO()
    const ck = `football:matches:live:${hoje}`
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    const items: ReturnType<typeof normalizeMatch>[] = []
    const { jogos } = await getJogosHoje().catch(() => ({ jogos: [] as Jogo[] }))
    for (const j of jogos.filter(j => j.status === 'ao_vivo')) items.push(normalizeMatch(j))

    const intResults = await Promise.allSettled(
      LIGAS_INTERNACIONAIS.filter(l => l.ativo).map(l => scraperJogosLigaHoje(l.slug, hoje))
    )
    for (const r of intResults) {
      if (r.status === 'fulfilled') {
        for (const j of r.value.filter(j => j.status === 'ao_vivo')) items.push(normalizeMatch(j))
      }
    }

    cache.set(ck, items, 60) // 60s
    return reply.send({ success: true, data: items, total: items.length, cache: false, timestamp: new Date().toISOString() })
  })

  // GET /api/football/matches/upcoming
  app.get<{ Querystring: { days?: string } }>('/football/matches/upcoming', async (req, reply) => {
    const dias = Math.min(Number(req.query.days ?? 7), 30)
    const ck = `football:matches:upcoming:${dias}`
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    const items: ReturnType<typeof normalizeMatch>[] = []
    const [brProx, intResults] = await Promise.allSettled([
      scraperProximosJogosESPN(dias),
      Promise.allSettled(
        LIGAS_INTERNACIONAIS.filter(l => l.ativo).map(l => scraperProximosJogosLiga(l.slug, dias))
      ),
    ])

    if (brProx.status === 'fulfilled') {
      for (const j of brProx.value) items.push(normalizeMatch(j))
    }
    if (intResults.status === 'fulfilled') {
      for (const r of intResults.value) {
        if (r.status === 'fulfilled') for (const j of r.value) items.push(normalizeMatch(j))
      }
    }

    items.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.time ?? '').localeCompare(b.time ?? ''))
    cache.set(ck, items, TTL.TRANSMISSOES)
    return reply.send({ success: true, data: items, total: items.length, cache: false, timestamp: new Date().toISOString() })
  })

  // GET /api/football/matches/recent
  app.get('/football/matches/recent', async (_req, reply) => {
    const ck = 'football:matches:recent:videos:v3'
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    const jogosRecentes = await scraperJogosRecentesESPN(14).catch(() => [])
    const recentes = (await anexarMelhoresMomentos(jogosRecentes).catch(() => jogosRecentes)).map(normalizeMatch)
    cache.set(ck, recentes, TTL.TABELA)
    return reply.send({ success: true, data: recentes, total: recentes.length, cache: false, timestamp: new Date().toISOString() })
  })

  // GET /api/football/competitions
  app.get('/football/competitions', async (_req, reply) => {
    return reply.send({ success: true, data: ALL_COMPETITIONS, total: ALL_COMPETITIONS.length, timestamp: new Date().toISOString() })
  })

  // GET /api/football/competitions/:id/standings
  app.get<{ Params: { id: string } }>('/football/competitions/:id/standings', async (req, reply) => {
    const { id } = req.params
    const ck = `football:comp:${id}:standings`
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    let tabela: unknown[] = []

    // Tentar liga brasileira
    const espnCode = ESPN_LEAGUE_IDS[id]
    if (espnCode) {
      tabela = await scraperTabelaESPN(espnCode).catch(() => [])
    } else {
      // Ligas internacionais
      tabela = await scraperTabelaLiga(id).catch(() => [])
    }

    cache.set(ck, tabela, TTL.TABELA)
    return reply.send({ success: true, data: tabela, total: (tabela as []).length, competition: id, cache: false, timestamp: new Date().toISOString() })
  })

  // GET /api/football/competitions/:id/top-scorers
  app.get<{ Params: { id: string } }>('/football/competitions/:id/top-scorers', async (req, reply) => {
    const { id } = req.params
    if (id !== 'brasileirao-serie-a') {
      return reply.send({
        success: true,
        data: [],
        total: 0,
        competition: id,
        message: 'Artilharia disponivel no momento para brasileirao-serie-a',
        timestamp: new Date().toISOString(),
      })
    }

    const ck = `football:comp:${id}:top-scorers:ge-fotos:v2`
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    const artilharia = await scraperArtilhariaEnriquecida().catch(() => [])
    cache.set(ck, artilharia, TTL.ARTILHARIA)
    return reply.send({ success: true, data: artilharia, total: artilharia.length, competition: id, cache: false, timestamp: new Date().toISOString() })
  })

  // GET /api/football/competitions/:id/matches
  app.get<{ Params: { id: string }; Querystring: { date?: string } }>('/football/competitions/:id/matches', async (req, reply) => {
    const { id } = req.params
    const data = req.query.date ?? hojeISO()
    const ck = `football:comp:${id}:matches:${data}`
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    let jogos: Jogo[] = []
    const espnCode = ESPN_LEAGUE_IDS[id]
    if (espnCode) {
      // Brasileirão via ESPN direto
      const { jogos: brJogos } = await getJogosHoje().catch(() => ({ jogos: [] as Jogo[] }))
      jogos = brJogos.filter(j => j.data === data)
    } else {
      jogos = await scraperJogosLigaHoje(id, data).catch(() => [])
    }

    const items = jogos.map(normalizeMatch)
    cache.set(ck, items, TTL.JOGOS_HOJE)
    return reply.send({ success: true, data: items, total: items.length, competition: id, date: data, cache: false, timestamp: new Date().toISOString() })
  })

  // GET /api/football/teams
  app.get('/football/teams', async (_req, reply) => {
    const times = TIMES_BRASILEIROS.map(t => ({
      id: t.slug,
      name: t.nome,
      shortName: t.slug,
      logo: t.escudo,
      country: 'Brasil',
      state: t.estado,
      city: t.cidade,
      stadium: { name: t.estadio },
      founded: t.fundacao,
      colors: t.cores,
      newsUrl: `/api/football/teams/${t.slug}#noticiasRelacionadas`,
    }))
    return reply.send({ success: true, data: times, total: times.length, timestamp: new Date().toISOString() })
  })

  // GET /api/football/teams/:id
  app.get<{ Params: { id: string } }>('/football/teams/:id', async (req, reply) => {
    const { id } = req.params
    const time = TIMES_BRASILEIROS.find(t => t.slug === id)
    if (!time) return reply.status(404).send({ success: false, error: 'Time não encontrado' })

    const ck = `football:team:${id}:enriched:v4`
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    const espnId = ESPN_TEAM_IDS[id]
    const [elenco, jogosTime, noticias, transfermarkt] = await Promise.all([
      espnId ? scraperElencoESPN(espnId).catch(() => []) : Promise.resolve([]),
      espnId ? scraperJogosPorTimeESPN(espnId).catch(() => ({ proximos: [] as Jogo[], resultados: [] as Jogo[] })) : Promise.resolve({ proximos: [] as Jogo[], resultados: [] as Jogo[] }),
      scraperNoticiasEsporte(60).catch(() => [] as NoticiaEsporte[]),
      buscarClubeTransfermarkt(id).catch(() => null),
    ])
    const elencoTransfermarkt = transfermarkt ? await scraperElencoTransfermarkt(transfermarkt.elencoUrl).catch(() => []) : []
    const elencoNormalizadoTransfermarkt = normalizarElencoTransfermarkt(id, elencoTransfermarkt)
    const enriquecido = TIMES_ENRIQUECIDOS[id] ?? null
    const brasileiro2026 = buscarClubeBrasileirao2026(id)
    const termosNoticias = [
      time.nome,
      time.slug.replace(/-/g, ' '),
      ...(enriquecido?.apelidos ?? []),
    ]

    const resultadosComVideos = await anexarMelhoresMomentos(jogosTime.resultados).catch(() => jogosTime.resultados)

    const data = {
      id: time.slug,
      name: time.nome,
      logo: time.escudo,
      country: 'Brasil',
      state: time.estado,
      city: time.cidade,
      founded: time.fundacao,
      stadium: {
        name: brasileiro2026?.estadio ?? time.estadio,
        capacity: brasileiro2026?.capacidade_estadio ?? enriquecido?.capacidadeEstadio ?? null,
      },
      coach: time.tecnico,
      colors: time.cores,
      // História e títulos
      history: time.historia,
      historiaCompleta: enriquecido?.historiaCompleta ?? time.historia ?? null,
      honors: time.titulos,
      conquistasInternacionais: enriquecido?.conquistasInternacionais ?? 0,
      conquistasNacionais: enriquecido?.conquistasNacionais ?? 0,
      // Identidade do clube
      apelidos: enriquecido?.apelidos ?? [],
      mascote: brasileiro2026?.mascote ?? enriquecido?.mascote ?? null,
      hino: enriquecido?.hino ?? null,
      presidente: enriquecido?.presidente ?? null,
      socioTorcedor: enriquecido?.socioTorcedor ?? null,
      museu: enriquecido?.museu ?? null,
      redesSociais: enriquecido?.redesSociais ?? {},
      rivais: enriquecido?.rivais ?? [],
      brasileirao2026: brasileiro2026 ? {
        sigla: brasileiro2026.sigla,
        fundacao: brasileiro2026.fundacao,
        estadio: brasileiro2026.estadio,
        capacidadeEstadio: brasileiro2026.capacidade_estadio,
        mascote: brasileiro2026.mascote,
        titulosPrincipais: brasileiro2026.titulos_principais,
        historia: brasileiro2026.historia,
        linksFotosOficiais: brasileiro2026.links_fotos_oficiais,
        elenco: brasileiro2026.elenco,
      } : null,
      // Elenco com fotos ESPN
      transfermarkt: transfermarkt ? {
        ...transfermarkt,
        elenco: elencoTransfermarkt,
      } : null,
      squad: elencoNormalizadoTransfermarkt.length ? elencoNormalizadoTransfermarkt : elenco.length ? elenco : (brasileiro2026?.elenco ?? []).map((j, idx) => ({
        id: `${id}-br2026-${idx + 1}`,
        nome: j.nome,
        posicao: j.posicao,
        numero: null,
        nacionalidade: null,
        idade: null,
        foto: j.foto,
        fotoReal: false,
        perfilUrl: j.foto,
      })),
      elenco: elencoNormalizadoTransfermarkt.length ? elencoNormalizadoTransfermarkt : elenco.length ? elenco : (brasileiro2026?.elenco ?? []).map((j, idx) => ({
        id: `${id}-br2026-${idx + 1}`,
        nome: j.nome,
        posicao: j.posicao,
        numero: null,
        nacionalidade: null,
        idade: null,
        foto: j.foto,
        fotoReal: false,
        perfilUrl: j.foto,
      })),
      proximosJogos: jogosTime.proximos.map(normalizeMatch),
      ultimosResultados: resultadosComVideos.map(normalizeMatch),
      noticiasRelacionadas: filtrarNoticiasRelacionadas(noticias, termosNoticias, 8),
      updatedAt: new Date().toISOString(),
    }

    cache.set(ck, data, TTL.ELENCO)
    return reply.send({ success: true, data, cache: false, timestamp: new Date().toISOString() })
  })

  // GET /api/football/teams/:id/squad
  app.get<{ Params: { id: string } }>('/football/teams/:id/squad', async (req, reply) => {
    const { id } = req.params
    const time = TIMES_BRASILEIROS.find(t => t.slug === id)
    if (!time) return reply.status(404).send({ success: false, error: 'Time não encontrado' })

    const ck = `football:team:${id}:squad:transfermarkt:v2`
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    const espnId = ESPN_TEAM_IDS[id]
    const brasileiro2026 = buscarClubeBrasileirao2026(id)
    const transfermarkt = await buscarClubeTransfermarkt(id).catch(() => null)
    const elencoTransfermarkt = transfermarkt ? await scraperElencoTransfermarkt(transfermarkt.elencoUrl).catch(() => []) : []
    if (elencoTransfermarkt.length) {
      const elenco = normalizarElencoTransfermarkt(id, elencoTransfermarkt)
      cache.set(ck, elenco, TTL.ELENCO)
      return reply.send({ success: true, data: elenco, total: elenco.length, team: time.nome, transfermarkt, cache: false, timestamp: new Date().toISOString() })
    }
    const elencoESPN = espnId ? await scraperElencoESPN(espnId).catch(() => []) : []
    const elenco = elencoESPN.length ? elencoESPN : (brasileiro2026?.elenco ?? []).map((j, idx) => ({
      id: `${id}-br2026-${idx + 1}`,
      nome: j.nome,
      posicao: j.posicao,
      numero: null,
      nacionalidade: null,
      idade: null,
      foto: j.foto,
      fotoReal: false,
      perfilUrl: j.foto,
    }))

    cache.set(ck, elenco, TTL.ELENCO)
    return reply.send({ success: true, data: elenco, total: elenco.length, team: time.nome, cache: false, timestamp: new Date().toISOString() })
  })

  // GET /api/football/brasil/full - pacote pronto para o app
  app.get<{ Querystring: { days?: string; competition?: string } }>('/football/brasil/full', async (req, reply) => {
    const competition = req.query.competition ?? 'brasileirao-serie-a'
    const dias = Math.min(Number(req.query.days ?? 14), 30)
    const ck = `football:brasil:full:${competition}:${dias}:enriched:v3`
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    const times = TIMES_BRASILEIROS.map(t => ({
      id: t.slug,
      name: t.nome,
      slug: t.slug,
      logo: t.escudo,
      escudo: t.escudo,
      city: t.cidade,
      state: t.estado,
      stadium: t.estadio,
      colors: t.cores,
      squadUrl: `/api/football/teams/${t.slug}/squad`,
      teamUrl: `/api/football/teams/${t.slug}`,
      matchesUrl: `/api/times/${t.slug}/jogos`,
      newsUrl: `/api/football/teams/${t.slug}#noticiasRelacionadas`,
    }))

    const [jogosHojeResult, proximosResult, recentesResult, tabelaResult, artilhariaResult, transmissoesResult, noticiasResult] = await Promise.allSettled([
      getJogosHoje(),
      scraperProximosJogosESPN(dias),
      scraperJogosRecentesESPN(14),
      scraperTabelaESPN(ESPN_LEAGUE_IDS[competition] ?? 'bra.1'),
      competition === 'brasileirao-serie-a' ? scraperArtilhariaEnriquecida() : Promise.resolve([]),
      getJogosHoje(),
      scraperNoticiasEsporte(40),
    ])

    const jogosHoje = jogosHojeResult.status === 'fulfilled' ? jogosHojeResult.value.jogos.map(normalizeMatch) : []
    const proximosJogos = proximosResult.status === 'fulfilled' ? proximosResult.value.map(normalizeMatch) : []
    const ultimosResultados = recentesResult.status === 'fulfilled'
      ? (await anexarMelhoresMomentos(recentesResult.value).catch(() => recentesResult.value)).map(normalizeMatch)
      : []
    const tabela = tabelaResult.status === 'fulfilled' ? tabelaResult.value : []
    const artilharia = artilhariaResult.status === 'fulfilled' ? artilhariaResult.value : []
    const noticias = noticiasResult.status === 'fulfilled' ? noticiasResult.value : []
    const transmissoesHoje = transmissoesResult.status === 'fulfilled'
      ? transmissoesResult.value.jogos.map(j => ({
          matchId: j.id,
          jogo: `${j.mandante} x ${j.visitante}`,
          campeonato: j.campeonato,
          data: j.data,
          horario: j.horario,
          homeTeam: { name: j.mandante, logo: j.escudoMandante },
          awayTeam: { name: j.visitante, logo: j.escudoVisitante },
          transmissoes: j.transmissoes?.length ? j.transmissoes : [{ canal: 'A confirmar', tipo: 'desconhecido' as const, url: null, logo: null }],
        }))
      : []

    const data = {
      competition,
      endpoints: {
        jogosDoDia: '/api/football/matches/today',
        todosTimes: '/api/football/teams',
        detalhesTime: '/api/football/teams/:slug',
        elencoComFotos: '/api/football/teams/:slug/squad',
        transmissoesHoje: '/api/transmissoes/hoje',
        tabela: `/api/football/competitions/${competition}/standings`,
        artilharia: `/api/football/competitions/${competition}/top-scorers`,
        ultimosResultados: '/api/football/matches/recent',
        proximosJogos: `/api/football/matches/upcoming?days=${dias}`,
        noticias: '/api/noticias',
      },
      jogosDoDia: jogosHoje,
      transmissoesHoje,
      times,
      tabela,
      artilharia,
      ultimosResultados,
      proximosJogos,
      noticias,
      fontesNoticias: [
        'MSN Esportes',
        'Terra Futebol',
        'UOL Esporte',
        'UOL Copa do Mundo',
        'Lance!',
      ],
      updatedAt: new Date().toISOString(),
    }

    cache.set(ck, data, TTL.TRANSMISSOES)
    return reply.send({ success: true, data, cache: false, timestamp: new Date().toISOString() })
  })

  // GET /api/search - busca unificada de times e jogos
  app.get<{ Querystring: { q?: string } }>('/search', async (req, reply) => {
    const q = (req.query.q ?? '').toLowerCase().trim()
    if (!q || q.length < 2) return reply.send({ success: true, data: [], total: 0 })

    const times = TIMES_BRASILEIROS.filter(t =>
      t.nome.toLowerCase().includes(q) || t.slug.includes(q)
    ).map(t => ({
      type: 'team',
      id: t.slug,
      title: t.nome,
      subtitle: `${t.cidade} — ${t.estado}`,
      image: t.escudo,
      href: `/api/football/teams/${t.slug}`,
    }))

    const comps = ALL_COMPETITIONS.filter(c =>
      c.name.toLowerCase().includes(q) || c.id.includes(q)
    ).map(c => ({
      type: 'competition',
      id: c.id,
      title: c.name,
      subtitle: c.country,
      image: null,
      href: `/api/football/competitions/${c.id}/standings`,
    }))

    const data = [...times, ...comps].slice(0, 20)
    return reply.send({ success: true, data, total: data.length, query: q })
  })
}
