import axios from 'axios'
import * as cheerio from 'cheerio'
import { logger } from '../utils/logger'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
const HEADERS = { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9' }

export interface EquipeGE {
  id: string
  slug: string
  nome: string
  escudo: string
  href: string
}

// Scrapa a página principal do Brasileirão no GE para obter escudos reais
export async function scraperEscudosGE(): Promise<Record<string, string>> {
  try {
    const { data: html } = await axios.get(
      'https://ge.globo.com/futebol/brasileirao-serie-a/',
      { headers: HEADERS, timeout: 12000 }
    )
    const $ = cheerio.load(html)
    const escudos: Record<string, string> = {}

    $('[data-id-equipe-sde]').each((_, el) => {
      const nome = $(el).attr('title') || ''
      const dataSrc = $(el).find('img[data-src]').attr('data-src') || ''
      if (nome && dataSrc && dataSrc.includes('sde.globo.com')) {
        escudos[nome.toLowerCase()] = dataSrc
      }
    })

    // Fallback: qualquer img com data-src do sde.globo.com
    if (!Object.keys(escudos).length) {
      $('img[data-src]').each((_, el) => {
        const src = $(el).attr('data-src') || ''
        const alt = $(el).attr('alt') || ''
        if (src.includes('sde.globo.com/media/organizations') && alt) {
          escudos[alt.toLowerCase()] = src
        }
      })
    }

    logger.info(`[escudosGE] ${Object.keys(escudos).length} times encontrados`)
    return escudos
  } catch (e) {
    logger.warn(`[escudosGE] falhou: ${e}`)
    return {}
  }
}
