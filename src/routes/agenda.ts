import { FastifyPluginAsync } from 'fastify'
import { AgendaItem, EsporteTipo } from '../types'
import { getJogosHoje } from '../services/jogosService'
import { scraperJogosNBAPorData } from '../scrapers/nba'
import { scraperUFCProximos } from '../scrapers/ufc'
import { scraperJogosLigaHoje, LIGAS_INTERNACIONAIS } from '../scrapers/futebolInternacional'
import { cache, TTL } from '../cache'
import { slugify } from '../utils/slugify'

function hojeISO(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}

/**
 * Agenda esportiva unificada: futebol (brasileiro + europeu + copa do mundo),
 * NBA e UFC. Ideal para a home do portal.
 */
export const agendaRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { data?: string; esporte?: EsporteTipo } }>('/agenda', async (req, reply) => {
    const data = req.query.data ?? hojeISO()
    const filtroEsporte = req.query.esporte
    const ck = `agenda:${data}:${filtroEsporte ?? 'todos'}`
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    const itens: AgendaItem[] = []

    // === Futebol brasileiro ===
    if (!filtroEsporte || filtroEsporte === 'futebol') {
      try {
        const { jogos: brasileiros } = await getJogosHoje()
        for (const j of brasileiros.filter(j => j.data === data)) {
          itens.push({
            esporte: 'futebol',
            liga: j.campeonato,
            ligaSlug: j.campeonatoSlug,
            titulo: `${j.mandante} x ${j.visitante}`,
            data: j.data,
            horario: j.horario,
            status: j.status,
            transmissoes: j.transmissoes,
            url: `/api/jogos?data=${j.data}`,
            ref: j,
          })
        }
      } catch { /* silencioso */ }

      // === Futebol internacional (Champions, Premier, La Liga, Serie A, Bundesliga, Ligue 1) ===
      const internacionais = LIGAS_INTERNACIONAIS.filter(l => l.ativo)
      const resJogosInt = await Promise.all(
        internacionais.map(async liga => {
          try {
            const jogos = await scraperJogosLigaHoje(liga.slug, data)
            return jogos.map(j => ({ liga, jogo: j }))
          } catch { return [] }
        })
      )
      for (const grupo of resJogosInt) {
        for (const { liga, jogo } of grupo) {
          itens.push({
            esporte: 'futebol',
            liga: liga.nome,
            ligaSlug: liga.slug,
            titulo: `${jogo.mandante} x ${jogo.visitante}`,
            data: jogo.data,
            horario: jogo.horario,
            status: jogo.status,
            transmissoes: jogo.transmissoes,
            url: `/api/futebol-internacional/${liga.slug}/jogos?data=${jogo.data}`,
            ref: jogo,
          })
        }
      }
    }

    // === NBA ===
    if (!filtroEsporte || filtroEsporte === 'basquete') {
      try {
        const jogosNBA = await scraperJogosNBAPorData(data)
        for (const j of jogosNBA) {
          itens.push({
            esporte: 'basquete',
            liga: 'NBA',
            ligaSlug: 'nba',
            titulo: `${j.mandante} x ${j.visitante}`,
            data: j.data,
            horario: j.horario,
            status: j.status,
            transmissoes: j.transmissoes,
            url: `/api/nba/jogos?data=${j.data}`,
            ref: j,
          })
        }
      } catch { /* silencioso */ }
    }

    // === UFC (eventos do dia ou próximos eventos) ===
    if (!filtroEsporte || filtroEsporte === 'mma') {
      try {
        const eventosUFC = await scraperUFCProximos()
        for (const ev of eventosUFC.filter(ev => ev.data === data)) {
          itens.push({
            esporte: 'mma',
            liga: 'UFC',
            ligaSlug: 'ufc',
            titulo: ev.nome,
            data: ev.data,
            horario: ev.horario,
            status: ev.status,
            transmissoes: ev.transmissoes,
            url: `/api/ufc/eventos/${ev.id.replace(/^ufc-/, '')}`,
            ref: ev,
          })
        }
      } catch { /* silencioso */ }
    }

    itens.sort((a, b) => a.horario.localeCompare(b.horario))

    cache.set(ck, itens, TTL.JOGOS_HOJE)
    return reply.send({
      success: true,
      data: itens,
      total: itens.length,
      data_consulta: data,
      esportes: {
        futebol: itens.filter(i => i.esporte === 'futebol').length,
        basquete: itens.filter(i => i.esporte === 'basquete').length,
        mma: itens.filter(i => i.esporte === 'mma').length,
      },
      cache: false,
      timestamp: new Date().toISOString(),
    })
  })

  /**
   * Agenda semanal: agrupa por dia da semana — útil para guia de programação.
   */
  app.get('/agenda/semana', async (_req, reply) => {
    const ck = 'agenda:semana'
    const cached = cache.get(ck)
    if (cached) return reply.send({ success: true, data: cached, cache: true, timestamp: new Date().toISOString() })

    const hoje = new Date()
    const datas: string[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(hoje)
      d.setDate(d.getDate() + i)
      datas.push(d.toISOString().split('T')[0])
    }

    const semana: Record<string, AgendaItem[]> = {}
    for (const dataAtual of datas) {
      const itens: AgendaItem[] = []
      const ligasAtivas = LIGAS_INTERNACIONAIS.filter(l => l.ativo)

      const jogosNBA = await scraperJogosNBAPorData(dataAtual).catch(() => [])
      for (const j of jogosNBA) {
        itens.push({
          esporte: 'basquete', liga: 'NBA', ligaSlug: 'nba',
          titulo: `${j.mandante} x ${j.visitante}`, data: j.data, horario: j.horario,
          status: j.status, transmissoes: j.transmissoes, url: `/api/nba/jogos?data=${j.data}`, ref: j,
        })
      }

      const jogosLigas = await Promise.all(
        ligasAtivas.map(async liga => ({
          liga,
          jogos: await scraperJogosLigaHoje(liga.slug, dataAtual).catch(() => []),
        }))
      )
      for (const grupo of jogosLigas) {
        for (const j of grupo.jogos) {
          itens.push({
            esporte: 'futebol', liga: grupo.liga.nome, ligaSlug: grupo.liga.slug,
            titulo: `${j.mandante} x ${j.visitante}`, data: j.data, horario: j.horario,
            status: j.status, transmissoes: j.transmissoes,
            url: `/api/futebol-internacional/${grupo.liga.slug}/jogos?data=${j.data}`, ref: j,
          })
        }
      }
      itens.sort((a, b) => a.horario.localeCompare(b.horario))
      semana[dataAtual] = itens
    }

    cache.set(ck, semana, TTL.TRANSMISSOES)
    return reply.send({ success: true, data: semana, timestamp: new Date().toISOString() })
  })
}

// helper exportado caso algum outro módulo precise
export { slugify }
