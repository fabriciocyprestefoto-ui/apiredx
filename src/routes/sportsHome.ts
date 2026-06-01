/**
 * GET /api/sports/home
 *
 * Endpoint de home para o portal de streaming de TV.
 * Agrega todas as modalidades em seções prontas para cards.
 * TTL de cache: 2 min (dados ao vivo) / 5 min (restante).
 */

import { FastifyPluginAsync } from 'fastify'
import { cache, TTL } from '../cache'
import { getJogosHoje } from '../services/jogosService'
import { scraperJogosNBAHoje, scraperTabelaNBA, scraperProximosJogosNBA } from '../scrapers/nba'
import { scraperUFCProximos } from '../scrapers/ufc'
import { scraperJogosLigaHoje, scraperProximosJogosLiga, LIGAS_INTERNACIONAIS } from '../scrapers/futebolInternacional'
import { scraperTabelaESPN } from '../scrapers/espn'
import { scraperNoticiasEsporte } from '../scrapers/noticias'
import { INFO_COPA_MUNDO_2026, SELECOES_COPA_MUNDO_2026 } from '../data/copaMundo'
import { COPA_MUNDO_2006 } from '../data/copaMundo2006'
import { Jogo, JogoNBA, EventoUFC, NoticiaEsporte } from '../types'

// ─── Card format ─────────────────────────────────────────────────────────────

interface SportsCard {
  id: string
  type: 'match' | 'team' | 'competition' | 'fighter' | 'event'
  title: string
  subtitle?: string
  image?: string | null
  logoLeft?: string | null
  logoRight?: string | null
  badge?: string | null
  status?: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled'
  date?: string
  time?: string
  score?: { home: number | null; away: number | null }
  competition?: string
  href?: string
  sport?: string
}

interface NewsCard extends Omit<SportsCard, 'type'> {
  type: 'news'
  source: string
  url: string
}

type HomeCard = SportsCard | NewsCard

interface SportsSection {
  id: string
  title: string
  type: string
  items: HomeCard[]
}

// ─── Status mappers ───────────────────────────────────────────────────────────

function mapStatus(s: string): SportsCard['status'] {
  const m: Record<string, SportsCard['status']> = {
    agendado: 'scheduled',
    ao_vivo: 'live',
    encerrado: 'finished',
    adiado: 'postponed',
    cancelado: 'cancelled',
  }
  return m[s] ?? 'scheduled'
}

// ─── Converters ───────────────────────────────────────────────────────────────

function jogoToCard(j: Jogo, sport = 'football'): SportsCard {
  return {
    id: j.id,
    type: 'match',
    sport,
    title: `${j.mandante} x ${j.visitante}`,
    subtitle: j.campeonato,
    logoLeft: j.escudoMandante,
    logoRight: j.escudoVisitante,
    badge: null,
    status: mapStatus(j.status),
    date: j.data,
    time: j.horario,
    score: j.status !== 'agendado' ? { home: j.placarMandante, away: j.placarVisitante } : undefined,
    competition: j.campeonato,
    href: `/api/football/matches?date=${j.data}`,
  }
}

function nbaToCard(j: JogoNBA): SportsCard {
  return {
    id: j.id,
    type: 'match',
    sport: 'basketball',
    title: `${j.mandante} x ${j.visitante}`,
    subtitle: j.arena ?? 'NBA',
    logoLeft: j.logoMandante,
    logoRight: j.logoVisitante,
    badge: null,
    status: mapStatus(j.status),
    date: j.data,
    time: j.horario,
    score: j.pontosMandante != null ? { home: j.pontosMandante, away: j.pontosVisitante } : undefined,
    competition: 'NBA',
    href: `/api/nba/games/today`,
  }
}

function ufcToCard(ev: EventoUFC): SportsCard {
  const luta = ev.lutaPrincipal
  const title = luta
    ? `${luta.lutador1.nome} vs ${luta.lutador2.nome}`
    : ev.nome
  return {
    id: ev.id,
    type: 'event',
    sport: 'mma',
    title,
    subtitle: ev.nome,
    image: luta?.lutador1.foto ?? null,
    logoLeft: luta?.lutador1.foto ?? null,
    logoRight: luta?.lutador2.foto ?? null,
    badge: null,
    status: mapStatus(ev.status),
    date: ev.data,
    time: ev.horario,
    competition: 'UFC',
    href: `/api/fights/events/${ev.id}`,
  }
}

// ─── Section builders ─────────────────────────────────────────────────────────

