import axios from 'axios'
import { Jogo, PosicaoTabela, Transmissao } from '../types'
import { logger } from '../utils/logger'
import { withRetry } from '../utils/retry'
import { mesclarTransmissoes, normalizarTransmissao } from './transmissoes'

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/soccer'
const STANDINGS_BASE = 'https://site.api.espn.com/apis/v2/sports/soccer'

const H = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9',
}

/**
 * Códigos de liga reconhecidos pela ESPN. Esse mapa também serve
 * como catálogo para a rota `/api/futebol-internacional/ligas`.
 */
export interface LigaInternacional {
  slug: string
  nome: string
  codigo: string
  pais: string
  regiao: string
  emoji: string
  ativo: boolean
}

export const LIGAS_INTERNACIONAIS: LigaInternacional[] = [
  // Europa - principais
  { slug: 'champions-league',  nome: 'UEFA Champions League', codigo: 'uefa.champions',   pais: 'Europa',     regiao: 'continental', emoji: '🏆', ativo: true },
  { slug: 'europa-league',     nome: 'UEFA Europa League',    codigo: 'uefa.europa',      pais: 'Europa',     regiao: 'continental', emoji: '🥈', ativo: true },
  { slug: 'conference-league', nome: 'UEFA Conference League',codigo: 'uefa.europa.conf', pais: 'Europa',     regiao: 'continental', emoji: '🥉', ativo: true },
  { slug: 'premier-league',    nome: 'Premier League',        codigo: 'eng.1',            pais: 'Inglaterra', regiao: 'liga',        emoji: '🦁', ativo: true },
  { slug: 'la-liga',           nome: 'La Liga',               codigo: 'esp.1',            pais: 'Espanha',    regiao: 'liga',        emoji: '🇪🇸', ativo: true },
  { slug: 'serie-a-italia',    nome: 'Serie A (Itália)',      codigo: 'ita.1',            pais: 'Itália',     regiao: 'liga',        emoji: '🇮🇹', ativo: true },
  { slug: 'bundesliga',        nome: 'Bundesliga',            codigo: 'ger.1',            pais: 'Alemanha',   regiao: 'liga',        emoji: '🇩🇪', ativo: true },
  { slug: 'ligue-1',           nome: 'Ligue 1',               codigo: 'fra.1',            pais: 'França',     regiao: 'liga',        emoji: '🇫🇷', ativo: true },
  // Copa do Mundo
  { slug: 'copa-do-mundo',     nome: 'Copa do Mundo FIFA 2026', codigo: 'fifa.world',     pais: 'Mundial',    regiao: 'selecao',     emoji: '🌍', ativo: true },
  { slug: 'eliminatorias-uefa',     nome: 'Eliminatórias UEFA',     codigo: 'fifa.worldq.uefa',     pais: 'Europa',        regiao: 'selecao', emoji: '⚽', ativo: true },
  { slug: 'eliminatorias-conmebol', nome: 'Eliminatórias CONMEBOL', codigo: 'fifa.worldq.conmebol', pais: 'América do Sul', regiao: 'selecao', emoji: '⚽', ativo: true },
]

const STATUS_MAP: Record<string, Jogo['status']> = {
  STATUS_SCHEDULED: 'agendado',
  STATUS_IN_PROGRESS: 'ao_vivo',
  STATUS_HALFTIME: 'ao_vivo',
  STATUS_FULL_TIME: 'encerrado',
  STATUS_FINAL: 'encerrado',
  STATUS_POSTPONED: 'adiado',
  STATUS_CANCELED: 'cancelado',
}

function extrairTransmissoes(comps: Record<string, unknown>): string[] {
  const nomes = new Set<string>()
  const broadcasts = (comps.broadcasts as Record<string, unknown>[]) ?? []
  for (const b of broadcasts) {
    const arr = (b.names as string[] | undefined) ?? []
    for (const n of arr) if (n?.trim()) nomes.add(n.trim())
  }
  const geo = (comps.geoBroadcasts as Record<string, unknown>[]) ?? []
  for (const g of geo) {
    const media = (g.media as Record<string, unknown> | undefined) ?? {}
    const nm = (media.shortName as string) ?? (media.name as string)
    if (nm?.trim()) nomes.add(nm.trim())
  }
  const single = String(comps.broadcast ?? '').trim()
  if (single) nomes.add(single)
  return Array.from(nomes)
}

