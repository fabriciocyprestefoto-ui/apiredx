import axios from 'axios'
import { JogoNBA, DestaqueNBA, PosicaoTabela } from '../types'
import { logger } from '../utils/logger'
import { withRetry } from '../utils/retry'
import { mesclarTransmissoes, normalizarTransmissao } from './transmissoes'

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba'
const STANDINGS = 'https://site.api.espn.com/apis/v2/sports/basketball/nba/standings'

const H = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9',
}

const STATUS_MAP: Record<string, JogoNBA['status']> = {
  STATUS_SCHEDULED: 'agendado',
  STATUS_IN_PROGRESS: 'ao_vivo',
  STATUS_HALFTIME: 'ao_vivo',
  STATUS_END_PERIOD: 'ao_vivo',
  STATUS_FULL_TIME: 'encerrado',
  STATUS_FINAL: 'encerrado',
  STATUS_FINAL_OVERTIME: 'encerrado',
  STATUS_POSTPONED: 'adiado',
  STATUS_CANCELED: 'cancelado',
}

function parseEvento(ev: Record<string, unknown>): JogoNBA | null {
  const comps = ((ev.competitions as Record<string, unknown>[])?.[0]) ?? {}
  const competitors = (comps.competitors as Record<string, unknown>[]) ?? []
  const home = competitors.find(c => c.homeAway === 'home')
  const away = competitors.find(c => c.homeAway === 'away')
  if (!home || !away) return null

  const homeTeam = home.team as Record<string, string>
  const awayTeam = away.team as Record<string, string>
  const venue = comps.venue as Record<string, unknown>
  const status = (ev.status as Record<string, unknown>)?.type as Record<string, string>
  const statusFull = ev.status as Record<string, unknown>

  const dt = new Date(String(ev.date ?? ''))
  const dataStr = dt.toISOString().split('T')[0]
  const horario = dt.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })

  // Quartos
  const homeLines = (home.linescores as Record<string, number>[]) ?? []
  const awayLines = (away.linescores as Record<string, number>[]) ?? []
  const quartosMandante = homeLines.map(l => Number(l.value ?? 0))
  const quartosVisitante = awayLines.map(l => Number(l.value ?? 0))

  // Pontuação e vencedor
  const pontosMandante = home.score != null ? Number(home.score) : null
  const pontosVisitante = away.score != null ? Number(away.score) : null
  const winnerHome = home.winner === true
  const winnerAway = away.winner === true

  // Destaques (líderes da partida)
  const destaques: DestaqueNBA[] = []
  const extrairLideres = (comp: Record<string, unknown>, timeNome: string) => {
    const leaders = (comp.leaders as Record<string, unknown>[]) ?? []
    for (const cat of leaders) {
      const lds = (cat.leaders as Record<string, unknown>[]) ?? []
      const lead = lds[0]
      if (!lead) continue
      const ath = lead.athlete as Record<string, unknown> | undefined
      if (!ath) continue
      destaques.push({
        jogador: String(ath.fullName ?? ath.displayName ?? '—'),
        time: timeNome,
        estatistica: String(cat.displayName ?? cat.name ?? ''),
        valor: String(lead.displayValue ?? lead.value ?? ''),
        foto: (ath.headshot as string) ?? null,
      })
    }
  }
  extrairLideres(home, homeTeam.displayName)
  extrairLideres(away, awayTeam.displayName)

  // Transmissões
  const broadcasts = (comps.broadcasts as Record<string, unknown>[]) ?? []
  const nomesTransmissao = new Set<string>()
  for (const b of broadcasts) {
    const names = (b.names as string[] | undefined) ?? []
    for (const n of names) if (n?.trim()) nomesTransmissao.add(n.trim())
  }
  const geoBroadcasts = (comps.geoBroadcasts as Record<string, unknown>[]) ?? []
  for (const g of geoBroadcasts) {
    const media = (g.media as Record<string, unknown> | undefined) ?? {}
    const nm = (media.shortName as string) ?? (media.name as string)
    if (nm?.trim()) nomesTransmissao.add(nm.trim())
  }
  const detectadas = nomesTransmissao.size
    ? Array.from(nomesTransmissao).map(normalizarTransmissao)
    : [normalizarTransmissao('A confirmar')]
  const transmissoes = mesclarTransmissoes(detectadas, 'nba')

  // Série de playoffs
  const series = comps.series as Record<string, unknown> | undefined
  const serie = series ? String(series.summary ?? '') : null

  return {
    id: `nba-${ev.id}`,
    mandante: homeTeam.displayName,
    visitante: awayTeam.displayName,
    abreviacaoMandante: homeTeam.abbreviation ?? '',
    abreviacaoVisitante: awayTeam.abbreviation ?? '',
    logoMandante: homeTeam.logo ?? null,
    logoVisitante: awayTeam.logo ?? null,
    data: dataStr,
    horario,
    arena: (venue?.fullName as string) ?? null,
    cidade: ((venue?.address as Record<string, string>)?.city) ?? null,
    status: STATUS_MAP[status?.name] ?? 'agendado',
    pontosMandante,
    pontosVisitante,
    periodo: statusFull?.period != null ? Number(statusFull.period) : null,
    tempoRestante: (statusFull?.displayClock as string) ?? null,
    quartos: { mandante: quartosMandante, visitante: quartosVisitante },
    serie,
    vencedor: winnerHome ? 'mandante' : winnerAway ? 'visitante' : null,
    destaques,
    transmissoes,
    fonte: 'espn-nba',
  }
}

