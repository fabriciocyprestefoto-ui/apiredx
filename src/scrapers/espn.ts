import axios from 'axios'
import https from 'https'
import { PosicaoTabela, Artilheiro, Jogo } from '../types'
import { logger } from '../utils/logger'
import { slugify } from '../utils/slugify'
import { withRetry } from '../utils/retry'
import { mesclarTransmissoes, normalizarTransmissao } from './transmissoes'

const BASE_URL = 'https://sports.core.api.espn.com/v2/sports/soccer/leagues'
const SITE_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer'

const BASE = `${BASE_URL}/bra.1`
const SITE = `${SITE_URL}/bra.1`

export const ESPN_LEAGUE_IDS: Record<string, string> = {
  'brasileirao-serie-a': 'bra.1',
  'brasileirao-serie-b': 'bra.2',
  'libertadores': 'conmebol.libertadores',
  'sul-americana': 'conmebol.sudamericana',
  'copa-do-brasil': 'bra.copa_brasil',
}
const H = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9',
}
const ESPN_HTTP = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
})

function idFromRef(ref: string): string {
  return ref.split('/').pop()?.split('?')[0] ?? ''
}

function fotoFallback(nome: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(nome)}&background=21262d&color=e6edf3&size=128&rounded=true&bold=true`
}

function escolherFotoAtleta(athlete: Record<string, unknown>, nome: string): string {
  const headshot = (athlete.headshot as Record<string, string> | undefined)?.href
  if (headshot) return headshot

  const images = (athlete.images as Array<Record<string, string>> | undefined) ?? []
  const fromImages = images.find(img => typeof img.href === 'string' && img.href.trim())?.href
  if (fromImages) return fromImages

  const id = String(athlete.id ?? '').trim()
  if (id) return fotoFallback(nome)
  return fotoFallback(nome)
}

function fotoRealAtleta(athlete: Record<string, unknown>): string | null {
  const headshot = (athlete.headshot as Record<string, string> | undefined)?.href
  if (headshot) return headshot

  const images = (athlete.images as Array<Record<string, string>> | undefined) ?? []
  return images.find(img => typeof img.href === 'string' && img.href.trim())?.href ?? null
}

function perfilAtleta(athlete: Record<string, unknown>): string | null {
  const links = (athlete.links as Array<Record<string, unknown>> | undefined) ?? []
  const profile = links.find(link => {
    const rel = (link.rel as string[] | undefined) ?? []
    return rel.includes('athlete') && rel.includes('desktop')
  })
  return (profile?.href as string | undefined) ?? null
}

function extrairNomesTransmissao(comps: Record<string, unknown>): string[] {
  const nomes = new Set<string>()

  const broadcasts = (comps.broadcasts as Array<Record<string, unknown>> | undefined) ?? []
  for (const b of broadcasts) {
    const arr = (b.names as string[] | undefined) ?? []
    for (const n of arr) if (n?.trim()) nomes.add(n.trim())
  }

  const geoBroadcasts = (comps.geoBroadcasts as Array<Record<string, unknown>> | undefined) ?? []
  for (const g of geoBroadcasts) {
    const media = (g.media as Record<string, unknown> | undefined) ?? {}
    const candidates = [
      g.shortName as string | undefined,
      g.name as string | undefined,
      media.shortName as string | undefined,
      media.name as string | undefined,
    ]
    for (const c of candidates) if (c?.trim()) nomes.add(c.trim())
  }

  const single = String(comps.broadcast ?? '').trim()
  if (single) nomes.add(single)

  return Array.from(nomes)
}

async function fetchTeamsMap(): Promise<Record<string, { nome: string; logo: string }>> {
  const { data } = await withRetry(
    () => ESPN_HTTP.get(`${SITE}/teams`, { headers: H, timeout: 10000 }),
    { retries: 2, label: 'espn:teams' }
  )
  const teams = data.sports?.[0]?.leagues?.[0]?.teams ?? []
  const map: Record<string, { nome: string; logo: string }> = {}
  for (const t of teams) {
    map[t.team.id] = {
      nome: t.team.displayName,
      logo: t.team.logos?.[0]?.href ?? null,
    }
  }
  return map
}

export async function scraperTabelaESPN(leagueCode = 'bra.1'): Promise<PosicaoTabela[]> {
  try {
    const { data } = await withRetry(
      () => ESPN_HTTP.get(`https://site.api.espn.com/apis/v2/sports/soccer/${leagueCode}/standings`, { headers: H, timeout: 10000 }),
      { retries: 2, label: `espn:standings:${leagueCode}` }
    )

    const entries = (data.children?.[0]?.standings?.entries ?? []) as Record<string, unknown>[]
    const tabela: PosicaoTabela[] = []

    for (const entry of entries) {
      const team = entry.team as Record<string, unknown>
      if (!team) continue

      const stats = (entry.stats as Record<string, unknown>[]) ?? []
      const getStat = (...abbrs: string[]) => {
        for (const abbr of abbrs) {
          const s = stats.find(s => s.abbreviation === abbr) as Record<string, unknown> | undefined
          if (s?.value != null) return Number(s.value)
        }
        return 0
      }

      const jogos = getStat('GP')
      const vitorias = getStat('W')
      const empates = getStat('D', 'T')
      const derrotas = getStat('L')
      const pontos = getStat('P', 'PTS')
      const golsPro = getStat('F', 'GF')
      const golsContra = getStat('A', 'GA')
      const posicao = getStat('R', 'rank') || tabela.length + 1

      const logos = (team.logos as Record<string, unknown>[]) ?? []

      tabela.push({
        posicao,
        time: String(team.displayName ?? team.name ?? ''),
        escudo: (logos[0]?.href as string) ?? null,
        jogos,
        pontos,
        vitorias,
        empates,
        derrotas,
        golsPro,
        golsContra,
        saldoGols: golsPro - golsContra,
        aproveitamento: jogos > 0 ? Math.round((pontos / (jogos * 3)) * 100) : 0,
      })
    }

    tabela.sort((a, b) => a.posicao - b.posicao)

    logger.info(`[tabelaESPN:${leagueCode}] ${tabela.length} times`)
    return tabela
  } catch (e) {
    logger.error(`[tabelaESPN:${leagueCode}] ${e}`)
    return []
  }
}

