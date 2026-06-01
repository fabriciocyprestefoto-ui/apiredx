import { FastifyPluginAsync } from 'fastify'
import { scraperUFCProximos, scraperUFCCalendario, scraperEventoUFC } from '../scrapers/ufc'
import { scraperEventosUFCCom, mesclarEventosUFC } from '../scrapers/ufcEnriquecido'
import { cache, TTL } from '../cache'

export const ufcRoutes: FastifyPluginAsync = async (app) => {
  app.get('/ufc/proximo', async (_req, reply) => {
    const ck = 'ufc:proximo'
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })
    const eventos = await scraperUFCProximos()
    const proximo = eventos[0] ?? null
    cache.set(ck, proximo, TTL.JOGOS_HOJE)
    return reply.send({ success: true, data: proximo, cache: false, timestamp: new Date().toISOString() })
  })

  app.get('/ufc/calendario', async (_req, reply) => {
    const ck = 'ufc:calendario'
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })
    const eventos = await scraperUFCCalendario()
    cache.set(ck, eventos, TTL.CAMPEONATOS)
    return reply.send({ success: true, data: eventos, total: eventos.length, cache: false, timestamp: new Date().toISOString() })
  })

  // GET /api/ufc/enriquecido — próximo evento com dados de imagem/local do UFC.com
  app.get('/ufc/enriquecido', async (_req, reply) => {
    const ck = 'ufc:enriquecido:proximo:v2'
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    const [espnEventos, ufcComEventos] = await Promise.allSettled([
      scraperUFCProximos(),
      scraperEventosUFCCom(),
    ])
    const base = espnEventos.status === 'fulfilled' ? espnEventos.value : []
    const extra = ufcComEventos.status === 'fulfilled' ? ufcComEventos.value : []
    const enriquecidos = mesclarEventosUFC(base, extra)
    const proximo = enriquecidos[0] ?? null
    cache.set(ck, proximo, TTL.JOGOS_HOJE)
    return reply.send({ success: true, data: proximo, fontes: proximo?.fontes ?? [], cache: false, timestamp: new Date().toISOString() })
  })

  // GET /api/ufc/calendario/enriquecido — calendário completo com dados UFC.com
  app.get('/ufc/calendario/enriquecido', async (_req, reply) => {
    const ck = 'ufc:calendario:enriquecido:v2'
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    const [espnCal, ufcComEventos] = await Promise.allSettled([
      scraperUFCCalendario(),
      scraperEventosUFCCom(),
    ])
    const base = espnCal.status === 'fulfilled' ? espnCal.value : []
    const extra = ufcComEventos.status === 'fulfilled' ? ufcComEventos.value : []
    const enriquecidos = mesclarEventosUFC(base, extra)
    cache.set(ck, enriquecidos, TTL.CAMPEONATOS)
    return reply.send({
      success: true,
      data: enriquecidos,
      total: enriquecidos.length,
      fontes: ['espn-ufc', 'ufc.com'],
      cache: false,
      timestamp: new Date().toISOString(),
    })
  })

  app.get<{ Params: { id: string } }>('/ufc/eventos/:id', async (req, reply) => {
    const { id } = req.params
    const ck = `ufc:evento:${id}`
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })
    const evento = await scraperEventoUFC(id)
    if (!evento) return reply.status(404).send({ success: false, error: 'Evento não encontrado' })
    cache.set(ck, evento, TTL.JOGOS_HOJE)
    return reply.send({ success: true, data: evento, cache: false, timestamp: new Date().toISOString() })
  })
}
