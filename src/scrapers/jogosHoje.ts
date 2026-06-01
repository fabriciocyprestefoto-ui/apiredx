import axios from 'axios'
import * as cheerio from 'cheerio'
import { Jogo, Transmissao } from '../types'
import { logger } from '../utils/logger'
import { slugify } from '../utils/slugify'
import { TIMES_BRASILEIROS } from '../data/times'
import { withRetry } from '../utils/retry'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
const HEADERS = { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9' }

function resolveStatus(tipo: string): Jogo['status'] {
  const m: Record<string, Jogo['status']> = {
    notstarted:'agendado', inprogress:'ao_vivo', finished:'encerrado',
    postponed:'adiado', canceled:'cancelado'
  }
  return m[tipo?.toLowerCase()] ?? 'agendado'
}

async function scraperSofascore(data: string): Promise<Jogo[]> {
  const url = `https://www.sofascore.com/api/v1/sport/football/scheduled-events/${data}`
  const { data: res } = await withRetry(
    () => axios.get(url, { headers: HEADERS, timeout: 8000 }),
    { retries: 2, label: 'sofascore' }
  )
  const eventos = (res.events ?? []) as Record<string, unknown>[]
  const nomes = new Set(TIMES_BRASILEIROS.map(t => t.nome.toLowerCase()))

  return eventos
    .filter(e => {
      const h = ((e.homeTeam as Record<string,unknown>)?.name as string)?.toLowerCase() ?? ''
      const a = ((e.awayTeam as Record<string,unknown>)?.name as string)?.toLowerCase() ?? ''
      return nomes.has(h) || nomes.has(a)
    })
    .map(e => {
      const home = e.homeTeam as Record<string,unknown>
      const away = e.awayTeam as Record<string,unknown>
      const tour = e.tournament as Record<string,unknown>
      const hs = e.homeScore as Record<string,unknown>
      const as_ = e.awayScore as Record<string,unknown>
      const venue = e.venue as Record<string,unknown>
      const ts = e.startTimestamp as number
      const dt = new Date(ts * 1000)
      return {
        id: String(e.id),
        mandante: home?.name as string,
        visitante: away?.name as string,
        escudoMandante: `https://api.sofascore.app/api/v1/team/${home?.id}/image`,
        escudoVisitante: `https://api.sofascore.app/api/v1/team/${away?.id}/image`,
        campeonato: (tour?.name as string) ?? 'Desconhecido',
        campeonatoSlug: slugify((tour?.name as string) ?? ''),
        data: dt.toISOString().split('T')[0],
        horario: dt.toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}),
        estadio: (venue?.name as string) ?? null,
        cidade: ((venue?.city as Record<string,unknown>)?.name as string) ?? null,
        status: resolveStatus((e.status as Record<string,unknown>)?.type as string),
        placarMandante: (hs?.current as number) ?? null,
        placarVisitante: (as_?.current as number) ?? null,
        transmissoes: [] as Transmissao[],
        fonte: 'sofascore',
      } satisfies Jogo
    })
}

async function scraperESPN(data: string): Promise<Jogo[]> {
  const [ano,mes,dia] = data.split('-')
  const url = `https://www.espn.com.br/futebol/jogos/_/data/${ano}${mes}${dia}`
  const { data: html } = await withRetry(
    () => axios.get(url, { headers: HEADERS, timeout: 8000 }),
    { retries: 2, label: 'espn-html' }
  )
  const $ = cheerio.load(html)
  const jogos: Jogo[] = []
  $('.ScoreboardScoreCell').each((_,el) => {
    const m = $(el).find('.ScoreboardScoreCell__Item--home .ScoreCell__TeamName').text().trim()
    const v = $(el).find('.ScoreboardScoreCell__Item--away .ScoreCell__TeamName').text().trim()
    const h = $(el).find('.ScoreboardScoreCell__Time').text().trim() || '00:00'
    if (!m || !v) return
    jogos.push({ id:`espn-${slugify(m)}-${slugify(v)}-${data}`, mandante:m, visitante:v,
      escudoMandante:null, escudoVisitante:null, campeonato:'Desconhecido',
      campeonatoSlug:'desconhecido', data, horario:h, estadio:null, cidade:null,
      status:'agendado', placarMandante:null, placarVisitante:null, transmissoes:[], fonte:'espn' })
  })
  return jogos
}

export async function scraperJogos(data: string): Promise<Jogo[]> {
  try { const r = await scraperSofascore(data); logger.info(`[jogos] sofascore: ${r.length}`); return r }
  catch(e) { logger.warn(`[jogos] sofascore falhou: ${e}`) }
  try { const r = await scraperESPN(data); logger.info(`[jogos] espn: ${r.length}`); return r }
  catch(e) { logger.error(`[jogos] todos scrapers falharam: ${e}`); return [] }
}
