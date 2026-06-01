/**
 * Scraper NBA enriquecido
 * Fontes:
 *   1. site.api.espn.com/apis/site/v2/sports/basketball/nba  (ESPN API — já existia)
 *   2. espn.com.br/nba/times                                  (ESPN BR — times PT-BR)
 *   3. espn.com.br/nba/classificacao                          (ESPN BR classificação)
 *   4. espn.com.br/nba/                                       (ESPN BR notícias)
 *
 * A API ESPN (site.api.espn.com) retorna dados ricos em JSON sem scraping HTML.
 * O ESPN Brasil adiciona: nomes em PT-BR, slugs brasileiros, notícias em português.
 */

import axios from 'axios'
import * as cheerio from 'cheerio'
import https from 'https'
import { logger } from '../utils/logger'
import { withRetry } from '../utils/retry'

const AGENT = new https.Agent({ rejectUnauthorized: false })

const H_API = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9',
}

const H_BROWSER = {
  ...H_API,
  'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
  'Cache-Control': 'no-cache',
}

const ESPN_NBA_API = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba'

// ─── Times NBA ESPN BR (HTML scraping) ───────────────────────────────────────

export interface TimeNBABR {
  nome: string
  nomePT: string
  abreviacao: string
  divisao: string
  conferencia: string
  urlESPNBR: string
  slug: string
}

/** Divisão → Conferência */
const DIVISAO_CONFERENCIA: Record<string, string> = {
  'Atlântico': 'Leste', 'Central': 'Leste', 'Sudeste': 'Leste',
  'Noroeste': 'Oeste', 'Pacífico': 'Oeste', 'Sudoeste': 'Oeste',
  // EN fallbacks
  'Atlantic': 'East', 'Central': 'East', 'Southeast': 'East',
  'Northwest': 'West', 'Pacific': 'West', 'Southwest': 'West',
}

export async function scraperTimesNBABR(): Promise<TimeNBABR[]> {
  try {
    const { data: html } = await withRetry(
      () => axios.get('https://www.espn.com.br/nba/times', {
        headers: H_BROWSER,
        httpsAgent: AGENT,
        timeout: 15000,
      }),
      { retries: 2, label: 'espn.com.br:nba:times' }
    )

    const $ = cheerio.load(html)
    const times: TimeNBABR[] = []
    let divisaoAtual = ''

    // Iteração por divisão e times
    // Estrutura: .mt7 > .headline (divisão) + .ContentList > .ContentList__Item
    $('.mt7').each((_, divEl) => {
      const $div = $(divEl)
      divisaoAtual = $div.find('.headline').first().text().trim()

      $div.find('.ContentList__Item, .TeamLinks').each((_, item) => {
        const $item = $(item)
        const $link = $item.find('a[href*="/nba/time/"]').first()
        const nomePT = $item.find('h2').text().trim() || $link.text().trim()
        if (!nomePT) return

        const href = $link.attr('href') || ''
        // href ex: /nba/time/_/nome/bos/boston-celtics
        const hrefParts = href.split('/nome/')
        const slugParts = hrefParts[1]?.split('/') || []
        const abreviacao = (slugParts[0] || '').toUpperCase()
        const slug = slugParts[1] || nomePT.toLowerCase().replace(/\s+/g, '-')

        times.push({
          nome: slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          nomePT,
          abreviacao,
          divisao: divisaoAtual,
          conferencia: DIVISAO_CONFERENCIA[divisaoAtual] || 'Desconhecido',
          urlESPNBR: `https://www.espn.com.br${href}`,
          slug,
        })
      })
    })

    logger.info(`[espn.com.br:nba:times] ${times.length} times`)
    return times
  } catch (e) {
    logger.error(`[espn.com.br:nba:times] ${e}`)
    return []
  }
}

// ─── Notícias NBA ESPN BR ─────────────────────────────────────────────────────

export interface NoticiaESPNBR {
  titulo: string
  resumo: string | null
  url: string
  imagem: string | null
  data: string | null
  categoria: string
}

export async function scraperNoticiasNBABR(limite = 20): Promise<NoticiaESPNBR[]> {
  try {
    const { data: html } = await withRetry(
      () => axios.get('https://www.espn.com.br/nba/', {
        headers: H_BROWSER,
        httpsAgent: AGENT,
        timeout: 15000,
      }),
      { retries: 2, label: 'espn.com.br:nba:noticias' }
    )

    const $ = cheerio.load(html)
    const noticias: NoticiaESPNBR[] = []

    // Artigos de notícias ESPN
    $('article, .contentItem, .headlineStack__list li, .FeedItem').each((_, el) => {
      const $el = $(el)
      const $link = $el.find('a[href]').first()
      const href = $link.attr('href') || ''
      if (!href || href === '#') return

      const titulo = $el.find('h1, h2, h3, .headline, .contentItem__title').first().text().trim()
        || $link.attr('title') || ''
      if (!titulo) return

      const resumo = $el.find('p, .contentItem__subline').first().text().trim() || null
      let imagem = $el.find('img[src]').first().attr('src') || null
      if (imagem?.includes('data:image')) imagem = null

      const url = href.startsWith('http') ? href : `https://www.espn.com.br${href}`
      const data = $el.find('time[datetime]').attr('datetime')?.split('T')[0] || null

      if (noticias.length >= limite) return false

      noticias.push({
        titulo,
        resumo,
        url,
        imagem,
        data,
        categoria: 'NBA',
      })
    })

    logger.info(`[espn.com.br:nba:noticias] ${noticias.length} notícias`)
    return noticias.slice(0, limite)
  } catch (e) {
    logger.error(`[espn.com.br:nba:noticias] ${e}`)
    return []
  }
}

