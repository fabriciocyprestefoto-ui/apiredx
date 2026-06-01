import { FastifyPluginAsync } from 'fastify'
import { scraperJogosNBAHoje, scraperJogosNBAPorData, scraperProximosJogosNBA, scraperTabelaNBA } from '../scrapers/nba'
import { cache, TTL } from '../cache'

export const nbaRoutes: FastifyPluginAsync = async (app) => {
  app.get('/nba/jogos/hoje', async (_req, reply) => {
    const ck = 'nba:hoje'
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })
    const jogos = await scraperJogosNBAHoje()
    cache.set(ck, jogos, TTL.JOGOS_HOJE)
    return reply.send({ success: true, data: jogos, total: jogos.length, cache: false, timestamp: new Date().toISOString() })
  })

  app.get<{ Querystring: { data?: string } }>('/nba/jogos', {
    schema: {
      querystring: {
        type: 'object',
        properties: { data: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } },
      },
    },
  }, async (req, reply) => {
    const data = req.query.data ?? new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
    const ck = `nba:jogos:${data}`
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })
    const jogos = await scraperJogosNBAPorData(data)
    cache.set(ck, jogos, TTL.JOGOS_HOJE)
    return reply.send({ success: true, data: jogos, total: jogos.length, cache: false, timestamp: new Date().toISOString() })
  })

  app.get('/nba/proximos', async (_req, reply) => {
    const ck = 'nba:proximos:7d'
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })
    const jogos = await scraperProximosJogosNBA(7)
    cache.set(ck, jogos, TTL.TRANSMISSOES)
    return reply.send({ success: true, data: jogos, total: jogos.length, cache: false, timestamp: new Date().toISOString() })
  })

  app.get('/nba/tabela', async (_req, reply) => {
    const ck = 'nba:standings'
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })
    const tabela = await scraperTabelaNBA()
    cache.set(ck, tabela, TTL.TABELA)
    return reply.send({ success: true, data: tabela, cache: false, timestamp: new Date().toISOString() })
  })
}