export async function scraperJogosNBAHoje(): Promise<JogoNBA[]> {
  try {
    const { data } = await withRetry(
      () => axios.get(`${SITE}/scoreboard`, { headers: H, timeout: 10000 }),
      { retries: 2, label: 'espn:nba:scoreboard' }
    )
    const events = (data.events ?? []) as Record<string, unknown>[]
    const jogos = events.map(parseEvento).filter((j): j is JogoNBA => j !== null)
    logger.info(`[nba:hoje] ${jogos.length} jogos`)
    return jogos
  } catch (e) {
    logger.error(`[nba:hoje] ${e}`)
    return []
  }
}

export async function scraperJogosNBAPorData(data: string): Promise<JogoNBA[]> {
  try {
    const dateStr = data.replace(/-/g, '')
    const { data: res } = await withRetry(
      () => axios.get(`${SITE}/scoreboard?dates=${dateStr}`, { headers: H, timeout: 10000 }),
      { retries: 2, label: `espn:nba:scoreboard:${data}` }
    )
    const events = (res.events ?? []) as Record<string, unknown>[]
    const jogos = events.map(parseEvento).filter((j): j is JogoNBA => j !== null)
    logger.info(`[nba:${data}] ${jogos.length} jogos`)
    return jogos
  } catch (e) {
    logger.error(`[nba:porData] ${e}`)
    return []
  }
}

export async function scraperProximosJogosNBA(diasAFrente = 7): Promise<JogoNBA[]> {
  const hoje = new Date()
  const datas: string[] = []
  for (let i = 0; i <= diasAFrente; i++) {
    const d = new Date(hoje)
    d.setDate(d.getDate() + i)
    datas.push(d.toISOString().split('T')[0])
  }
  const resultados = await Promise.all(datas.map(d => scraperJogosNBAPorData(d)))
  const jogos = resultados.flat()
  jogos.sort((a, b) => a.data.localeCompare(b.data) || a.horario.localeCompare(b.horario))
  return jogos
}

export async function scraperTabelaNBA(): Promise<{ leste: PosicaoTabela[]; oeste: PosicaoTabela[] }> {
  try {
    const { data } = await withRetry(
      () => axios.get(STANDINGS, { headers: H, timeout: 10000 }),
      { retries: 2, label: 'espn:nba:standings' }
    )
    const groups = (data.children ?? []) as Record<string, unknown>[]
    const parseGrupo = (g: Record<string, unknown>): PosicaoTabela[] => {
      const entries = ((g.standings as Record<string, unknown>)?.entries as Record<string, unknown>[]) ?? []
      return entries.map((entry, idx) => {
        const team = entry.team as Record<string, unknown>
        const stats = (entry.stats as Record<string, unknown>[]) ?? []
        const getStat = (...abbrs: string[]) => {
          for (const abbr of abbrs) {
            const s = stats.find(s => s.abbreviation === abbr) as Record<string, unknown> | undefined
            if (s?.value != null) return Number(s.value)
          }
          return 0
        }
        const vitorias = getStat('W')
        const derrotas = getStat('L')
        const jogos = vitorias + derrotas
        const logos = (team.logos as Record<string, unknown>[]) ?? []
        return {
          posicao: idx + 1,
          time: String(team.displayName ?? ''),
          escudo: (logos[0]?.href as string) ?? null,
          jogos,
          pontos: vitorias, // basquete não usa pontos; manda vitórias
          vitorias,
          empates: 0,
          derrotas,
          golsPro: 0,
          golsContra: 0,
          saldoGols: 0,
          aproveitamento: jogos > 0 ? Math.round((vitorias / jogos) * 100) : 0,
        }
      })
    }
    const leste = parseGrupo(groups.find(g => /east/i.test(String(g.name))) ?? groups[0] ?? {})
    const oeste = parseGrupo(groups.find(g => /west/i.test(String(g.name))) ?? groups[1] ?? {})
    logger.info(`[nba:standings] leste=${leste.length} oeste=${oeste.length}`)
    return { leste, oeste }
  } catch (e) {
    logger.error(`[nba:standings] ${e}`)
    return { leste: [], oeste: [] }
  }
}