// ─── Classificação NBA ESPN BR ────────────────────────────────────────────────

export interface ClassificacaoNBABR {
  posicao: number
  time: string
  abreviacao: string
  conferencia: 'Leste' | 'Oeste'
  vitorias: number
  derrotas: number
  pct: number
  gb: string | null
}

export async function scraperClassificacaoNBABR(): Promise<{ leste: ClassificacaoNBABR[]; oeste: ClassificacaoNBABR[] }> {
  try {
    const { data: html } = await withRetry(
      () => axios.get('https://www.espn.com.br/nba/classificacao', {
        headers: H_BROWSER,
        httpsAgent: AGENT,
        timeout: 15000,
      }),
      { retries: 2, label: 'espn.com.br:nba:classificacao' }
    )

    const $ = cheerio.load(html)
    const leste: ClassificacaoNBABR[] = []
    const oeste: ClassificacaoNBABR[] = []

    // ESPN classificação usa tabelas com .Table__Scroller
    $('table').each((tableIdx, table) => {
      const conferencia: 'Leste' | 'Oeste' = tableIdx === 0 ? 'Leste' : 'Oeste'
      const destino = conferencia === 'Leste' ? leste : oeste

      $(table).find('tbody tr').each((rowIdx, row) => {
        const cells = $(row).find('td')
        if (cells.length < 4) return

        const timeCell = cells.eq(0)
        const time = timeCell.find('.hide-mobile').text().trim()
          || timeCell.find('a').text().trim()
          || timeCell.text().trim()
        const abreviacao = timeCell.find('.show-mobile, abbr').text().trim() || time.slice(0, 3)
        const vitorias = parseInt(cells.eq(1).text().trim()) || 0
        const derrotas = parseInt(cells.eq(2).text().trim()) || 0
        const pct = parseFloat(cells.eq(3).text().trim().replace(',', '.')) || 0
        const gb = cells.eq(4)?.text().trim() || null

        if (!time) return

        destino.push({
          posicao: rowIdx + 1,
          time,
          abreviacao,
          conferencia,
          vitorias,
          derrotas,
          pct: isNaN(pct) ? Math.round((vitorias / Math.max(vitorias + derrotas, 1)) * 1000) / 1000 : pct,
          gb: gb === '-' ? null : gb,
        })
      })
    })

    logger.info(`[espn.com.br:nba:class] leste=${leste.length} oeste=${oeste.length}`)
    return { leste, oeste }
  } catch (e) {
    logger.error(`[espn.com.br:nba:classificacao] ${e}`)
    return { leste: [], oeste: [] }
  }
}

// ─── Artilharia NBA ESPN API ──────────────────────────────────────────────────

export interface ArtilheiroNBA {
  posicao: number
  jogador: string
  time: string
  foto: string | null
  ppg: number  // pontos por jogo
  rpg: number  // rebotes por jogo
  apg: number  // assistências por jogo
}

export async function scraperArtilhariaNA(): Promise<ArtilheiroNBA[]> {
  try {
    const { data } = await withRetry(
      () => axios.get(`${ESPN_NBA_API}/leaders`, { headers: H_API, timeout: 10000 }),
      { retries: 2, label: 'espn:nba:leaders' }
    )

    const categories = (data.categories ?? []) as Record<string, unknown>[]
    const pointsLeaders = categories.find(c =>
      String(c.name ?? '').toLowerCase().includes('point') ||
      String(c.abbreviation ?? '').toLowerCase() === 'ppg'
    )

    if (!pointsLeaders) return []

    const leaders = (pointsLeaders.leaders as Record<string, unknown>[]) ?? []
    return leaders.slice(0, 25).map((l, idx) => {
      const ath = l.athlete as Record<string, unknown> | undefined
      const team = l.team as Record<string, unknown> | undefined
      const stats = (l.statistics as Record<string, unknown>[]) ?? []

      const getStat = (name: string): number => {
        const s = stats.find(s => String(s.name ?? '').toLowerCase().includes(name))
        return Number((s as Record<string, unknown> | undefined)?.value ?? 0)
      }

      return {
        posicao: idx + 1,
        jogador: String(ath?.fullName ?? ath?.displayName ?? '—'),
        time: String(team?.displayName ?? '—'),
        foto: (ath?.headshot as string) ?? null,
        ppg: Number(l.value ?? 0),
        rpg: getStat('rebound'),
        apg: getStat('assist'),
      }
    })
  } catch (e) {
    logger.error(`[espn:nba:leaders] ${e}`)
    return []
  }
}

// ─── Full NBA package ─────────────────────────────────────────────────────────

export interface NBAEnriquecido {
  fontes: string[]
  times: TimeNBABR[]
  noticias: NoticiaESPNBR[]
  classificacaoBR: { leste: ClassificacaoNBABR[]; oeste: ClassificacaoNBABR[] }
  artilheiros: ArtilheiroNBA[]
  atualizadoEm: string
}

export async function scraperNBAEnriquecido(): Promise<NBAEnriquecido> {
  const [times, noticias, classificacaoBR, artilheiros] = await Promise.allSettled([
    scraperTimesNBABR(),
    scraperNoticiasNBABR(30),
    scraperClassificacaoNBABR(),
    scraperArtilhariaNA(),
  ])

  return {
    fontes: ['espn.com.br/nba', 'site.api.espn.com'],
    times: times.status === 'fulfilled' ? times.value : [],
    noticias: noticias.status === 'fulfilled' ? noticias.value : [],
    classificacaoBR: classificacaoBR.status === 'fulfilled'
      ? classificacaoBR.value
      : { leste: [], oeste: [] },
    artilheiros: artilheiros.status === 'fulfilled' ? artilheiros.value : [],
    atualizadoEm: new Date().toISOString(),
  }
}
