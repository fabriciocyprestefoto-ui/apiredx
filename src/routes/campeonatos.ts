import { FastifyPluginAsync } from 'fastify'
import { CAMPEONATOS } from '../data/campeonatos'
import { scraperTabelaESPN, scraperArtilhariaESPN, scraperProximosJogosESPN, ESPN_LEAGUE_IDS } from '../scrapers/espn'
import { scraperArtilharia as scraperArtilhariaGE } from '../scrapers/tabela'
import { cache, TTL } from '../cache'

export const campeonatosRoutes: FastifyPluginAsync = async (app) => {
  app.get('/campeonatos', async (_req, reply) => {
    return reply.send({ success: true, data: CAMPEONATOS, timestamp: new Date().toISOString() })
  })

  app.get<{ Params: { slug: string } }>('/campeonatos/:slug/tabela', async (req, reply) => {
    const { slug } = req.params
    const leagueCode = ESPN_LEAGUE_IDS[slug]
    if (!leagueCode) {
      return reply.send({ success: true, data: [], message: 'Tabela não disponível para este campeonato', timestamp: new Date().toISOString() })
    }
    const ck = `tabela:${slug}`
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })
    const tabela = await scraperTabelaESPN(leagueCode)
    cache.set(ck, tabela, TTL.TABELA)
    return reply.send({ success: true, data: tabela, cache: false, timestamp: new Date().toISOString() })
  })

  app.get<{ Params: { slug: string } }>('/campeonatos/:slug/artilharia', async (req, reply) => {
    const { slug } = req.params
    // Artilharia só disponível para Brasileirão por ora
    if (slug !== 'brasileirao-serie-a') {
      return reply.send({ success: true, data: [], message: 'Artilharia não disponível para este campeonato', timestamp: new Date().toISOString() })
    }
    const ck = `artilharia:${slug}:ge-fotos:v2`
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })
    const ge = await scraperArtilhariaGE(slug).catch(() => [])
    const art = ge.length ? ge : await scraperArtilhariaESPN()
    cache.set(ck, art, TTL.ARTILHARIA)
    return reply.send({ success: true, data: art, cache: false, timestamp: new Date().toISOString() })
  })

  app.get('/campeonatos/brasileirao/proximos', async (_req, reply) => {
    const ck = 'proximos:brasileirao'
    const cached = cache.get(ck)
    if (cached) {
      const data = (cached as any[]).map(j => ({
        ...j,
        transmissoes: j.transmissoes?.length ? j.transmissoes : [{ canal: 'A confirmar', tipo: 'desconhecido', url: null, logo: null }],
      }))
      return reply.send({ success: true, data, cache: true, timestamp: new Date().toISOString() })
    }
    const jogos = await scraperProximosJogosESPN(14)
    cache.set(ck, jogos, TTL.TRANSMISSOES)
    return reply.send({ success: true, data: jogos, total: jogos.length, cache: false, timestamp: new Date().toISOString() })
  })
}
