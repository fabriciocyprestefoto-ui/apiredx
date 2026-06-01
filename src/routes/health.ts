import { FastifyPluginAsync } from 'fastify'
import { cache } from '../cache'

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async (_req, reply) => {
    const chaves = cache.keys()
    return reply.send({
      success: true,
      status: 'ok',
      versao: '2.0.0',
      uptime: Math.round(process.uptime()),
      cache: {
        total: chaves.length,
        chaves,
      },
      endpoints: {
        home: '/api/sports/home',
        football: [
          '/api/football/matches/today',
          '/api/football/matches/upcoming',
          '/api/football/matches/live',
          '/api/football/matches/recent',
          '/api/football/competitions',
          '/api/football/competitions/:id/standings',
          '/api/football/competitions/:id/matches',
          '/api/football/teams',
          '/api/football/teams/:id',
          '/api/football/teams/:id/squad',
        ],
        worldCup: [
          '/api/world-cup/2026',
          '/api/world-cup/2026/teams',
          '/api/world-cup/2026/groups',
          '/api/world-cup/2026/matches',
          '/api/world-cup/2026/stadiums',
        ],
        nba: [
          '/api/nba/games/today',
          '/api/nba/games/upcoming',
          '/api/nba/standings',
          '/api/nba/teams',
          '/api/nba/teams/:id',
          '/api/nba/players/:id',
        ],
        fights: [
          '/api/fights/events',
          '/api/fights/events/upcoming',
          '/api/fights/events/:id',
          '/api/fights/fighters/:id',
        ],
        search: '/api/search?q=',
        legacy: ['/api/jogos/hoje', '/api/times', '/api/campeonatos', '/api/nba/jogos/hoje', '/api/ufc/calendario', '/api/agenda'],
      },
      timestamp: new Date().toISOString(),
    })
  })

  const limparCache = async (_req: unknown, reply: { send: (body: unknown) => unknown }) => {
    const totalAntes = cache.keys().length
    cache.clear()
    return reply.send({
      success: true,
      cleared: totalAntes,
      message: 'Cache limpo com sucesso',
      timestamp: new Date().toISOString(),
    })
  }

  app.get('/health/cache/clear', limparCache)
  app.post('/health/cache/clear', limparCache)
}
