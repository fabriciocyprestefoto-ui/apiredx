import axios from 'axios'
import * as cheerio from 'cheerio'
import https from 'https'
import { NoticiaEsporte } from '../types'
import { logger } from '../utils/logger'
import { slugify } from '../utils/slugify'

type FonteNoticias = {
  id: string
  nome: string
  url: string
  tipo: 'html' | 'rss'
  categoria: string
  hosts: string[]
}

const H = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9',
}

const HTTP = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
})

export const FONTES_NOTICIAS: FonteNoticias[] = [
  {
    id: 'msn-esportes',
    nome: 'MSN Esportes',
    url: 'https://www.msn.com/pt-br/esportes?ocid=StripeOCID',
    tipo: 'html',
    categoria: 'esportes',
    hosts: ['www.msn.com', 'msn.com'],
  },
  {
    id: 'terra-futebol',
    nome: 'Terra Futebol',
    url: 'https://www.terra.com.br/esportes/futebol/rss.xml',
    tipo: 'rss',
    categoria: 'futebol',
    hosts: ['www.terra.com.br', 'terra.com.br'],
  },
  {
    id: 'uol-esporte',
    nome: 'UOL Esporte',
    url: 'https://www.uol.com.br/esporte/',
    tipo: 'html',
    categoria: 'esportes',
    hosts: ['www.uol.com.br', 'uol.com.br', 'esporte.uol.com.br'],
  },
  {
    id: 'uol-copa-do-mundo',
    nome: 'UOL Copa do Mundo',
    url: 'https://www.uol.com.br/esporte/futebol/copa-do-mundo/',
    tipo: 'html',
    categoria: 'copa-do-mundo',
    hosts: ['www.uol.com.br', 'uol.com.br', 'esporte.uol.com.br'],
  },
  {
    id: 'lance',
    nome: 'Lance!',
    url: 'https://www.lance.com.br/',
    tipo: 'html',
    categoria: 'esportes',
    hosts: ['www.lance.com.br', 'lance.com.br'],
  },
]

const TERMOS_ESPORTIVOS = [
  'futebol', 'brasileirao', 'brasileirão', 'copa', 'mundial', 'libertadores',
  'sul-americana', 'flamengo', 'palmeiras', 'corinthians', 'sao paulo',
  'são paulo', 'santos', 'vasco', 'fluminense', 'botafogo', 'gremio',
  'grêmio', 'internacional', 'cruzeiro', 'atletico', 'atlético', 'bahia',
  'vitoria', 'vitória', 'sport', 'fortaleza', 'ceara', 'ceará', 'jogo',
  'partida', 'tecnico', 'técnico', 'jogador', 'elenco', 'seleção', 'selecao',
]

function limparTexto(valor: string | null | undefined): string {
  return String(valor ?? '').replace(/\s+/g, ' ').trim()
}

function urlAbsoluta(url: string, base: string): string | null {
  try {
    return new URL(url, base).toString()
  } catch {
    return null
  }
}

function urlPermitida(url: string, fonte: FonteNoticias): boolean {
  try {
    const parsed = new URL(url)
    return fonte.hosts.some(host => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))
  } catch {
    return false
  }
}

function pareceNoticiaEsportiva(titulo: string, categoria: string): boolean {
  const lower = titulo.toLowerCase()
  const tituloOk = titulo.length >= 24 && titulo.length <= 180
  const bloqueados = ['assine', 'newsletter', 'publicidade', 'desafio ', 'perrengue', 'cupom', 'promoção', 'promocao']
  if (!tituloOk || bloqueados.some(termo => lower.includes(termo))) return false
  if (categoria !== 'esportes') return true
  return TERMOS_ESPORTIVOS.some(termo => lower.includes(termo))
}

function montarId(fonteId: string, titulo: string, url: string): string {
  return `${fonteId}-${slugify(`${titulo}-${url}`).slice(0, 64)}`
}

function parseData(valor: string | null | undefined): string | null {
  if (!valor) return null
  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? null : data.toISOString()
}

function parseRss(xml: string, fonte: FonteNoticias): NoticiaEsporte[] {
  const $ = cheerio.load(xml, { xmlMode: true })
  const noticias: NoticiaEsporte[] = []

  $('item').each((_idx, item) => {
    const node = $(item)
    const titulo = limparTexto(node.find('title').first().text())
    const url = limparTexto(node.find('link').first().text())
    if (!titulo || !url || !urlPermitida(url, fonte) || !pareceNoticiaEsportiva(titulo, fonte.categoria)) return

    const resumo = limparTexto(node.find('description').first().text()).replace(/<[^>]+>/g, '')
    const imagem =
      node.find('enclosure').first().attr('url') ||
      node.find('media\\:content, content').first().attr('url') ||
      null

    noticias.push({
      id: montarId(fonte.id, titulo, url),
      fonte: fonte.nome,
      titulo,
      resumo: resumo || null,
      url,
      imagem,
      publicadoEm: parseData(node.find('pubDate').first().text()),
      categoria: fonte.categoria,
    })
  })

  return noticias
}

