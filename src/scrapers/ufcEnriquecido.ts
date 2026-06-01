/**
 * Scraper UFC enriquecido
 * Fontes:
 *   1. site.api.espn.com/apis/site/v2/sports/mma/ufc  (ESPN — já existia)
 *   2. ufc.com/events                                  (UFC.com Drupal HTML — nova fonte)
 *   3. espn.com.br/mma/calendario                      (ESPN BR — nova fonte)
 *
 * Estratégia: ESPN API como base principal; UFC.com enriquece com imagens de evento,
 * local, timestamps precisos e links de ingressos.
 */

import axios from 'axios'
import * as cheerio from 'cheerio'
import https from 'https'
import { logger } from '../utils/logger'
import { withRetry } from '../utils/retry'
import { EventoUFC } from '../types'
import { normalizarTransmissao } from './transmissoes'

const AGENT = new https.Agent({ rejectUnauthorized: false })

const H_BROWSER = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
}

export interface EventoUFCEnriquecido extends EventoUFC {
  imagemEvento?: string | null
  linkEvento?: string | null
  ticketsUrl?: string | null
  prelims?: { horario: string; timestamp: number } | null
  mainCard?: { horario: string; timestamp: number } | null
  assistirUrl?: string | null
  fontes: string[]
}

/** Converte timestamp unix para horário BRT */
function timestampParaHorarioBRT(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Converte timestamp unix para data ISO (YYYY-MM-DD) BRT */
function timestampParaDataBRT(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('sv-SE', {
    timeZone: 'America/Sao_Paulo',
  })
}

// ─── UFC.com scraper ──────────────────────────────────────────────────────────

export interface EventoUFCCom {
  nome: string
  subtitulo: string | null
  slug: string
  data: string
  horario: string
  prelims: { horario: string; timestamp: number } | null
  mainCard: { horario: string; timestamp: number } | null
  imagemEvento: string | null
  linkEvento: string
  ticketsUrl: string | null
  assistirUrl: string | null
  transmissao: string | null
}

export async function scraperEventosUFCCom(): Promise<EventoUFCCom[]> {
  try {
    const { data: html } = await withRetry(
      () => axios.get('https://www.ufc.com/events', {
        headers: H_BROWSER,
        httpsAgent: AGENT,
        timeout: 20000,
      }),
      { retries: 2, label: 'ufc.com:events' }
    )

    const $ = cheerio.load(html)
    const eventos: EventoUFCCom[] = []
    const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })

    // Upcoming events — dentro de #events-list-upcoming
    $('[id="events-list-upcoming"] .l-listing__item, [id="events-list-upcoming"] .views-row').each((_, el) => {
      try {
        const $el = $(el)

        // Nome do evento (hero ou card)
        let nome = $el.find('.c-hero--full__headline').text().trim()
        if (!nome) nome = $el.find('.c-card-event--result__headline').text().trim()
        if (!nome) nome = $el.find('h2').first().text().trim()
        if (!nome) nome = 'UFC Event'

        let subtitulo = $el.find('.c-hero--full__headline-prefix').text().trim() || null
        if (!subtitulo) subtitulo = $el.find('.c-card-event--result__title').text().trim() || null

        // Link do evento
        let linkEvento = $el.find('a[href*="/event/"]').first().attr('href') || ''
        if (!linkEvento) linkEvento = $el.find('.e-button').first().attr('href') || ''
        if (linkEvento && !linkEvento.startsWith('http')) linkEvento = `https://www.ufc.com${linkEvento}`

        // Slug para matching
        const slug = linkEvento.split('/event/')[1]?.split('?')[0] || ''

        // Imagem do evento
        let imagemEvento: string | null = null
        const imgEl = $el.find('picture source, img').first()
        imagemEvento = imgEl.attr('srcset')?.split(' ')[0] || imgEl.attr('src') || null
        // Try the background hero image
        if (!imagemEvento) {
          const bgSrc = $el.find('picture source').first().attr('srcset')
          if (bgSrc) imagemEvento = bgSrc.split(' ')[0]
        }

        // Timestamps de prelims e main card
        let prelims: { horario: string; timestamp: number } | null = null
        let mainCard: { horario: string; timestamp: number } | null = null
        let primeiroTimestamp: number | null = null

        $el.find('.c-listing-viewing-option__time[data-timestamp]').each((i, timeEl) => {
          const ts = parseInt($(timeEl).attr('data-timestamp') || '0', 10)
          if (!ts) return
          if (i === 0) {
            primeiroTimestamp = ts
            prelims = { horario: timestampParaHorarioBRT(ts), timestamp: ts }
          } else if (i === 1) {
            mainCard = { horario: timestampParaHorarioBRT(ts), timestamp: ts }
          }
        })

        // Data do evento a partir do primeiro timestamp de prelims
        let data = hoje
        if (primeiroTimestamp) {
          data = timestampParaDataBRT(primeiroTimestamp)
        } else {
          // Fallback: ticket dates
          $el.find('.c-listing-ticket__date[data-timestamp]').first().each((_, el) => {
            const ts = parseInt($(el).attr('data-timestamp') || '0', 10)
            if (ts) data = timestampParaDataBRT(ts)
          })
        }

        if (data < hoje) return // skip past

        const horario = prelims?.horario || mainCard?.horario || '--:--'

        // Tickets URL
        const ticketsUrl = $el.find('a[href*="axs.com"], a[href*="ticketmaster"], a[href*="tickets"]')
          .filter((_, a) => !$(a).attr('href')?.includes('ufc.com/tickets'))
          .first().attr('href') || null

        // Transmissão
        let assistirUrl: string | null = null
        let transmissao: string | null = null
        $el.find('.e-button--black-outlined, .e-button--white').each((_, btn) => {
          const href = $(btn).attr('href') || ''
          const text = $(btn).text().trim()
          if (text.toLowerCase().includes('paramount')) {
            assistirUrl = href
            transmissao = 'Paramount+'
          } else if (text.toLowerCase().includes('espn')) {
            assistirUrl = href
            transmissao = 'ESPN+'
          } else if (text.toLowerCase().includes('fight pass')) {
            assistirUrl = href
            transmissao = 'UFC Fight Pass'
          }
        })

        if (!nome || !linkEvento) return

        eventos.push({
          nome: subtitulo ? `${subtitulo}: ${nome}` : nome,
          subtitulo,
          slug,
          data,
          horario,
          prelims,
          mainCard,
          imagemEvento,
          linkEvento,
          ticketsUrl,
          assistirUrl,
          transmissao,
        })
      } catch (err) {
        logger.warn(`[ufc.com:evento] parse error: ${err}`)
      }
    })

    // Se não encontrou nada com upcoming, pega os article.c-card-event--result
    if (!eventos.length) {
      $('article.c-card-event--result').each((_, el) => {
        const $el = $(el)
        let nome = $el.find('.c-card-event--result__headline').text().trim()
        if (!nome) nome = 'UFC Event'
        let linkEvento = $el.find('a[href*="/event/"]').first().attr('href') || ''
        if (linkEvento && !linkEvento.startsWith('http')) linkEvento = `https://www.ufc.com${linkEvento}`
        const slug = linkEvento.split('/event/')[1]?.split('?')[0] || ''
        eventos.push({
          nome,
          subtitulo: null,
          slug,
          data: hoje,
          horario: '--:--',
          prelims: null,
          mainCard: null,
          imagemEvento: null,
          linkEvento,
          ticketsUrl: null,
          assistirUrl: null,
          transmissao: null,
        })
      })
    }

    logger.info(`[ufc.com:events] ${eventos.length} eventos encontrados`)
    return eventos
  } catch (e) {
    logger.error(`[ufc.com:events] ${e}`)
    return []
  }
}

