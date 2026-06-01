/**
 * api/index.ts — Vercel Serverless Function handler.
 *
 * A Vercel chama esta função para cada request.
 * O app Fastify é inicializado uma vez e reutilizado (warm start).
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { createApp } from '../src/app'
import type { FastifyInstance } from 'fastify'

let _app: FastifyInstance | null = null

async function getApp(): Promise<FastifyInstance> {
  if (_app) return _app
  _app = await createApp()
  await _app.ready()
  return _app
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const app = await getApp()
  app.server.emit('request', req, res)
}
