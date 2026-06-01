/**
 * scrapers/fotosAtletas.ts
 *
 * Scraper de fotos de jogadores multi-fonte.
 * Hierarquia de fontes:
 *   1. ESPN API (headshot oficial)
 *   2. Transfermarkt (portrait photo — scraping)
 *   3. ui-avatars (gerado com iniciais — último recurso)
 *
 * A CBF usa CMS interno (cms.cbf.com.br) inacessível externamente,
 * então Transfermarkt é o melhor fallback disponível.
 */

import axios from 'axios'
import https from 'https'
import * as cheerio from 'cheerio'
import { logger } from '../utils/logger'
import { slugify } from '../utils/slugify'
import { cache, TTL } from '../cache'

const HTTP = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  timeout: 12000,
})
const H = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  'Referer': 'https://www.transfermarkt.com.br',
}
const ESPN_H = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9',
}

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface FotoAtleta {
  nome: string
  foto: string | null
  fotoReal: boolean      // true = foto real (não avatar)
  fonte: 'espn' | 'transfermarkt' | 'avatar'
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

function avatarUrl(nome: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(nome)}&background=2d1b69&color=e0d7ff&size=128&rounded=true&bold=true`
}

function normNome(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function nomesSimilares(a: string, b: string): boolean {
  const na = normNome(a)
  const nb = normNome(b)
  if (na === nb) return true
  // Verifica se um dos nomes contém o outro (apelido vs nome completo)
  if (na.split(' ').length === 1 || nb.split(' ').length === 1) {
    return na.includes(nb) || nb.includes(na)
  }
  // Verifica ao menos 2 tokens em comum
  const ta = new Set(na.split(' '))
  const tb = nb.split(' ')
  const comum = tb.filter(t => ta.has(t) && t.length > 2).length
  return comum >= 2
}

// ─── Fonte 1: ESPN ────────────────────────────────────────────────────────────

const ESPN_SITE = 'https://site.api.espn.com/apis/site/v2/sports/soccer'

/**
 * Busca foto de um jogador pelo nome via ESPN (busca no elenco do time).
 * Retorna null se não encontrar foto real.
 */
export async function buscarFotoESPN(
  nomeJogador: string,
  espnTeamId: string,
): Promise<FotoAtleta | null> {
  const ck = `foto:espn:${espnTeamId}:${normNome(nomeJogador)}`
  const cached = cache.get<FotoAtleta>(ck)
  if (cached) return cached

  try {
    const { data } = await axios.get(
      `${ESPN_SITE}/bra.1/teams/${espnTeamId}/roster?lang=pt&region=br`,
      { headers: ESPN_H, timeout: 8000 },
    )
    const athletes: Record<string, unknown>[] = data.athletes ?? []

    for (const a of athletes) {
      const nome = String(a.fullName ?? a.displayName ?? '')
      if (!nomesSimilares(nome, nomeJogador)) continue

      const headshot = (a.headshot as Record<string, string> | undefined)?.href
      const images = (a.images as Array<Record<string, string>> | undefined) ?? []
      const fotoReal = headshot ?? images.find(i => i.href?.trim())?.href ?? null

      if (fotoReal) {
        const result: FotoAtleta = { nome, foto: fotoReal, fotoReal: true, fonte: 'espn' }
        cache.set(ck, result, TTL.ELENCO ?? 3600)
        return result
      }
    }
    return null
  } catch {
    return null
  }
}

// ─── Fonte 2: Transfermarkt ─────────────────────────────────────────────────

const TM_BASE = 'https://www.transfermarkt.com.br'

/** Mapa de slug de time -> URL do elenco no Transfermarkt */
const TM_ELENCO_URLS: Record<string, string> = {
  'flamengo':       `${TM_BASE}/flamengo-rio-de-janeiro/kader/verein/614/plus/1`,
  'palmeiras':      `${TM_BASE}/se-palmeiras/kader/verein/1023/plus/1`,
  'corinthians':    `${TM_BASE}/sc-corinthians-paulista/kader/verein/199/plus/1`,
  'sao-paulo':      `${TM_BASE}/sao-paulo-fc/kader/verein/164/plus/1`,
  'santos':         `${TM_BASE}/fc-santos/kader/verein/3406/plus/1`,
  'vasco':          `${TM_BASE}/cr-vasco-da-gama/kader/verein/2468/plus/1`,
  'fluminense':     `${TM_BASE}/fluminense-fc/kader/verein/2159/plus/1`,
  'botafogo':       `${TM_BASE}/botafogo-de-futebol-e-regatas/kader/verein/795/plus/1`,
  'atletico-mg':    `${TM_BASE}/atletico-mineiro/kader/verein/170/plus/1`,
  'cruzeiro':       `${TM_BASE}/cruzeiro-ec/kader/verein/3233/plus/1`,
  'gremio':         `${TM_BASE}/gremio-porto-alegre/kader/verein/4022/plus/1`,
  'internacional':  `${TM_BASE}/sport-club-internacional/kader/verein/4280/plus/1`,
  'bahia':          `${TM_BASE}/ec-bahia/kader/verein/660/plus/1`,
  'athletico-pr':   `${TM_BASE}/atletico-paranaense/kader/verein/1864/plus/1`,
  'bragantino':     `${TM_BASE}/red-bull-bragantino/kader/verein/8811/plus/1`,
  'fortaleza':      `${TM_BASE}/fortaleza-ec/kader/verein/80200/plus/1`,
  'vitoria':        `${TM_BASE}/ec-vitoria/kader/verein/2547/plus/1`,
  'criciuma':       `${TM_BASE}/criciuma-ec/kader/verein/39993/plus/1`,
  'juventude':      `${TM_BASE}/ec-juventude/kader/verein/5228/plus/1`,
  'mirassol':       `${TM_BASE}/mirassol-fc/kader/verein/9551/plus/1`,
  'novorizontino':  `${TM_BASE}/clube-atletico-novorizontino/kader/verein/22048/plus/1`,
  'coritiba':       `${TM_BASE}/coritiba-fc/kader/verein/2239/plus/1`,
  'sport':          `${TM_BASE}/sport-club-do-recife/kader/verein/2234/plus/1`,
  'ceara':          `${TM_BASE}/ceara-sc/kader/verein/8800/plus/1`,
}

/** Cache de elenco Transfermarkt por time (mapa nome -> foto) */
const _tmCache: Record<string, Map<string, string>> = {}

async function getElencoTM(timeSlug: string): Promise<Map<string, string>> {
  if (_tmCache[timeSlug]) return _tmCache[timeSlug]
  const ck = `tm:elenco:${timeSlug}`
  const cached = cache.get<[string, string][]>(ck)
  if (cached) {
    _tmCache[timeSlug] = new Map(cached)
    return _tmCache[timeSlug]
  }

  const url = TM_ELENCO_URLS[timeSlug]
  if (!url) return new Map()

  try {
    const { data: html } = await HTTP.get<string>(url, { headers: H })
    const $ = cheerio.load(html)
    const mapa = new Map<string, string>()

    $('table.items tbody tr').each((_, row) => {
      const tr = $(row)
      const playerCell = tr.find('td.posrela').first()
      if (!playerCell.length) return

      const nome = playerCell.find('td.hauptlink a').first().text().replace(/\s+/g, ' ').trim()
      if (!nome) return

      const fotoRaw = playerCell.find('img').attr('data-src') || playerCell.find('img').attr('src') || ''
      const foto = fotoRaw.includes('/portrait/') && !fotoRaw.startsWith('data:') ? fotoRaw : ''

      if (nome && foto) {
        mapa.set(normNome(nome), foto)
      }
    })

    logger.info(`[fotosTM:${timeSlug}] ${mapa.size} fotos scraped`)
    cache.set(ck, Array.from(mapa.entries()), TTL.ELENCO ?? 3600)
    _tmCache[timeSlug] = mapa
    return mapa
  } catch (e) {
    logger.warn(`[fotosTM:${timeSlug}] falhou: ${e}`)
    return new Map()
  }
}

/** Busca foto de um jogador no Transfermarkt */
export async function buscarFotoTransfermarkt(
  nomeJogador: string,
  timeSlug: string,
): Promise<FotoAtleta | null> {
  const mapa = await getElencoTM(timeSlug)
  const nNome = normNome(nomeJogador)

  // Busca exata
  if (mapa.has(nNome)) {
    return { nome: nomeJogador, foto: mapa.get(nNome)!, fotoReal: true, fonte: 'transfermarkt' }
  }

  // Busca por similaridade
  for (const [nm, foto] of mapa.entries()) {
    if (nomesSimilares(nNome, nm)) {
      return { nome: nomeJogador, foto, fotoReal: true, fonte: 'transfermarkt' }
    }
  }

  return null
}

// ─── Função principal: buscar foto com fallbacks ──────────────────────────────

export interface BuscarFotoOpts {
  nomeJogador: string
  timeSlug: string
  espnTeamId?: string   // se fornecido, tenta ESPN primeiro
}

/**
 * Busca a melhor foto disponível para um jogador:
 * ESPN → Transfermarkt → avatar
 */
export async function buscarFotoAtleta(opts: BuscarFotoOpts): Promise<FotoAtleta> {
  const { nomeJogador, timeSlug, espnTeamId } = opts

  // 1. ESPN (mais rápido e com fotos oficiais)
  if (espnTeamId) {
    const espnFoto = await buscarFotoESPN(nomeJogador, espnTeamId)
    if (espnFoto?.fotoReal) {
      logger.debug(`[fotoAtleta] ${nomeJogador} -> ESPN ✓`)
      return espnFoto
    }
  }

  // 2. Transfermarkt
  const tmFoto = await buscarFotoTransfermarkt(nomeJogador, timeSlug)
  if (tmFoto?.fotoReal) {
    logger.debug(`[fotoAtleta] ${nomeJogador} -> Transfermarkt ✓`)
    return tmFoto
  }

  // 3. Avatar gerado
  logger.debug(`[fotoAtleta] ${nomeJogador} -> avatar`)
  return {
    nome: nomeJogador,
    foto: avatarUrl(nomeJogador),
    fotoReal: false,
    fonte: 'avatar',
  }
}

// ─── Enriquecimento de elenco completo ───────────────────────────────────────

export interface JogadorComFoto {
  id: string | null
  nome: string
  posicao: string | null
  numero: number | null
  nacionalidade: string | null
  idade: number | null
  foto: string
  fotoReal: boolean
  fonteFoto: 'espn' | 'transfermarkt' | 'avatar'
  perfilUrl: string | null
  valorMercado?: string | null
}

/**
 * Dado um array de jogadores com foto da ESPN, enriquece os que não têm
 * foto real usando o Transfermarkt como fonte secundária.
 */
export async function enriquecerFotosElenco(
  jogadores: Array<{
    id: string | null
    nome: string
    posicao: string | null
    numero: number | null
    nacionalidade: string | null
    idade: number | null
    foto: string
    fotoReal: boolean
    perfilUrl: string | null
  }>,
  timeSlug: string,
  espnTeamId?: string,
): Promise<JogadorComFoto[]> {
  const ck = `elenco:enriquecido:${timeSlug}`
  const cached = cache.get<JogadorComFoto[]>(ck)
  if (cached) return cached

  // Pré-carrega o elenco Transfermarkt em paralelo
  const [, tmMapa] = await Promise.all([
    espnTeamId ? getElencoTM('_espn_' + espnTeamId).catch(() => null) : null,
    getElencoTM(timeSlug),
  ])

  const resultado: JogadorComFoto[] = await Promise.all(
    jogadores.map(async (j): Promise<JogadorComFoto> => {
      // Se já tem foto real da ESPN, retorna diretamente
      if (j.fotoReal && j.foto && !j.foto.includes('ui-avatars')) {
        return { ...j, fonteFoto: 'espn' }
      }

      // Tenta Transfermarkt
      const nNome = normNome(j.nome)
      let fotoTM: string | null = null

      if (tmMapa.has(nNome)) {
        fotoTM = tmMapa.get(nNome)!
      } else {
        for (const [nm, foto] of tmMapa.entries()) {
          if (nomesSimilares(nNome, nm)) { fotoTM = foto; break }
        }
      }

      if (fotoTM) {
        return { ...j, foto: fotoTM, fotoReal: true, fonteFoto: 'transfermarkt' }
      }

      // Mantém avatar ou foto ESPN sem foto real
      return { ...j, fonteFoto: j.foto?.includes('ui-avatars') ? 'avatar' : 'espn' }
    }),
  )

  const comFotoReal = resultado.filter(j => j.fotoReal).length
  logger.info(`[enriquecerFotos:${timeSlug}] ${comFotoReal}/${resultado.length} com foto real`)

  cache.set(ck, resultado, TTL.ELENCO ?? 3600)
  return resultado
}

// ─── Busca de foto avulsa pelo nome (para artilheiros etc.) ──────────────────

/**
 * Busca foto de um jogador de qualquer time da Série A.
 * Útil para artilheiros e estatísticas onde não se sabe o time.
 */
export async function buscarFotoGlobal(nomeJogador: string, timeSlug?: string): Promise<string> {
  const ck = `foto:global:${normNome(nomeJogador)}`
  const cached = cache.get<string>(ck)
  if (cached) return cached

  const slugsParaBuscar = timeSlug
    ? [timeSlug, ...Object.keys(TM_ELENCO_URLS).filter(s => s !== timeSlug).slice(0, 4)]
    : Object.keys(TM_ELENCO_URLS).slice(0, 6)

  for (const slug of slugsParaBuscar) {
    const foto = await buscarFotoTransfermarkt(nomeJogador, slug)
    if (foto?.fotoReal) {
      cache.set(ck, foto.foto!, TTL.ELENCO ?? 3600)
      return foto.foto!
    }
  }

  const avatar = avatarUrl(nomeJogador)
  cache.set(ck, avatar, TTL.ELENCO ?? 3600)
  return avatar
}

export { TM_ELENCO_URLS, normNome }