export async function scraperArtilhariaESPN(): Promise<Artilheiro[]> {
  try {
    const [teamsMap, { data }] = await Promise.all([
      fetchTeamsMap(),
      ESPN_HTTP.get(`${BASE}/seasons/2026/types/1/leaders?lang=pt&region=br`, { headers: H, timeout: 10000 }),
    ])

    const cats = (data.categories ?? []) as Record<string, unknown>[]
    const goalscat = cats.find(c =>
      (c.name as string)?.toLowerCase().includes('goal')
    )
    if (!goalscat) return []

    const leaders = (goalscat.leaders as Record<string, unknown>[]) ?? []

    const artilheiros: Artilheiro[] = await Promise.all(
      leaders.slice(0, 20).map(async (l, i) => {
        const athleteRef = (l.athlete as Record<string, string>)?.['$ref'] ?? ''
        const gols = Number(l.value ?? 0)
        const displayValue = String(l.displayValue ?? '')
        const matchCount = displayValue.match(/Partidas?:\s*(\d+)/i)
        const partidas = matchCount ? Number(matchCount[1]) : 0

        try {
          const { data: ath } = await ESPN_HTTP.get(athleteRef, { headers: H, timeout: 6000 })
          const teamId = idFromRef((ath.team as Record<string, string>)?.['$ref'] ?? '')
          const jogador = String(ath.fullName ?? ath.displayName ?? '—')
          const fotoReal = fotoRealAtleta(ath)
          return {
            posicao: i + 1,
            jogador,
            time: teamsMap[teamId]?.nome ?? '—',
            gols,
            assistencias: partidas || null,
            foto: fotoReal ?? fotoFallback(jogador),
            fotoReal: Boolean(fotoReal),
            perfilUrl: perfilAtleta(ath),
          } satisfies Artilheiro
        } catch {
          const jogador = String((l.displayName as string | undefined) ?? `Artilheiro ${i + 1}`)
          return {
            posicao: i + 1,
            jogador,
            time: '—',
            gols,
            assistencias: null,
            foto: fotoFallback(jogador),
            fotoReal: false,
            perfilUrl: null,
          }
        }
      })
    )

    logger.info(`[artilhariaESPN] ${artilheiros.length} artilheiros`)
    return artilheiros.filter(a => a.jogador !== '—')
  } catch (e) {
    logger.error(`[artilhariaESPN] ${e}`)
    return []
  }
}

