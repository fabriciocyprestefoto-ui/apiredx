import { FastifyPluginAsync } from 'fastify'
import { getJogosHoje, getJogosPorData, getJogosPorTime } from '../services/jogosService'

export const jogosRoutes: FastifyPluginAsync = async (app) => {
  app.get('/jogos/hoje', async (_req, reply) => {
    const { jogos, fromCache } = await getJogosHoje()
    return reply.send({ success:true, data:jogos, total:jogos.length, cache:fromCache, timestamp:new Date().toISOString() })
  })

  app.get<{ Querystring: { data?: string } }>('/jogos', {
    schema: {
      querystring: {
        type: 'object',
        properties: { data: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } },
      },
    },
  }, async (req, reply) => {
    const data = req.query.data ?? new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'})
    const { jogos, fromCache } = await getJogosPorData(data)
    return reply.send({ success:true, data:jogos, total:jogos.length, cache:fromCache, timestamp:new Date().toISOString() })
  })

  app.get<{ Params: { slug: string } }>('/times/:slug/jogos', async (req, reply) => {
    const { jogos, fromCache } = await getJogosPorTime(req.params.slug)
    return reply.send({ success:true, data:jogos, total:jogos.length, cache:fromCache, timestamp:new Date().toISOString() })
  })
}
