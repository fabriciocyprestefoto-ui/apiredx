import { FastifyPluginAsync } from 'fastify'
import { INFO_COPA_MUNDO_2026, SEDES_COPA_MUNDO_2026, SELECOES_COPA_MUNDO_2026 } from '../data/copaMundo'
import { COPA_MUNDO_2006 } from '../data/copaMundo2006'
import { scraperJogosLigaHoje, scraperProximosJogosLiga } from '../scrapers/futebolInternacional'
import { cache, TTL } from '../cache'

export const copaMundoRoutes: FastifyPluginAsync = async (app) => {
  app.get('/copa-mundo/2006', async (_req, reply) => {
    return reply.send({
      success: true,
      data: COPA_MUNDO_2006,
      timestamp: new Date().toISOString(),
    })
  })

  app.get('/copa-mundo', async (_req, reply) => {
    return reply.send({
      success: true,
      data: INFO_COPA_MUNDO_2026,
      timestamp: new Date().toISOString(),
    })
  })

  app.get('/copa-mundo/sedes', async (_req, reply) => {
    return reply.send({
      success: true,
      data: SEDES_COPA_MUNDO_2026,
      total: SEDES_COPA_MUNDO_2026.length,
      timestamp: new Date().toISOString(),
    })
  })

  app.get('/copa-mundo/selecoes', async (_req, reply) => {
    return reply.send({
      success: true,
      data: SELECOES_COPA_MUNDO_2026,
      total: SELECOES_COPA_MUNDO_2026.length,
      timestamp: new Date().toISOString(),
    })
  })

  app.get<{ Querystring: { data?: string } }>('/copa-mundo/jogos', async (req, reply) => {
    const data = req.query.data ?? new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
    const ck = `copa-mundo:jogos:${data}`
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })
    const jogos = await scraperJogosLigaHoje('copa-do-mundo', data)
    cache.set(ck, jogos, TTL.JOGOS_HOJE)
    return reply.send({ success: true, data: jogos, total: jogos.length, cache: false, timestamp: new Date().toISOString() })
  })

  app.get('/copa-mundo/calendario', async (_req, reply) => {
    const ck = 'copa-mundo:calendario'
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })
    // Varre 60 dias para cobrir do início ao fim da Copa
    const jogos = await scraperProximosJogosLiga('copa-do-mundo', 60)
    cache.set(ck, jogos, TTL.CAMPEONATOS)
    return reply.send({ success: true, data: jogos, total: jogos.length, cache: false, timestamp: new Date().toISOString() })
  })

  app.get('/copa-mundo/eliminatorias', async (_req, reply) => {
    const ck = 'copa-mundo:eliminatorias'
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })
    const [uefa, conmebol] = await Promise.all([
      scraperProximosJogosLiga('eliminatorias-uefa', 14),
      scraperProximosJogosLiga('eliminatorias-conmebol', 14),
    ])
    const data = { uefa, conmebol }
    cache.set(ck, data, TTL.TRANSMISSOES)
    return reply.send({ success: true, data, timestamp: new Date().toISOString() })
  })
}