async function buildLiveNow(hoje: string): Promise<SportsCard[]> {
  const [jogos, nba] = await Promise.allSettled([
    getJogosHoje(),
    scraperJogosNBAHoje(),
  ])
  const items: SportsCard[] = []
  const jogosData = jogos.status === 'fulfilled' ? jogos.value.jogos : []
  const nbaData = nba.status === 'fulfilled' ? nba.value : []

  for (const j of jogosData.filter(j => j.status === 'ao_vivo' && j.data === hoje)) {
    items.push(jogoToCard(j))
  }
  for (const j of nbaData.filter(j => j.status === 'ao_vivo')) {
    items.push(nbaToCard(j))
  }

  // Futebol internacional ao vivo
  const ligasAtivas = LIGAS_INTERNACIONAIS.filter(l => l.ativo)
  const intResults = await Promise.allSettled(
    ligasAtivas.map(l => scraperJogosLigaHoje(l.slug, hoje))
  )
  for (const r of intResults) {
    if (r.status === 'fulfilled') {
      for (const j of r.value.filter(j => j.status === 'ao_vivo')) {
        items.push(jogoToCard(j))
      }
    }
  }
  return items
}

async function buildTodayFootball(hoje: string): Promise<SportsCard[]> {
  const items: SportsCard[] = []

  // Futebol brasileiro
  const { jogos } = await getJogosHoje().catch(() => ({ jogos: [] as Jogo[] }))
  for (const j of jogos.filter(j => j.data === hoje)) {
    items.push(jogoToCard(j))
  }

  // Futebol internacional de hoje
  const ligasAtivas = LIGAS_INTERNACIONAIS.filter(l => l.ativo)
  const intResults = await Promise.allSettled(
    ligasAtivas.map(l => scraperJogosLigaHoje(l.slug, hoje))
  )
  for (const r of intResults) {
    if (r.status === 'fulfilled') {
      for (const j of r.value) {
        items.push(jogoToCard(j))
      }
    }
  }

  items.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
  return items
}

async function buildBrasileiraoSection(): Promise<SportsCard[]> {
  const tabela = await scraperTabelaESPN('bra.1').catch(() => [])
  return tabela.slice(0, 8).map((pos, idx) => ({
    id: `brasileirao-pos-${pos.posicao || idx + 1}`,
    type: 'team' as const,
    sport: 'football',
    title: pos.time,
    subtitle: `${pos.pontos} pts • ${pos.vitorias}V ${pos.empates}E ${pos.derrotas}D`,
    image: pos.escudo,
    badge: String(pos.posicao || idx + 1),
    href: `/api/football/competitions/brasileirao-serie-a/standings`,
  }))
}

async function buildEuropeSection(hoje: string): Promise<SportsCard[]> {
  const ligasEuropa = ['champions-league', 'premier-league', 'la-liga', 'serie-a-italia', 'bundesliga', 'ligue-1']
  const items: SportsCard[] = []

  const results = await Promise.allSettled(
    ligasEuropa.map(slug => scraperProximosJogosLiga(slug, 7))
  )
  for (const r of results) {
    if (r.status === 'fulfilled') {
      for (const j of r.value.slice(0, 3)) {
        items.push(jogoToCard(j))
      }
    }
  }
  items.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.time ?? '').localeCompare(b.time ?? ''))
  return items.slice(0, 12)
}

function buildCopa2026Section(): SportsCard[] {
  const info = INFO_COPA_MUNDO_2026
  const selecoes = SELECOES_COPA_MUNDO_2026.slice(0, 8)
  const items: SportsCard[] = [
    {
      id: 'world-cup-2026-info',
      type: 'event',
      sport: 'football',
      title: 'Copa do Mundo FIFA 2026',
      subtitle: `${info.inicio} — ${info.fim} • ${info.selecoesParticipantes} seleções`,
      badge: '2026',
      href: '/api/world-cup/2026',
    },
    ...selecoes.map(s => ({
      id: `wc2026-${s.pais.toLowerCase().replace(/\s+/g, '-')}`,
      type: 'team' as const,
      sport: 'football',
      title: s.pais,
      subtitle: s.confederacao,
      badge: s.bandeira,
      href: '/api/world-cup/2026/teams',
    })),
  ]
  return items
}

function buildCopa2006Section(): SportsCard[] {
  return [
    {
      id: 'world-cup-2006-info',
      type: 'event',
      sport: 'football',
      title: COPA_MUNDO_2006.nome,
      subtitle: `${COPA_MUNDO_2006.paisSede} • Campeã: ${COPA_MUNDO_2006.campeao}`,
      badge: '2006',
      href: '/api/world-cup/2006',
    },
    {
      id: 'world-cup-2006-final',
      type: 'match',
      sport: 'football',
      title: `${COPA_MUNDO_2006.final.mandante} ${COPA_MUNDO_2006.final.placar} ${COPA_MUNDO_2006.final.visitante}`,
      subtitle: `Final • Pênaltis ${COPA_MUNDO_2006.final.penaltis}`,
      badge: COPA_MUNDO_2006.final.vencedor,
      date: COPA_MUNDO_2006.final.data,
      status: 'finished',
      href: '/api/world-cup/2006',
    },
    {
      id: 'world-cup-2006-brasil',
      type: 'team',
      sport: 'football',
      title: 'Brasil na Copa 2006',
      subtitle: COPA_MUNDO_2006.campanhaBrasil.faseFinal,
      badge: 'Brasil',
      href: '/api/world-cup/2006',
    },
  ]
}

