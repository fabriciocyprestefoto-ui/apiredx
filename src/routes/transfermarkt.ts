import { FastifyPluginAsync } from 'fastify'
import { cache, TTL } from '../cache'
import { buscarClubeTransfermarkt, scraperClubesTransfermarktBRA1, scraperElencoTransfermarkt } from '../scrapers/transfermarkt'

export const transfermarktRoutes: FastifyPluginAsync = async (app) => {
  app.get('/transfermarkt/brasileirao-serie-a', async (_req, reply) => {
    const ck = 'transfermarkt:bra1:clubes:v1'
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    const clubes = await scraperClubesTransfermarktBRA1()
    cache.set(ck, clubes, TTL.TIMES)
    return reply.send({ success: true, data: clubes, total: clubes.length, cache: false, timestamp: new Date().toISOString() })
  })

  app.get<{ Params: { slug: string } }>('/transfermarkt/brasileirao-serie-a/clubes/:slug', async (req, reply) => {
    const clube = await buscarClubeTransfermarkt(req.params.slug)
    if (!clube) return reply.status(404).send({ success: false, error: 'Clube não encontrado no Transfermarkt' })
    return reply.send({ success: true, data: clube, timestamp: new Date().toISOString() })
  })

  app.get<{ Params: { slug: string } }>('/transfermarkt/brasileirao-serie-a/clubes/:slug/elenco', async (req, reply) => {
    const ck = `transfermarkt:bra1:elenco:${req.params.slug}:v2`
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    const clube = await buscarClubeTransfermarkt(req.params.slug)
    if (!clube) return reply.status(404).send({ success: false, error: 'Clube não encontrado no Transfermarkt' })

    const elenco = await scraperElencoTransfermarkt(clube.elencoUrl)
    const data = { clube, elenco }
    cache.set(ck, data, TTL.ELENCO)
    return reply.send({ success: true, data, total: elenco.length, cache: false, timestamp: new Date().toISOString() })
  })
}
