import axios from 'axios'
import { EventoUFC, LutaUFC, LutadorUFC, Transmissao } from '../types'
import { logger } from '../utils/logger'
import { withRetry } from '../utils/retry'
import { mesclarTransmissoes, normalizarTransmissao } from './transmissoes'

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc'

const H = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9',
}

const STATUS_MAP: Record<string, 'agendado' | 'ao_vivo' | 'encerrado'> = {
  STATUS_SCHEDULED: 'agendado',
  STATUS_IN_PROGRESS: 'ao_vivo',
  STATUS_FINAL: 'encerrado',
}

function parseLutador(competitor: Record<string, unknown>): LutadorUFC {
  const ath = (competitor.athlete as Record<string, unknown>) ?? {}
  const flag = (ath.flag as Record<string, unknown> | undefined) ?? {}
  const records = (competitor.records as Record<string, unknown>[]) ?? []
  const cartel = String(records[0]?.summary ?? '')
  return {
    id: String(competitor.id ?? ath.id ?? ''),
    nome: String(ath.fullName ?? ath.displayName ?? '—'),
    apelido: (ath.nickname as string) ?? null,
    pais: (flag.alt as string) ?? null,
    bandeira: (flag.href as string) ?? null,
    cartel: cartel || null,
    foto: (ath.headshot as string) ?? null,
  }
}

function parseLuta(comp: Record<string, unknown>): LutaUFC | null {
  const competitors = (comp.competitors as Record<string, unknown>[]) ?? []
  if (competitors.length < 2) return null
  const status = (comp.status as Record<string, unknown>)?.type as Record<string, string>
  const tipo = comp.type as Record<string, string> | undefined
  const format = comp.format as Record<string, unknown> | undefined
  const rounds = ((format?.regulation as Record<string, unknown>)?.periods as number) ?? 3

  const lutador1 = parseLutador(competitors[0])
  const lutador2 = parseLutador(competitors[1])
  const win1 = competitors[0].winner === true
  const win2 = competitors[1].winner === true
  const vencedor = win1 ? lutador1.nome : win2 ? lutador2.nome : null

  return {
    id: String(comp.id ?? ''),
    categoria: tipo?.abbreviation ?? tipo?.text ?? 'Indefinido',
    lutador1,
    lutador2,
    rounds,
    vencedor,
    metodo: null,
    roundFim: null,
    tempoFim: null,
    status: STATUS_MAP[status?.name] ?? 'agendado',
  }
}

function parseEvento(ev: Record<string, unknown>): EventoUFC | null {
  const comps = (ev.competitions as Record<string, unknown>[]) ?? []
  if (!comps.length) return null

  const dt = new Date(String(ev.date ?? ''))
  const dataStr = dt.toISOString().split('T')[0]
  const horario = dt.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })

  const venues = (ev.venues as Record<string, unknown>[]) ?? []
  const venue = venues[0] ?? ((comps[0] as Record<string, unknown>).venue as Record<string, unknown>) ?? {}
  const addr = (venue.address as Record<string, string>) ?? {}

  const lutas = comps.map(parseLuta).filter((l): l is LutaUFC => l !== null)
  const lutaPrincipal = lutas[lutas.length - 1] ?? null // ESPN ordena do primeiro ao main event

  // Transmissões — UFC frequentemente tem Paramount+, ESPN+, Combate no BR
  const broadcastsSet = new Set<string>()
  for (const c of comps) {
    const bs = (c.broadcasts as Record<string, unknown>[]) ?? []
    for (const b of bs) {
      const names = (b.names as string[] | undefined) ?? []
      for (const n of names) if (n?.trim()) broadcastsSet.add(n.trim())
    }
    const single = (c.broadcast as string | undefined)
    if (single?.trim()) broadcastsSet.add(single.trim())
  }
  const detectadas: Transmissao[] = broadcastsSet.size
    ? Array.from(broadcastsSet).map(normalizarTransmissao)
    : [normalizarTransmissao('A confirmar')]
  const transmissoes = mesclarTransmissoes(detectadas, 'ufc')

  const status = (ev.status as Record<string, unknown>)?.type as Record<string, string> | undefined
  const nome = String(ev.name ?? ev.shortName ?? 'UFC')
  // Apelido: parte após ": "
  const apelido = nome.includes(':') ? nome.split(':').slice(1).join(':').trim() : null

  return {
    id: `ufc-${ev.id}`,
    nome,
    apelido,
    data: dataStr,
    horario,
    local: (venue.fullName as string) ?? null,
    cidade: addr.city ?? null,
    pais: addr.country ?? null,
    status: STATUS_MAP[status?.name ?? ''] ?? 'agendado',
    card: 'completo',
    lutaPrincipal,
    lutas,
    transmissoes,
    fonte: 'espn-ufc',
  }
}

