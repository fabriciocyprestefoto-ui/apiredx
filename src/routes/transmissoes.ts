import { FastifyPluginAsync } from 'fastify'
import { getJogosHoje } from '../services/jogosService'
import { listarCanaisUnicos, resolverEmissora, normalizarTransmissao, TRANSMISSOES_PADRAO_BR } from '../scrapers/transmissoes'
import { cache, TTL } from '../cache'

export const transmissoesRoutes: FastifyPluginAsync = async (app) => {

  /**
   * GET /api/transmissoes/hoje
   * Jogos de hoje com lista de emissoras enriquecidas (logo, url, cor).
   * Usado pelo portal para montar os cards de "próximos jogos + onde assistir".
   */
  app.get('/transmissoes/hoje', async (_req, reply) => {
    const { jogos } = await getJogosHoje()
    const data = jogos.map(j => ({
      matchId:    j.id,
      jogo:       `${j.mandante} x ${j.visitante}`,
      campeonato: j.campeonato,
      data:       j.data,
      horario:    j.horario,
      homeTeam:   { name: j.mandante, logo: j.escudoMandante },
      awayTeam:   { name: j.visitante, logo: j.escudoVisitante },
      transmissoes: (j.transmissoes?.length
        ? j.transmissoes
        : [normalizarTransmissao('A confirmar')]
      ).map(t => {
        // Enriquece cada transmissão com cor + url direta + logoAlt
        const info = resolverEmissora(t.canal)
        return {
          canal:    info?.canal    ?? t.canal,
          tipo:     info?.tipo     ?? t.tipo,
          logo:     info?.logo     ?? t.logo,
          logoAlt:  info?.logoAlt  ?? null,
          url:      info?.url      ?? t.url,
          cor:      info?.cor      ?? '#6B7280',
          descricao:info?.descricao ?? null,
        }
      }),
    }))
    return reply.send({ success: true, data, total: data.length, timestamp: new Date().toISOString() })
  })

  /**
   * GET /api/transmissoes/canais
   * Lista COMPLETA de todas as emissoras cadastradas com:
   *   id, canal, tipo, logo, logoAlt, url (link direto ao vivo), cor, descricao
   *
   * Uso no portal: montar grid de canais clicáveis com logo + abrir stream.
   * Query: ?tipo=streaming | tv_aberta | tv_fechada | youtube
   */
  app.get<{ Querystring: { tipo?: string } }>('/transmissoes/canais', async (req, reply) => {
    const ck = `transmissoes:canais:${req.query.tipo ?? 'all'}`
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    let canais = listarCanaisUnicos()
    if (req.query.tipo) {
      canais = canais.filter(c => c.tipo === req.query.tipo)
    }

    const data = canais.map(c => ({
      id:        c.id,
      canal:     c.canal,
      tipo:      c.tipo,
      logo:      c.logo,
      logoAlt:   c.logoAlt ?? null,
      url:       c.url,
      cor:       c.cor,
      descricao: c.descricao,
    }))

    cache.set(ck, data, TTL.TRANSMISSOES)
    return reply.send({
      success:  true,
      data,
      total:    data.length,
      tipos:    [...new Set(data.map(c => c.tipo))],
      cache:    false,
      timestamp: new Date().toISOString(),
    })
  })

  /**
   * GET /api/transmissoes/canais/:id
   * Detalhe de um canal pelo id (ex: "globo", "cazetv", "prime-video").
   * Retorna logo, url ao vivo, cor e ligas que ele transmite.
   */
  app.get<{ Params: { id: string } }>('/transmissoes/canais/:id', async (req, reply) => {
    const { id } = req.params
    const todos = listarCanaisUnicos()
    const canal = todos.find(c => c.id === id)
    if (!canal) return reply.status(404).send({ success: false, error: `Canal "${id}" não encontrado` })

    // Ligas que este canal transmite
    const ligas = Object.entries(TRANSMISSOES_PADRAO_BR)
      .filter(([, canais]) => canais.some(c => c.toLowerCase().includes(canal.canal.toLowerCase())))
      .map(([liga]) => liga)

    return reply.send({
      success: true,
      data: {
        ...canal,
        ligas,
      },
      timestamp: new Date().toISOString(),
    })
  })

  /**
   * GET /api/transmissoes/liga/:codigo
   * Emissoras de uma liga específica (ex: "bra.1", "uefa.champions", "nba").
   * Usado pelo portal para mostrar "onde assistir" ao abrir uma liga.
   */
  app.get<{ Params: { codigo: string } }>('/transmissoes/liga/:codigo', async (req, reply) => {
    const { codigo } = req.params
    const ck = `transmissoes:liga:${codigo}`
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    const { transmissoesPadraoLiga } = await import('../scrapers/transmissoes')
    const transmissoes = transmissoesPadraoLiga(codigo)

    if (!transmissoes.length || (transmissoes.length === 1 && transmissoes[0].tipo === 'desconhecido')) {
      return reply.status(404).send({ success: false, error: `Liga "${codigo}" não encontrada ou sem transmissões cadastradas` })
    }

    const data = transmissoes.map(t => {
      const info = resolverEmissora(t.canal)
      return {
        canal:    info?.canal    ?? t.canal,
        tipo:     info?.tipo     ?? t.tipo,
        logo:     info?.logo     ?? t.logo,
        logoAlt:  info?.logoAlt  ?? null,
        url:      info?.url      ?? t.url,
        cor:      info?.cor      ?? '#6B7280',
        descricao:info?.descricao ?? null,
      }
    })

    cache.set(ck, data, TTL.CAMPEONATOS)
    return reply.send({
      success: true,
      liga:    codigo,
      data,
      total:   data.length,
      cache:   false,
      timestamp: new Date().toISOString(),
    })
  })
}
