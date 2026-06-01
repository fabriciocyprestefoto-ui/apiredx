import axios from 'axios'
import https from 'https'
import { PosicaoTabela, Artilheiro } from '../types'
import { logger } from '../utils/logger'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36'
const H = { 'User-Agent': UA }
const HTTP = axios.create({ httpsAgent: new https.Agent({ rejectUnauthorized: false }) })

export async function scraperTabela(slug: string): Promise<PosicaoTabela[]> {
  try {
    const url = `https://ge.globo.com/${slug}/classificacao/`
    const { data: html } = await HTTP.get(url, { headers: H, timeout: 10000 })
    const cheerio = await import('cheerio')
    const $ = cheerio.load(html)
    const tabela: PosicaoTabela[] = []
    $('.classificacao__table tbody tr').each((_,row) => {
      const c = $(row).find('td')
      if (c.length < 9) return
      tabela.push({
        posicao: parseInt($(c[0]).text(),10) || tabela.length+1,
        time: $(c[1]).text().trim(), escudo: $(c[1]).find('img').attr('src') ?? null,
        pontos: parseInt($(c[2]).text(),10)||0, jogos: parseInt($(c[3]).text(),10)||0,
        vitorias: parseInt($(c[4]).text(),10)||0, empates: parseInt($(c[5]).text(),10)||0,
        derrotas: parseInt($(c[6]).text(),10)||0, golsPro: parseInt($(c[7]).text(),10)||0,
        golsContra: parseInt($(c[8]).text(),10)||0, saldoGols: parseInt($(c[9])?.text()||'0',10)||0,
        aproveitamento: parseFloat($(c[10])?.text()||'0')||0,
      })
    })
    logger.info(`[tabela] ${tabela.length} times`)
    return tabela
  } catch(e) { logger.error(`[tabela] ${e}`); return [] }
}

export async function scraperArtilharia(slug: string): Promise<Artilheiro[]> {
  try {
    const url = slug === 'brasileirao-serie-a'
      ? 'https://ge.globo.com/futebol/brasileirao-serie-a/'
      : `https://ge.globo.com/${slug}/artilharia/`
    const { data: html } = await HTTP.get(url, { headers: H, timeout: 10000 })
    const cheerio = await import('cheerio')
    const $ = cheerio.load(html)
    const lista: Artilheiro[] = []
    $('.ranking-item-wrapper').each((_, row) => {
      const item = $(row)
      const posicao = parseInt(item.find('.ranking-item').first().text(), 10) || lista.length + 1
      const jogador = item.find('.jogador-nome').first().text().trim()
      const time = item.find('.jogador-escudo img').attr('alt') || item.find('.jogador-time').first().text().trim()
      const gols = parseInt(item.find('.jogador-gols').first().text(), 10) || 0
      const foto = item.find('.jogador-foto img').attr('src') || item.find('.jogador-foto img').attr('data-src') || null
      if (!jogador) return
      lista.push({
        posicao,
        jogador,
        time,
        gols,
        assistencias: null,
        foto,
        fotoReal: Boolean(foto),
      })
    })

    if (lista.length) {
      logger.info(`[artilharia] ${lista.length} artilheiros`)
      return lista
    }

    $('table tbody tr').each((_,row) => {
      const c = $(row).find('td')
      if (c.length < 3) return
      const jogador = $(c[1]).text().trim()
      if (!jogador) return
      lista.push({
        posicao: lista.length+1, jogador, time: $(c[2]).text().trim(),
        gols: parseInt($(c[3]).text(),10)||0,
        assistencias: parseInt($(c[4])?.text()||'',10)||null,
        foto: $(c[0]).find('img').attr('src') ?? null,
        fotoReal: Boolean($(c[0]).find('img').attr('src')),
      })
    })
    logger.info(`[artilharia] ${lista.length} artilheiros`)
    return lista
  } catch(e) { logger.error(`[artilharia] ${e}`); return [] }
}