// ─── ESPN MMA calendário ──────────────────────────────────────────────────────

export interface CalendarioESPNMMA {
  nome: string
  data: string
  horario: string
  url: string | null
}

export async function scraperCalendarioESPNMMA(): Promise<CalendarioESPNMMA[]> {
  try {
    const { data: html } = await withRetry(
      () => axios.get('https://www.espn.com.br/mma/calendario', {
        headers: H_BROWSER,
        httpsAgent: AGENT,
        timeout: 15000,
      }),
      { retries: 2, label: 'espn.com.br:mma:calendario' }
    )

    const $ = cheerio.load(html)
    const eventos: CalendarioESPNMMA[] = []
    const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })

    // ESPN calendário usa tabelas de schedule
    $('table.schedule__table tbody tr, .Table__TR, .scheduleTable__row').each((_, row) => {
      const $row = $(row)
      const cells = $row.find('td')
      if (cells.length < 2) return

      const dateCell = cells.eq(0).text().trim()
      const eventCell = cells.eq(1)
      const nome = eventCell.find('a').first().text().trim() || eventCell.text().trim()
      const url = eventCell.find('a').first().attr('href') || null

      // Tenta parsear data — formato típico ESPN: "sáb., 1 jun"
      // Data real pode estar num atributo data-* ou no texto
      if (!nome || !dateCell) return

      eventos.push({
        nome,
        data: hoje, // fallback — ESPN BR não tem data ISO facilmente
        horario: '--:--',
        url,
      })
    })

    // Alternativa: JSON embutido no script
    if (!eventos.length) {
      const scriptContent = $('script').map((_, el) => $(el).html() || '').toArray().join('\n')
      const match = scriptContent.match(/"events"\s*:\s*(\[[\s\S]*?\])/)?.[1]
      if (match) {
        try {
          const parsed = JSON.parse(match) as { name?: string; date?: string; url?: string }[]
          for (const ev of parsed) {
            if (ev.name) {
              eventos.push({
                nome: ev.name,
                data: ev.date?.split('T')[0] || hoje,
                horario: '--:--',
                url: ev.url || null,
              })
            }
          }
        } catch {
          // ignore JSON parse error
        }
      }
    }

    logger.info(`[espn.com.br:mma] ${eventos.length} eventos encontrados`)
    return eventos
  } catch (e) {
    logger.error(`[espn.com.br:mma] ${e}`)
    return []
  }
}

