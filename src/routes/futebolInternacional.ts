import { FastifyPluginAsync } from 'fastify'
import { LIGAS_INTERNACIONAIS, scraperJogosLigaHoje, scraperProximosJogosLiga, scraperTabelaLiga } from '../scrapers/futebolInternacional'
import { cache, TTL } from '../cache'

export const futebolInternacionalRoutes: FastifyPluginAsync = async (app) => {
  app.get('/futebol-internacional/ligas', async (_req, reply) => {
    return reply.send({ success: true, data: LIGAS_INTERNACIONAIS, total: LIGAS_INTERNACIONAIS.length, timestamp: new Date().toISOString() })
  })

  app.get<{ Params: { liga: string }; Querystring: { data?: string } }>('/futebol-internacional/:liga/jogos', {
    schema: {
      querystring: {
        type: 'object',
        properties: { data: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } },
      },
    },
  }, async (req, reply) => {
    const { liga } = req.params
    const data = req.query.data ?? new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
    const ck = `int:${liga}:jogos:${data}`
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })
    const jogos = await scraperJogosLigaHoje(liga, data)
    cache.set(ck, jogos, TTL.JOGOS_HOJE)
    return reply.send({ success: true, data: jogos, total: jogos.length, cache: false, timestamp: new Date().toISOString() })
  })

  app.get<{ Params: { liga: string } }>('/futebol-internacional/:liga/proximos', async (req, reply) => {
    const { liga } = req.params
    const ck = `int:${liga}:proximos`
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })
    const jogos = await scraperProximosJogosLiga(liga, 14)
    cache.set(ck, jogos, TTL.TRANSMISSOES)
    return reply.send({ success: true, data: jogos, total: jogos.length, cache: false, timestamp: new Date().toISOString() })
  })

  app.get<{ Params: { liga: string } }>('/futebol-internacional/:liga/tabela', async (req, reply) => {
    const { liga } = req.params
    const ck = `int:${liga}:tabela`
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })
    const tabela = await scraperTabelaLiga(liga)
    cache.set(ck, tabela, TTL.TABELA)
    return reply.send({ success: true, data: tabela, total: tabela.length, cache: false, timestamp: new Date().toISOString() })
  })
}