export async function scraperProximosJogosESPN(diasAFrente = 14): Promise<Jogo[]> {
  try {
    const hoje = new Date()
    const datas: string[] = []
    for (let i = 0; i <= diasAFrente; i++) {
      const d = new Date(hoje)
      d.setDate(d.getDate() + i)
      datas.push(d.toISOString().split('T')[0].replace(/-/g, ''))
    }

    const resultados = await Promise.all(
      datas.map(async (dateStr) => {
        try {
          const { data } = await ESPN_HTTP.get(`${SITE}/scoreboard?dates=${dateStr}`, { headers: H, timeout: 8000 })
          const events = (data.events ?? []) as Record<string, unknown>[]
          return events.map(parseEventoESPN).filter((j): j is Jogo => j !== null)
        } catch { return [] }
      })
    )

    const jogos = resultados.flat()
    jogos.sort((a, b) => a.data.localeCompare(b.data) || a.horario.localeCompare(b.horario))
    logger.info(`[proximosJogosESPN] ${jogos.length} jogos nos próximos ${diasAFrente} dias`)
    return jogos
  } catch (e) {
    logger.error(`[proximosJogosESPN] ${e}`)
    return []
  }
}

export async function scraperJogosRecentesESPN(diasAtras = 14): Promise<Jogo[]> {
  try {
    const hoje = new Date()
    const datas: string[] = []
    for (let i = 1; i <= diasAtras; i++) {
      const d = new Date(hoje)
      d.setDate(d.getDate() - i)
      datas.push(d.toISOString().split('T')[0].replace(/-/g, ''))
    }

    const resultados = await Promise.all(
      datas.map(async (dateStr) => {
        try {
          const { data } = await ESPN_HTTP.get(`${SITE}/scoreboard?dates=${dateStr}`, { headers: H, timeout: 8000 })
          const events = (data.events ?? []) as Record<string, unknown>[]
          return events.map(parseEventoESPN).filter((j): j is Jogo => j !== null)
        } catch { return [] }
      })
    )

    const jogos = resultados
      .flat()
      .filter(j => j.status === 'encerrado' || j.placarMandante != null || j.placarVisitante != null)

    jogos.sort((a, b) => b.data.localeCompare(a.data) || b.horario.localeCompare(a.horario))
    logger.info(`[jogosRecentesESPN] ${jogos.length} jogos nos últimos ${diasAtras} dias`)
    return jogos
  } catch (e) {
    logger.error(`[jogosRecentesESPN] ${e}`)
    return []
  }
}

export const ESPN_TEAM_IDS: Record<string, string> = {
  'flamengo': '819',
  'palmeiras': '2029',
  'corinthians': '874',
  'sao-paulo': '2026',
  'santos': '2674',
  'vasco': '3454',
  'fluminense': '3445',
  'botafogo': '6086',
  'atletico-mg': '7632',
  'cruzeiro': '2022',
  'gremio': '6273',
  'internacional': '1936',
  'bahia': '9967',
  'athletico-pr': '3458',
  'mirassol': '9169',
  'bragantino': '6079',
  'vitoria': '3457',
  'coritiba': '3456',
  'fortaleza': '6309',
  'sport': '3462',
  'ceara': '3460',
  'juventude': '3922',
  'criciuma': '3461',
  'novorizontino': '9282',
}

export async function scraperElencoESPN(espnTeamId: string): Promise<import('../types').JogadorElenco[]> {
  try {
    const { data } = await withRetry(
      () => ESPN_HTTP.get(`${SITE}/teams/${espnTeamId}/roster?lang=pt&region=br`, { headers: H, timeout: 10000 }),
      { retries: 2, label: `espn:roster:${espnTeamId}` }
    )
    const athletes = (data.athletes ?? []) as Record<string, unknown>[]
    return athletes.map(a => {
      const nome = String(a.fullName ?? a.displayName ?? '—')
      const fotoReal = fotoRealAtleta(a)
      return {
        id: String(a.id ?? '') || null,
        nome,
        posicao: (a.position as Record<string, string>)?.displayName ?? null,
        numero: a.jersey != null ? Number(a.jersey) : null,
        nacionalidade: (a.citizenshipCountry as Record<string, string>)?.displayName ?? null,
        idade: a.age != null ? Number(a.age) : null,
        foto: fotoReal ?? escolherFotoAtleta(a, nome),
        fotoReal: Boolean(fotoReal),
        perfilUrl: perfilAtleta(a),
      }
    })
  } catch (e) {
    logger.error(`[elencoESPN] ${e}`)
    return []
  }
}

const STATUS_MAP: Record<string, Jogo['status']> = {
  STATUS_SCHEDULED: 'agendado',
  STATUS_IN_PROGRESS: 'ao_vivo',
  STATUS_HALFTIME: 'ao_vivo',
  STATUS_FULL_TIME: 'encerrado',
  STATUS_FINAL: 'encerrado',
  STATUS_POSTPONED: 'adiado',
  STATUS_CANCELED: 'cancelado',
}

