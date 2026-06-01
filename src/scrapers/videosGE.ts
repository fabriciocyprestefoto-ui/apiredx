import axios from 'axios'
import * as cheerio from 'cheerio'
import https from 'https'
import { Jogo, VideoMelhoresMomentos } from '../types'
import { logger } from '../utils/logger'

const PLAYLIST_URL = 'https://globoesporte.globo.com/futebol/playlist/melhores-momentos-do-futebol.ghtml'
const GETV_YOUTUBE_RSS = 'https://www.youtube.com/feeds/videos.xml?channel_id=UCgCKagVhzGnZcuP9bSMgMCg'
const H = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9',
}
const HTTP = axios.create({ httpsAgent: new https.Agent({ rejectUnauthorized: false }) })

function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function aliasesTime(nome: string): string[] {
  const normal = normalizarTexto(nome)
  const aliases: Record<string, string[]> = {
    'vasco da gama': ['vasco'],
    'atletico-mg': ['atletico-mg', 'atletico mg', 'atletico mineiro'],
    'red bull bragantino': ['bragantino', 'red bull bragantino'],
    'sao paulo': ['sao paulo'],
    'athletico-pr': ['athletico-pr', 'athletico pr', 'athletico'],
  }
  return Array.from(new Set([normal, ...(aliases[normal] ?? []), normal.split(' ')[0]])).filter(a => a.length >= 3)
}

function matchVideoJogo(video: VideoMelhoresMomentos, jogo: Jogo): boolean {
  const titulo = normalizarTexto(video.titulo)
  const mandantes = aliasesTime(jogo.mandante)
  const visitantes = aliasesTime(jogo.visitante)
  return titulo.includes('melhores') &&
    mandantes.some(alias => titulo.includes(alias)) &&
    visitantes.some(alias => titulo.includes(alias))
}

export async function scraperMelhoresMomentosGE(): Promise<VideoMelhoresMomentos[]> {
  try {
    const { data: html } = await HTTP.get<string>(PLAYLIST_URL, { headers: H, timeout: 12000 })
    const $ = cheerio.load(html)
    const videos: VideoMelhoresMomentos[] = []

    $('.playlist__videos-list__item').each((_idx, el) => {
      const item = $(el)
      const id = item.attr('data-video-source') || ''
      const titulo = item.attr('data-video-title') || item.find('.playlist__videos-list__item__label').text().trim()
      const href = item.find('a.playlist__videos-list__item__link').attr('href') || ''
      if (!id || !titulo || !href) return

      videos.push({
        id,
        titulo,
        descricao: item.attr('data-video-description') || null,
        url: href,
        thumbnail: item.find('meta[property="og:image"]').attr('content') || item.find('img').attr('data-original') || null,
        data: item.attr('data-video-date') || null,
        duracao: item.find('.playlist__videos-list__item__thumb__duration').text().trim() || null,
        fonte: 'ge.globo',
      })
    })

    logger.info(`[melhoresMomentosGE] ${videos.length} vídeos`)
    return videos
  } catch (e) {
    logger.warn(`[melhoresMomentosGE] falhou: ${e}`)
    return []
  }
}

export async function scraperMelhoresMomentosGETVYoutube(): Promise<VideoMelhoresMomentos[]> {
  try {
    const { data: xml } = await HTTP.get<string>(GETV_YOUTUBE_RSS, { headers: H, timeout: 12000, responseType: 'text' })
    const $ = cheerio.load(xml, { xmlMode: true })
    const videos: VideoMelhoresMomentos[] = []

    $('entry').each((_idx, entry) => {
      const item = $(entry)
      const id = item.find('yt\\:videoId, videoId').first().text().trim()
      const titulo = item.find('title').first().text().trim()
      const url = item.find('link').first().attr('href') || (id ? `https://www.youtube.com/watch?v=${id}` : '')
      if (!id || !titulo || !url) return

      videos.push({
        id,
        titulo,
        descricao: item.find('media\\:description, description').first().text().trim() || null,
        url,
        thumbnail: item.find('media\\:thumbnail, thumbnail').first().attr('url') || (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null),
        data: item.find('published').first().text().trim() || null,
        duracao: null,
        fonte: 'youtube:getv',
      })
    })

    logger.info(`[melhoresMomentosGETVYoutube] ${videos.length} vídeos`)
    return videos
  } catch (e) {
    logger.warn(`[melhoresMomentosGETVYoutube] falhou: ${e}`)
    return []
  }
}

export async function scraperMelhoresMomentosTodos(): Promise<VideoMelhoresMomentos[]> {
  const [ge, youtube] = await Promise.all([
    scraperMelhoresMomentosGE(),
    scraperMelhoresMomentosGETVYoutube(),
  ])
  const dedup = new Map<string, VideoMelhoresMomentos>()
  for (const video of [...youtube, ...ge]) {
    dedup.set(video.url || video.id, video)
  }
  return Array.from(dedup.values())
}

export async function buscarMelhoresMomentosPorJogo(jogo: Jogo): Promise<VideoMelhoresMomentos[]> {
  const videos = await scraperMelhoresMomentosTodos()
  return videos.filter(video => matchVideoJogo(video, jogo)).slice(0, 3)
}

export async function anexarMelhoresMomentos(jogos: Jogo[]): Promise<Jogo[]> {
  if (!jogos.length) return jogos
  const videos = await scraperMelhoresMomentosTodos()
  return jogos.map(jogo => ({
    ...jogo,
    melhoresMomentos: videos.filter(video => matchVideoJogo(video, jogo)).slice(0, 3),
  }))
}
