/**
 * src/app.ts
 *
 * Cria e configura o app Fastify sem chamar .listen().
 * Usado tanto no server.ts (local) quanto em api/index.ts (Vercel serverless).
 */

import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import path from 'path'
import fs from 'fs'
import { jogosRoutes } from './routes/jogos'
import { timesRoutes } from './routes/times'
import { campeonatosRoutes } from './routes/campeonatos'
import { transmissoesRoutes } from './routes/transmissoes'
import { conteudosRoutes } from './routes/conteudos'
import { noticiasRoutes } from './routes/noticias'
import { buscaRoutes } from './routes/busca'
import { healthRoutes } from './routes/health'
import { docsRoutes } from './routes/docs'
import { nbaRoutes } from './routes/nba'
import { ufcRoutes } from './routes/ufc'
import { futebolInternacionalRoutes } from './routes/futebolInternacional'
import { copaMundoRoutes } from './routes/copaMundo'
import { agendaRoutes } from './routes/agenda'
import { sportsHomeRoutes } from './routes/sportsHome'
import { footballApiRoutes } from './routes/footballApi'
import { worldCup2026Routes } from './routes/worldCup2026'
import { nbaApiRoutes } from './routes/nbaApi'
import { fightsApiRoutes } from './routes/fightsApi'
import { brasileirao2026Routes } from './routes/brasileirao2026'
import { transfermarktRoutes } from './routes/transfermarkt'

export async function createApp() {
  const app = Fastify({ logger: false })

  await app.register(cors, { origin: '*' })
  await app.register(rateLimit, { max: 200, timeWindow: '1 minute' })

  app.get('/', async (_req, reply) => {
    const indexPath = path.join(process.cwd(), 'public', 'index.html')
    if (fs.existsSync(indexPath)) {
      return reply.type('text/html; charset=utf-8').send(fs.readFileSync(indexPath, 'utf8'))
    }
    return reply.type('text/html; charset=utf-8').send('<!doctype html><title>REDX API ESPORTE</title><h1>REDX API ESPORTE</h1>')
  })

  app.get('/mobile.html', async (_req, reply) => {
    const mobilePath = path.join(process.cwd(), 'public', 'mobile.html')
    if (fs.existsSync(mobilePath)) {
      return reply.type('text/html; charset=utf-8').send(fs.readFileSync(mobilePath, 'utf8'))
    }
    return reply.redirect('/')
  })

  // Serve imagens estáticas de /img/*
  app.get('/img/:file', async (req, reply) => {
    const { file } = req.params as { file: string }
    const imgPath = path.join(process.cwd(), 'public', 'img', file)
    if (fs.existsSync(imgPath)) {
      const ext = path.extname(file).toLowerCase()
      const mime: Record<string, string> = {
        '.png': 'image/png', '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
        '.webp': 'image/webp', '.gif': 'image/gif'
      }
      return reply.type(mime[ext] || 'application/octet-stream').send(fs.readFileSync(imgPath))
    }
    return reply.status(404).send({ error: 'Imagem não encontrada' })
  })

  // Arquivos estáticos auxiliares — desativado na Vercel para evitar erro serverless.
  const publicDir = path.join(process.cwd(), 'public')
  if (!process.env.VERCEL && fs.existsSync(publicDir)) {
    const { default: staticFiles } = await import('@fastify/static')
    await app.register(staticFiles, { root: publicDir, prefix: '/' })
  }

  // ── Rotas legadas (compatibilidade) ──────────────────────────────────────────
  await app.register(jogosRoutes,               { prefix: '/api' })
  await app.register(timesRoutes,               { prefix: '/api' })
  await app.register(campeonatosRoutes,         { prefix: '/api' })
  await app.register(transmissoesRoutes,        { prefix: '/api' })
  await app.register(conteudosRoutes,           { prefix: '/api' })
  await app.register(noticiasRoutes,            { prefix: '/api' })
  await app.register(buscaRoutes,               { prefix: '/api' })
  await app.register(healthRoutes,              { prefix: '/api' })
  await app.register(docsRoutes,                { prefix: '/api' })
  await app.register(nbaRoutes,                 { prefix: '/api' })
  await app.register(ufcRoutes,                 { prefix: '/api' })
  await app.register(futebolInternacionalRoutes,{ prefix: '/api' })
  await app.register(copaMundoRoutes,           { prefix: '/api' })
  await app.register(agendaRoutes,              { prefix: '/api' })
  // ── Premium ──────────────────────────────────────────────────────────────────
  await app.register(sportsHomeRoutes,          { prefix: '/api' })
  await app.register(footballApiRoutes,         { prefix: '/api' })
  await app.register(worldCup2026Routes,        { prefix: '/api' })
  await app.register(nbaApiRoutes,              { prefix: '/api' })
  await app.register(fightsApiRoutes,           { prefix: '/api' })
  await app.register(brasileirao2026Routes,     { prefix: '/api' })
  await app.register(transfermarktRoutes,       { prefix: '/api' })

  app.setErrorHandler((err: { statusCode?: number; message?: string }, _req, reply) =>
    reply.status(err.statusCode ?? 500).send({ success: false, error: err.message || 'Erro interno' })
  )
  app.setNotFoundHandler((_req, reply) =>
    reply.status(404).send({ success: false, error: 'Rota nao encontrada' })
  )

  return app
}