function parseEventoESPN(ev: Record<string, unknown>): Jogo | null {
  const comps = ((ev.competitions as Record<string, unknown>[])?.[0]) ?? {}
  const competitors = (comps.competitors as Record<string, unknown>[]) ?? []
  const home = competitors.find(c => c.homeAway === 'home')
  const away = competitors.find(c => c.homeAway === 'away')
  if (!home || !away) return null

  const homeTeam = home.team as Record<string, string>
  const awayTeam = away.team as Record<string, string>
  const venue = comps.venue as Record<string, unknown>
  const status = (ev.status as Record<string, unknown>)?.type as Record<string, string>
  const dt = new Date(String(ev.date ?? ''))
  const dataStr = dt.toISOString().split('T')[0]
  const horario = dt.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })

  // Extrair transmissões dos vários campos possíveis retornados pela ESPN.
  const nomesTransmissao = extrairNomesTransmissao(comps)
  const transmissoes = mesclarTransmissoes(nomesTransmissao.map(normalizarTransmissao), 'bra.1')

  return {
    id: `espn-${ev.id}`,
    mandante: homeTeam.displayName,
    visitante: awayTeam.displayName,
    escudoMandante: homeTeam.logo ?? null,
    escudoVisitante: awayTeam.logo ?? null,
    campeonato: 'Brasileirão Série A',
    campeonatoSlug: 'brasileirao-serie-a',
    data: dataStr,
    horario,
    estadio: (venue?.fullName as string) ?? null,
    cidade: ((venue?.address as Record<string, string>)?.city) ?? null,
    status: STATUS_MAP[status?.name] ?? 'agendado',
    placarMandante: home.score != null && home.score !== '' ? Number(home.score) : null,
    placarVisitante: away.score != null && away.score !== '' ? Number(away.score) : null,
    transmissoes,
    fonte: 'espn',
  }
}

export async function scraperJogosPorTimeESPN(espnTeamId: string): Promise<{ proximos: Jogo[]; resultados: Jogo[] }> {
  try {
    const { data } = await withRetry(
      () => ESPN_HTTP.get(`${SITE}/teams/${espnTeamId}/schedule`, { headers: H, timeout: 10000 }),
      { retries: 2, label: `espn:schedule:${espnTeamId}` }
    )
    const events = (data.events ?? []) as Record<string, unknown>[]
    const hoje = new Date().toISOString().split('T')[0]
    const proximos: Jogo[] = []
    const resultados: Jogo[] = []

    for (const ev of events) {
      const jogo = parseEventoESPN(ev)
      if (!jogo) continue
      if (jogo.data >= hoje && jogo.status !== 'encerrado') {
        proximos.push(jogo)
      } else if (jogo.status === 'encerrado' || jogo.data < hoje) {
        resultados.push(jogo)
      }
    }

    proximos.sort((a, b) => a.data.localeCompare(b.data) || a.horario.localeCompare(b.horario))
    resultados.sort((a, b) => b.data.localeCompare(a.data))

    logger.info(`[jogosPorTimeESPN] ${espnTeamId}: ${proximos.length} próximos, ${resultados.length} resultados`)
    return { proximos: proximos.slice(0, 10), resultados: resultados.slice(0, 10) }
  } catch (e) {
    logger.error(`[jogosPorTimeESPN] ${e}`)
    return { proximos: [], resultados: [] }
  }
}

export async function scraperJogosPorDataESPN(data: string): Promise<Jogo[]> {
  try {
    const dateStr = data.replace(/-/g, '')
    const { data: res } = await withRetry(
      () => ESPN_HTTP.get(`${SITE}/scoreboard?dates=${dateStr}`, { headers: H, timeout: 10000 }),
      { retries: 2, label: `espn:scoreboard:${data}` }
    )
    const events = (res.events ?? []) as Record<string, unknown>[]
    const jogos = events.map(parseEventoESPN).filter((j): j is Jogo => j !== null)
    logger.info(`[jogosPorDataESPN:${data}] ${jogos.length} jogos`)
    return jogos
  } catch (e) {
    logger.error(`[jogosPorDataESPN] ${e}`)
    return []
  }
}

export async function scraperJogosHojeESPN(): Promise<Jogo[]> {
  try {
    const { data } = await withRetry(
      () => ESPN_HTTP.get(`${SITE}/scoreboard`, { headers: H, timeout: 10000 }),
      { retries: 2, label: 'espn:scoreboard:hoje' }
    )
    const events = (data.events ?? []) as Record<string, unknown>[]
    const jogos = events.map(parseEventoESPN).filter((j): j is Jogo => j !== null)
    logger.info(`[jogosHojeESPN] ${jogos.length} jogos`)
    return jogos
  } catch (e) {
    logger.error(`[jogosHojeESPN] ${e}`)
    return []
  }
}