export async function scraperUFCProximos(): Promise<EventoUFC[]> {
  try {
    const { data } = await withRetry(
      () => axios.get(`${SITE}/scoreboard`, { headers: H, timeout: 10000 }),
      { retries: 2, label: 'espn:ufc:scoreboard' }
    )
    // O scoreboard normalmente retorna o evento mais próximo agrupando todas as lutas
    const events = (data.events ?? []) as Record<string, unknown>[]
    // Cada "events" da ESPN MMA é uma luta dentro de um event card.
    // O verdadeiro nome do evento vem em `events[].name` (todas iguais para o mesmo card).
    // Agrupamos por nome do evento.
    if (!events.length) {
      logger.info('[ufc:scoreboard] sem eventos no scoreboard, tentando calendário')
      return scraperUFCCalendario()
    }

    // Reconstruir como um EventoUFC único (mesmo card)
    const evento = parseEvento({
      id: events[0].id,
      name: events[0].name,
      shortName: events[0].shortName,
      date: events[0].date,
      status: events[0].status,
      venues: (events[0] as Record<string, unknown>).venues,
      competitions: events.flatMap(e => (e.competitions as Record<string, unknown>[]) ?? []),
    })

    return evento ? [evento] : []
  } catch (e) {
    logger.error(`[ufc:proximos] ${e}`)
    return []
  }
}

/**
 * Lista todo o calendário de eventos UFC do ano corrente,
 * usando o campo `calendar` retornado pelo scoreboard.
 */
export async function scraperUFCCalendario(): Promise<EventoUFC[]> {
  try {
    const { data } = await withRetry(
      () => axios.get(`${SITE}/scoreboard`, { headers: H, timeout: 10000 }),
      { retries: 2, label: 'espn:ufc:calendar' }
    )
    const calendar = (data.leagues?.[0]?.calendar ?? []) as Record<string, unknown>[]
    const hoje = new Date().toISOString().split('T')[0]
    const eventos: EventoUFC[] = []
    for (const c of calendar) {
      const start = String(c.startDate ?? '')
      const dt = new Date(start)
      const dataStr = dt.toISOString().split('T')[0]
      if (dataStr < hoje) continue
      const horario = dt.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
      const ref = (c.event as Record<string, string>)?.['$ref'] ?? ''
      const id = ref.split('/').pop()?.split('?')[0] ?? ''
      const nome = String(c.label ?? 'UFC')
      const apelido = nome.includes(':') ? nome.split(':').slice(1).join(':').trim() : null
      eventos.push({
        id: `ufc-cal-${id}`,
        nome,
        apelido,
        data: dataStr,
        horario,
        local: null,
        cidade: null,
        pais: null,
        status: 'agendado',
        card: 'completo',
        lutaPrincipal: null,
        lutas: [],
        transmissoes: [normalizarTransmissao('UFC Fight Pass'), normalizarTransmissao('Combate'), normalizarTransmissao('Paramount+')],
        fonte: 'espn-ufc-calendar',
      })
    }
    eventos.sort((a, b) => a.data.localeCompare(b.data))
    logger.info(`[ufc:calendario] ${eventos.length} eventos futuros`)
    return eventos
  } catch (e) {
    logger.error(`[ufc:calendario] ${e}`)
    return []
  }
}

/**
 * Detalha um evento UFC específico (com todas as lutas do card).
 */
export async function scraperEventoUFC(eventoId: string): Promise<EventoUFC | null> {
  try {
    // Limpar prefixo se vier como "ufc-..."
    const id = eventoId.replace(/^ufc-(cal-)?/, '')
    const { data } = await withRetry(
      () => axios.get(`${SITE}/scoreboard?event=${id}`, { headers: H, timeout: 10000 }),
      { retries: 2, label: `espn:ufc:event:${id}` }
    )
    const events = (data.events ?? []) as Record<string, unknown>[]
    if (!events.length) return null
    return parseEvento({
      id: events[0].id,
      name: events[0].name,
      shortName: events[0].shortName,
      date: events[0].date,
      status: events[0].status,
      venues: events[0].venues,
      competitions: events.flatMap(e => (e.competitions as Record<string, unknown>[]) ?? []),
    })
  } catch (e) {
    logger.error(`[ufc:evento:${eventoId}] ${e}`)
    return null
  }
}
