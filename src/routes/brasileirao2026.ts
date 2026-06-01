import { FastifyPluginAsync } from 'fastify'
import { BRASILEIRAO_2026_CLUBES, buscarClubeBrasileirao2026 } from '../data/brasileirao2026'

export const brasileirao2026Routes: FastifyPluginAsync = async (app) => {
  app.get('/brasileirao-2026', async (_req, reply) => {
    return reply.send({
      success: true,
      data: {
        temporada: 2026,
        competicao: 'Campeonato Brasileiro Série A',
        totalClubes: BRASILEIRAO_2026_CLUBES.length,
        clubes: BRASILEIRAO_2026_CLUBES,
      },
      timestamp: new Date().toISOString(),
    })
  })

  app.get('/brasileirao-2026/clubes', async (_req, reply) => {
    return reply.send({
      success: true,
      data: BRASILEIRAO_2026_CLUBES,
      total: BRASILEIRAO_2026_CLUBES.length,
      timestamp: new Date().toISOString(),
    })
  })

  app.get<{ Params: { slug: string } }>('/brasileirao-2026/clubes/:slug', async (req, reply) => {
    const clube = buscarClubeBrasileirao2026(req.params.slug)
    if (!clube) return reply.status(404).send({ success: false, error: 'Clube não encontrado no dataset Brasileirão 2026' })
    return reply.send({ success: true, data: clube, timestamp: new Date().toISOString() })
  })

  app.get<{ Params: { slug: string } }>('/brasileirao-2026/clubes/:slug/elenco', async (req, reply) => {
    const clube = buscarClubeBrasileirao2026(req.params.slug)
    if (!clube) return reply.status(404).send({ success: false, error: 'Clube não encontrado no dataset Brasileirão 2026' })
    return reply.send({
      success: true,
      data: clube.elenco,
      total: clube.elenco.length,
      clube: clube.nome,
      linksFotosOficiais: clube.links_fotos_oficiais,
      timestamp: new Date().toISOString(),
    })
  })
}