// ─── Merge: ESPN API + UFC.com ────────────────────────────────────────────────

/**
 * Mescla os dados da ESPN API (base) com UFC.com (enriquecimento de imagem/local/horário).
 */
export function mesclarEventosUFC(
  espnEventos: EventoUFC[],
  ufcComEventos: EventoUFCCom[]
): EventoUFCEnriquecido[] {
  const resultado: EventoUFCEnriquecido[] = []

  for (const ev of espnEventos) {
    // Tenta match por data ou por palavras do nome
    const nomeLower = ev.nome.toLowerCase()
    const match = ufcComEventos.find(uc => {
      if (uc.data === ev.data) return true
      // Match por nome parcial
      const words = uc.nome.toLowerCase().split(/\s+/).filter(w => w.length > 3)
      return words.some(w => nomeLower.includes(w))
    })

    const enriquecido: EventoUFCEnriquecido = {
      ...ev,
      imagemEvento: match?.imagemEvento ?? null,
      linkEvento: match?.linkEvento ?? null,
      ticketsUrl: match?.ticketsUrl ?? null,
      prelims: match?.prelims ?? null,
      mainCard: match?.mainCard ?? null,
      assistirUrl: match?.assistirUrl ?? null,
      fontes: match ? ['espn-ufc', 'ufc.com'] : ['espn-ufc'],
    }

    // Usar horários do UFC.com se disponíveis (mais precisos)
    if (match?.prelims?.horario && match.prelims.horario !== '--:--') {
      enriquecido.horario = match.prelims.horario
    }

    // Adicionar transmissão do UFC.com se não detectada
    if (match?.transmissao && !enriquecido.transmissoes?.length) {
      enriquecido.transmissoes = [normalizarTransmissao(match.transmissao)]
    }

    resultado.push(enriquecido)
  }

  // Adicionar eventos do UFC.com que não estão na ESPN (mais raros)
  for (const uc of ufcComEventos) {
    const jaExiste = espnEventos.some(ev => {
      if (uc.data === ev.data) return true
      return ev.nome.toLowerCase().split(' ').filter(w => w.length > 3)
        .some(w => uc.nome.toLowerCase().includes(w))
    })
    if (!jaExiste) {
      resultado.push({
        id: `ufc-com-${uc.slug}`,
        nome: uc.nome,
        apelido: uc.subtitulo,
        data: uc.data,
        horario: uc.horario,
        local: null,
        cidade: null,
        pais: null,
        status: 'agendado',
        card: 'completo',
        lutaPrincipal: null,
        lutas: [],
        transmissoes: uc.transmissao ? [normalizarTransmissao(uc.transmissao)] : [],
        fonte: 'ufc.com',
        imagemEvento: uc.imagemEvento,
        linkEvento: uc.linkEvento,
        ticketsUrl: uc.ticketsUrl,
        prelims: uc.prelims,
        mainCard: uc.mainCard,
        assistirUrl: uc.assistirUrl,
        fontes: ['ufc.com'],
      })
    }
  }

  return resultado.sort((a, b) => a.data.localeCompare(b.data))
}
