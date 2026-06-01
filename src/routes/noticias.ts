import { FastifyPluginAsync } from 'fastify'
import { cache, TTL } from '../cache'
import { FONTES_NOTICIAS, scraperNoticiasEsporte } from '../scrapers/noticias'

export const noticiasRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { limit?: string } }>('/noticias', async (req, reply) => {
    const limit = Math.min(Math.max(Number(req.query.limit ?? 24), 1), 60)
    const ck = `noticias:esporte:${limit}:conteudo:v2`
    const cached = cache.get(ck)
    if (cached) {
      const data = (cached as Array<{ id: string }>).map(n => ({ ...n, apiUrl: `/api/noticias/${n.id}` }))
      return reply.send({ success: true, data, total: data.length, cache: true, fontes: FONTES_NOTICIAS, timestamp: new Date().toISOString() })
    }

    const noticias = (await scraperNoticiasEsporte(limit)).map(n => ({ ...n, apiUrl: `/api/noticias/${n.id}` }))
    cache.set(ck, noticias, TTL.CONTEUDOS)
    return reply.send({ success: true, data: noticias, total: noticias.length, cache: false, fontes: FONTES_NOTICIAS, timestamp: new Date().toISOString() })
  })

  app.get<{ Params: { id: string } }>('/noticias/:id', async (req, reply) => {
    const ck = 'noticias:esporte:60:conteudo:v2'
    const cached = cache.get<Array<{ id: string }>>(ck)
    const noticias = cached?.length ? cached : await scraperNoticiasEsporte(60)
    const noticia = noticias.find(n => n.id === req.params.id)
    if (!noticia) return reply.status(404).send({ success: false, error: 'Noticia nao encontrada' })
    return reply.send({ success: true, data: { ...noticia, apiUrl: `/api/noticias/${noticia.id}` }, timestamp: new Date().toISOString() })
  })
}