function parseEvento(ev: Record<string, unknown>, liga: LigaInternacional): Jogo | null {
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

  const nomesTransmissao = extrairTransmissoes(comps)
  const detectadas: Transmissao[] = nomesTransmissao.length
    ? nomesTransmissao.map(normalizarTransmissao)
    : []
  const transmissoes = mesclarTransmissoes(detectadas, liga.codigo)

  return {
    id: `${liga.slug}-${ev.id}`,
    mandante: homeTeam.displayName,
    visitante: awayTeam.displayName,
    escudoMandante: homeTeam.logo ?? null,
    escudoVisitante: awayTeam.logo ?? null,
    campeonato: liga.nome,
    campeonatoSlug: liga.slug,
    data: dataStr,
    horario,
    estadio: (venue?.fullName as string) ?? null,
    cidade: ((venue?.address as Record<string, string>)?.city) ?? null,
    status: STATUS_MAP[status?.name] ?? 'agendado',
    placarMandante: Number(home.score) || null,
    placarVisitante: Number(away.score) || null,
    transmissoes,
    fonte: `espn-${liga.codigo}`,
  }
}

/**
 * Jogos do dia para uma liga internacional.
 */
export async function scraperJogosLigaHoje(ligaSlug: string, data?: string): Promise<Jogo[]> {
  const liga = LIGAS_INTERNACIONAIS.find(l => l.slug === ligaSlug)
  if (!liga) {
    logger.warn(`[futebol-int] liga desconhecida: ${ligaSlug}`)
    return []
  }

  try {
    const dateParam = data ? `?dates=${data.replace(/-/g, '')}` : ''
    const { data: res } = await withRetry(
      () => axios.get(`${SITE}/${liga.codigo}/scoreboard${dateParam}`, { headers: H, timeout: 10000 }),
      { retries: 2, label: `espn:soccer:${liga.codigo}` }
    )
    const events = (res.events ?? []) as Record<string, unknown>[]
    const jogos = events.map(e => parseEvento(e, liga)).filter((j): j is Jogo => j !== null)
    logger.info(`[futebol-int:${liga.slug}] ${jogos.length} jogos`)
    return jogos
  } catch (e) {
    logger.error(`[futebol-int:${liga.slug}] ${e}`)
    return []
  }
}

/**
 * Próximos jogos de uma liga, varrendo N dias à frente.
 */
export async function scraperProximosJogosLiga(ligaSlug: string, diasAFrente = 14): Promise<Jogo[]> {
  const hoje = new Date()
  const datas: string[] = []
  for (let i = 0; i <= diasAFrente; i++) {
    const d = new Date(hoje)
    d.setDate(d.getDate() + i)
    datas.push(d.toISOString().split('T')[0])
  }
  const resultados = await Promise.all(datas.map(d => scraperJogosLigaHoje(ligaSlug, d)))
  const jogos = resultados.flat()
  // Remove duplicados por id (caso ESPN repita)
  const vistos = new Set<string>()
  const unicos = jogos.filter(j => {
    if (vistos.has(j.id)) return false
    vistos.add(j.id)
    return true
  })
  unicos.sort((a, b) => a.data.localeCompare(b.data) || a.horario.localeCompare(b.horario))
  return unicos
}

/**
 * Tabela de classificação para a liga (quando aplicável).
 */
export async function scraperTabelaLiga(ligaSlug: string): Promise<PosicaoTabela[]> {
  const liga = LIGAS_INTERNACIONAIS.find(l => l.slug === ligaSlug)
  if (!liga) return []
  try {
    const { data } = await withRetry(
      () => axios.get(`${STANDINGS_BASE}/${liga.codigo}/standings`, { headers: H, timeout: 10000 }),
      { retries: 2, label: `espn:soccer:standings:${liga.codigo}` }
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
    return tabela
  } catch (e) {
    logger.error(`[futebol-int:standings:${ligaSlug}] ${e}`)
    return []
  }
}