async function buildNBASection(): Promise<SportsCard[]> {
  const [hoje, proximos, tabela] = await Promise.allSettled([
    scraperJogosNBAHoje(),
    scraperProximosJogosNBA(3),
    scraperTabelaNBA(),
  ])
  const items: SportsCard[] = []
  const jogosHoje = hoje.status === 'fulfilled' ? hoje.value : []
  const jogosProximos = proximos.status === 'fulfilled' ? proximos.value : []
  const standings = tabela.status === 'fulfilled' ? tabela.value : { leste: [], oeste: [] }

  const jogos = jogosHoje.length > 0 ? jogosHoje : jogosProximos.slice(0, 4)
  for (const j of jogos.slice(0, 6)) {
    items.push(nbaToCard(j))
  }

  // Se não tem jogos, mostra top da tabela
  if (items.length === 0) {
    const top = [...standings.leste.slice(0, 2), ...standings.oeste.slice(0, 2)]
    for (const pos of top) {
      items.push({
        id: `nba-team-${pos.posicao}`,
        type: 'team',
        sport: 'basketball',
        title: pos.time,
        subtitle: `${pos.vitorias}V ${pos.derrotas}D`,
        image: pos.escudo,
        href: '/api/nba/standings',
      })
    }
  }
  return items
}

async function buildFightsSection(): Promise<SportsCard[]> {
  const eventos = await scraperUFCProximos().catch(() => [] as EventoUFC[])
  const items: SportsCard[] = []
  for (const ev of eventos.slice(0, 4)) {
    items.push(ufcToCard(ev))
  }
  return items
}

async function buildNewsSection(): Promise<NewsCard[]> {
  const noticias = await scraperNoticiasEsporte(12).catch(() => [] as NoticiaEsporte[])
  return noticias.map(noticia => ({
    id: noticia.id,
    type: 'news' as const,
    sport: 'football',
    title: noticia.titulo,
    subtitle: noticia.resumo ?? noticia.categoria,
    image: noticia.imagem,
    badge: noticia.fonte,
    href: noticia.url,
    source: noticia.fonte,
    url: noticia.url,
    date: noticia.publicadoEm ?? undefined,
  }))
}

// ─── Route ───────────────────────────────────────────────────────────────────

export const sportsHomeRoutes: FastifyPluginAsync = async (app) => {
  app.get('/sports/home', async (_req, reply) => {
    const ck = 'sports:home'
    const cached = cache.get(ck)
    if (cached) {
      return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })
    }

    const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })

    const [liveItems, todayItems, brasileiraoItems, europeItems, newsItems, nbaItems, fightItems] =
      await Promise.allSettled([
        buildLiveNow(hoje),
        buildTodayFootball(hoje),
        buildBrasileiraoSection(),
        buildEuropeSection(hoje),
        buildNewsSection(),
        buildNBASection(),
        buildFightsSection(),
      ])

    const resolve = <T>(r: PromiseSettledResult<T>, fallback: T): T =>
      r.status === 'fulfilled' ? r.value : fallback

    const copaItems = buildCopa2026Section()
    const copa2006Items = buildCopa2006Section()

    const sections: SportsSection[] = [
      {
        id: 'live-now',
        title: 'Ao vivo agora',
        type: 'matches',
        items: resolve(liveItems, []),
      },
      {
        id: 'today-football',
        title: 'Futebol de hoje',
        type: 'matches',
        items: resolve(todayItems, []),
      },
      {
        id: 'brasileirao',
        title: 'Brasileirão',
        type: 'competition',
        items: resolve(brasileiraoItems, []),
      },
      {
        id: 'europe',
        title: 'Europa',
        type: 'matches',
        items: resolve(europeItems, []),
      },
      {
        id: 'world-cup-2026',
        title: 'Copa do Mundo 2026',
        type: 'worldCup',
        items: copaItems,
      },
      {
        id: 'world-cup-2006',
        title: 'Copa do Mundo 2006',
        type: 'worldCupHistory',
        items: copa2006Items,
      },
      {
        id: 'sports-news',
        title: 'Notícias de esporte',
        type: 'news',
        items: resolve(newsItems, []),
      },
      {
        id: 'nba',
        title: 'NBA',
        type: 'nba',
        items: resolve(nbaItems, []),
      },
      {
        id: 'fights',
        title: 'Lutas',
        type: 'fights',
        items: resolve(fightItems, []),
      },
    ]

    const payload = {
      updatedAt: new Date().toISOString(),
      sections,
    }

    // Cache por 2 min (ao vivo pode mudar rápido)
    cache.set(ck, payload, 2 * 60)

    return reply.send({ success: true, data: payload, cache: false, timestamp: new Date().toISOString() })
  })
}