function parseHtml(html: string, fonte: FonteNoticias): NoticiaEsporte[] {
  const $ = cheerio.load(html)
  const noticias = new Map<string, NoticiaEsporte>()

  $('a[href]').each((_idx, anchor) => {
    const link = $(anchor)
    const titulo = limparTexto(link.attr('aria-label') || link.text())
    const href = link.attr('href')
    const url = href ? urlAbsoluta(href, fonte.url) : null
    if (!titulo || !url || !urlPermitida(url, fonte) || !pareceNoticiaEsportiva(titulo, fonte.categoria)) return

    const imagem =
      link.find('img').first().attr('src') ||
      link.find('img').first().attr('data-src') ||
      link.closest('article, section, div').find('img').first().attr('src') ||
      link.closest('article, section, div').find('img').first().attr('data-src') ||
      null
    const resumo = limparTexto(
      link.closest('article, section, div').find('p').first().text()
    )

    noticias.set(url, {
      id: montarId(fonte.id, titulo, url),
      fonte: fonte.nome,
      titulo,
      resumo: resumo || null,
      url,
      imagem: imagem ? urlAbsoluta(imagem, fonte.url) : null,
      publicadoEm: null,
      categoria: fonte.categoria,
    })
  })

  const ogTitle = limparTexto($('meta[property="og:title"]').attr('content'))
  const ogUrl = $('meta[property="og:url"]').attr('content') || fonte.url
  if (ogTitle && urlPermitida(ogUrl, fonte) && pareceNoticiaEsportiva(ogTitle, fonte.categoria) && !noticias.has(ogUrl)) {
    noticias.set(ogUrl, {
      id: montarId(fonte.id, ogTitle, ogUrl),
      fonte: fonte.nome,
      titulo: ogTitle,
      resumo: limparTexto($('meta[property="og:description"]').attr('content')) || null,
      url: ogUrl,
      imagem: $('meta[property="og:image"]').attr('content') || null,
      publicadoEm: null,
      categoria: fonte.categoria,
    })
  }

  return Array.from(noticias.values())
}

function extrairConteudoHtml(html: string, baseUrl: string): Pick<NoticiaEsporte, 'conteudo' | 'imagens' | 'imagem' | 'resumo'> {
  const $ = cheerio.load(html)
  const paragraphs = [
    ...$('article p, .content-text__container, .mc-article-body p, .text p, [data-testid="content"] p')
      .map((_idx, el) => limparTexto($(el).text()))
      .get(),
  ].filter(p => p.length > 40)

  const imagens = [
    ...$('article img, .mc-article-body img, figure img')
      .map((_idx, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-original')
        return src ? urlAbsoluta(src, baseUrl) : null
      })
      .get(),
  ].filter((src): src is string => Boolean(src))

  const resumo =
    limparTexto($('meta[property="og:description"]').attr('content')) ||
    limparTexto($('meta[name="description"]').attr('content')) ||
    null

  return {
    conteudo: paragraphs.join('\n\n') || resumo,
    imagens: Array.from(new Set(imagens)).slice(0, 8),
    imagem: imagens[0] ?? $('meta[property="og:image"]').attr('content') ?? null,
    resumo,
  }
}

async function enriquecerConteudo(noticia: NoticiaEsporte): Promise<NoticiaEsporte> {
  try {
    const { data } = await HTTP.get<string>(noticia.url, { headers: H, timeout: 10000, responseType: 'text' })
    const conteudo = extrairConteudoHtml(data, noticia.url)
    return {
      ...noticia,
      fonteUrl: noticia.url,
      resumo: conteudo.resumo || noticia.resumo,
      imagem: noticia.imagem || conteudo.imagem,
      imagens: conteudo.imagens,
      conteudo: conteudo.conteudo,
    }
  } catch (e) {
    logger.warn(`[noticias:conteudo] falhou ${noticia.url}: ${e}`)
    return {
      ...noticia,
      fonteUrl: noticia.url,
      imagens: noticia.imagem ? [noticia.imagem] : [],
      conteudo: noticia.resumo,
    }
  }
}

export async function scraperNoticiasEsporte(limit = 24): Promise<NoticiaEsporte[]> {
  const resultados = await Promise.allSettled(
    FONTES_NOTICIAS.map(async (fonte) => {
      const { data } = await HTTP.get<string>(fonte.url, { headers: H, timeout: 12000, responseType: 'text' })
      return fonte.tipo === 'rss' ? parseRss(data, fonte) : parseHtml(data, fonte)
    })
  )

  const noticias = resultados.flatMap((resultado, idx) => {
    if (resultado.status === 'fulfilled') return resultado.value
    logger.warn(`[noticias:${FONTES_NOTICIAS[idx].id}] falhou: ${resultado.reason}`)
    return []
  })

  const dedup = new Map<string, NoticiaEsporte>()
  for (const noticia of noticias) {
    if (!dedup.has(noticia.url)) dedup.set(noticia.url, noticia)
  }

  const selecionadas = Array.from(dedup.values())
    .sort((a, b) => (b.publicadoEm ?? '').localeCompare(a.publicadoEm ?? ''))
    .slice(0, limit)

  const enriquecidas = await Promise.allSettled(selecionadas.map(enriquecerConteudo))
  return enriquecidas.map((resultado, idx) =>
    resultado.status === 'fulfilled'
      ? resultado.value
      : { ...selecionadas[idx], fonteUrl: selecionadas[idx].url, conteudo: selecionadas[idx].resumo ?? null }
  )
}
