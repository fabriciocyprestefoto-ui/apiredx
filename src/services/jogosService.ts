import { Jogo } from '../types'
import { cache, TTL } from '../cache'
import { scraperJogos } from '../scrapers/jogosHoje'
import { slugify } from '../utils/slugify'

function hojeISO(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}

export async function getJogosHoje(): Promise<{ jogos: Jogo[]; fromCache: boolean }> {
  const hoje = hojeISO()
  const ck = `jogos:${hoje}`
  const c = cache.get<Jogo[]>(ck)
  if (c) return { jogos: c, fromCache: true }
  const jogos = await scraperJogos(hoje)
  cache.set(ck, jogos, TTL.JOGOS_HOJE)
  return { jogos, fromCache: false }
}

export async function getJogosPorData(data: string): Promise<{ jogos: Jogo[]; fromCache: boolean }> {
  const ck = `jogos:${data}`
  const c = cache.get<Jogo[]>(ck)
  if (c) return { jogos: c, fromCache: true }
  const jogos = await scraperJogos(data)
  cache.set(ck, jogos, data === hojeISO() ? TTL.JOGOS_HOJE : TTL.TABELA)
  return { jogos, fromCache: false }
}

export async function getJogosPorTime(slug: string): Promise<{ jogos: Jogo[]; fromCache: boolean }> {
  const { jogos } = await getJogosHoje()
  return { jogos: jogos.filter(j => slugify(j.mandante) === slug || slugify(j.visitante) === slug), fromCache: false }
}
