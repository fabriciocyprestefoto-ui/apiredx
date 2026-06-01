import axios from 'axios'
import * as cheerio from 'cheerio'
import https from 'https'
import { slugify } from '../utils/slugify'
import { logger } from '../utils/logger'

const BASE = 'https://www.transfermarkt.com.br'
const BRA1_URL = `${BASE}/campeonato-brasileiro-serie-a/startseite/wettbewerb/BRA1`
const H = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9',
}
const HTTP = axios.create({ httpsAgent: new https.Agent({ rejectUnauthorized: false }) })

export interface ClubeTransfermarkt {
  id: string
  nome: string
  slug: string
  logo: string | null
  plantel: number
  idadeMedia: number | null
  estrangeiros: number | null
  valorMedio: string | null
  valorTotal: string | null
  url: string
  elencoUrl: string
}

export interface JogadorTransfermarkt {
  id: string
  nome: string
  slug: string
  numero: number | null
  posicao: string | null
  idade: number | null
  nacionalidade: string | null
  altura: string | null
  pe: string | null
  contratoAte: string | null
  valorMercado: string | null
  foto: string | null
  perfilUrl: string
}

function absoluta(path: string): string {
  return path.startsWith('http') ? path : `${BASE}${path}`
}

function idFromUrl(url: string): string {
  return url.match(/verein\/(\d+)/)?.[1] || url.match(/spieler\/(\d+)/)?.[1] || ''
}

function idadeFromText(text: string): number | null {
  const match = text.match(/\((\d+)\)/)
  return match ? Number(match[1]) : null
}

export async function scraperClubesTransfermarktBRA1(): Promise<ClubeTransfermarkt[]> {
  try {
    const { data: html } = await HTTP.get<string>(BRA1_URL, { headers: H, timeout: 15000 })
    const $ = cheerio.load(html)
    const clubes: ClubeTransfermarkt[] = []

    $('table.items tbody tr').each((_idx, row) => {
      const cells = $(row).find('td')
      if (cells.length < 7) return

      const nameLink = $(cells[1]).find('a').first()
      const rosterLink = $(cells[2]).find('a').first()
      const nome = nameLink.attr('title') || nameLink.text().trim()
      const href = nameLink.attr('href') || ''
      const elencoHref = rosterLink.attr('href') || href.replace('/startseite/', '/kader/')
      if (!nome || !href) return

      clubes.push({
        id: idFromUrl(href),
        nome,
        slug: slugify(nome),
        logo: $(cells[0]).find('img').attr('src') || null,
        plantel: Number(rosterLink.text().trim()) || 0,
        idadeMedia: Number($(cells[3]).text().replace(',', '.').trim()) || null,
        estrangeiros: Number($(cells[4]).text().trim()) || null,
        valorMedio: $(cells[5]).text().trim() || null,
        valorTotal: $(cells[6]).text().trim() || null,
        url: absoluta(href),
        elencoUrl: absoluta(elencoHref.includes('/plus/1') ? elencoHref : `${elencoHref}/plus/1`),
      })
    })

    logger.info(`[transfermarkt:BRA1] ${clubes.length} clubes`)
    return clubes
  } catch (e) {
    logger.warn(`[transfermarkt:BRA1] falhou: ${e}`)
    return []
  }
}

export async function scraperElencoTransfermarkt(elencoUrl: string): Promise<JogadorTransfermarkt[]> {
  try {
    const { data: html } = await HTTP.get<string>(elencoUrl, { headers: H, timeout: 15000 })
    const $ = cheerio.load(html)
    const jogadores: JogadorTransfermarkt[] = []

    $('table.items tbody tr').each((_idx, row) => {
      const tr = $(row)
      const playerCell = tr.find('td.posrela').first()
      if (!playerCell.length) return

      const link = playerCell.find('td.hauptlink a').first()
      const nome = link.text().replace(/\s+/g, ' ').trim()
      const perfilHref = link.attr('href') || ''
      if (!nome || !perfilHref) return

      const cells = tr.children('td')
      const fotoRaw = playerCell.find('img').attr('data-src') || playerCell.find('img').attr('src') || null
      const foto = fotoRaw && fotoRaw.includes('/portrait/') ? fotoRaw : null
      const posicao = playerCell.find('tr').eq(1).find('td').text().replace(/\s+/g, ' ').trim() || null

      jogadores.push({
        id: idFromUrl(perfilHref),
        nome,
        slug: slugify(nome),
        numero: Number(tr.find('.rn_nummer').first().text().trim()) || null,
        posicao,
        idade: idadeFromText($(cells[2]).text()),
        nacionalidade: $(cells[3]).find('img').first().attr('alt') || null,
        altura: $(cells[4]).text().trim() || null,
        pe: $(cells[5]).text().trim() || null,
        contratoAte: $(cells[7]).text().trim() || null,
        valorMercado: tr.find('td.rechts.hauptlink a').last().text().trim() || tr.find('td.rechts').last().text().trim() || null,
        foto: foto && !foto.startsWith('data:') ? foto : null,
        perfilUrl: absoluta(perfilHref),
      })
    })

    logger.info(`[transfermarkt:elenco] ${jogadores.length} jogadores`)
    return jogadores
  } catch (e) {
    logger.warn(`[transfermarkt:elenco] falhou: ${e}`)
    return []
  }
}

export async function buscarClubeTransfermarkt(slug: string): Promise<ClubeTransfermarkt | null> {
  const clubes = await scraperClubesTransfermarktBRA1()
  return clubes.find(c => c.slug === slug || c.nome.toLowerCase().includes(slug.replace(/-/g, ' '))) ?? null
}
