/**
 * server.ts — entry point para desenvolvimento local.
 * Para produção/Vercel, o entry point é api/index.ts.
 */
import { createApp } from './app'
import { logger } from './utils/logger'

async function bootstrap() {
  const app = await createApp()
  const port = Number(process.env.PORT) || 3333
  await app.listen({ port, host: '0.0.0.0' })
  logger.info(`FutebolBrasilAPI rodando na porta ${port}`)
  logger.info(`API:  http://localhost:${port}/api`)
}

bootstrap().catch(e => { console.error(e); process.exit(1) })
