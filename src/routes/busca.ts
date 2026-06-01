import { FastifyPluginAsync } from 'fastify'
import { TIMES_BRASILEIROS } from '../data/times'
import { CAMPEONATOS } from '../data/campeonatos'
import { getJogosHoje } from '../services/jogosService'

export const buscaRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { q: string } }>('/busca', {
    schema: {
      querystring: {
        type: 'object',
        required: ['q'],
        properties: { q: { type: 'string', minLength: 2, maxLength: 100 } },
      },
    },
  }, async (req, reply) => {
    const q = req.query.q.toLowerCase().trim()
    const times = TIMES_BRASILEIROS.filter(
      t => t.nome.toLowerCase().includes(q) || t.slug.includes(q) || (t.cidade ?? '').toLowerCase().includes(q)
    )
    const campeonatos = CAMPEONATOS.filter(
      c => c.nome.toLowerCase().includes(q) || c.slug.includes(q)
    )
    const { jogos: todos } = await getJogosHoje()
    const jogos = todos.filter(
      j => j.mandante.toLowerCase().includes(q) || j.visitante.toLowerCase().includes(q) || j.campeonato.toLowerCase().includes(q)
    )
    return reply.send({ success: true, data: { times, campeonatos, jogos }, timestamp: new Date().toISOString() })
  })
}
