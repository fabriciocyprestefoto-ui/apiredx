import { FastifyPluginAsync } from 'fastify'
import { getJogosHoje } from '../services/jogosService'
import { scraperNoticiasEsporte } from '../scrapers/noticias'
import { scraperJogosNBAHoje, scraperProximosJogosNBA } from '../scrapers/nba'
import { scraperUFCProximos } from '../scrapers/ufc'
import { COPA_MUNDO_2006 } from '../data/copaMundo2006'
import { SugestaoConteudo } from '../types'
import { slugify } from '../utils/slugify'

export const conteudosRoutes: FastifyPluginAsync = async (app) => {
  app.get('/conteudos/sugestoes', async (_req, reply) => {
    const { jogos } = await getJogosHoje()
    const sugestoes: SugestaoConteudo[] = []
    if (!jogos.length) {
      sugestoes.push({ tipo:'sem_jogos', titulo:'Sem jogos hoje',
        descricao:'Não há jogos de times brasileiros programados para hoje.',
        hashtags:['#futebol','#futebolbrasileiro'], jogoRelacionado:null })
      return reply.send({ success:true, data:sugestoes, timestamp:new Date().toISOString() })
    }
    sugestoes.push({ tipo:'resumo_dia', titulo:`${jogos.length} jogos hoje!`,
      descricao:`Confira: ${jogos.slice(0,3).map(j=>`${j.mandante} x ${j.visitante}`).join(', ')} e mais!`,
      hashtags:['#futebol','#jogosdehoje','#futebolbrasileiro'], jogoRelacionado:null })
    for (const j of jogos.slice(0,5)) {
      const canais = j.transmissoes.map(t=>t.canal).join(', ') || 'Não encontrada'
      sugestoes.push({ tipo:'onde_assistir', titulo:`Onde assistir ${j.mandante} x ${j.visitante}`,
        descricao:`${j.mandante} x ${j.visitante} às ${j.horario} - ${j.campeonato}. Transmissão: ${canais}.`,
        hashtags:[`#${slugify(j.mandante).replace(/-/g,'')}`,`#${slugify(j.visitante).replace(/-/g,'')}`, '#futebol'],
        jogoRelacionado:`${j.mandante} x ${j.visitante}` })
      sugestoes.push({ tipo:'preview', titulo:`Hoje tem ${j.mandante} em campo!`,
        descricao:`${j.mandante} joga às ${j.horario} contra ${j.visitante} pela ${j.campeonato}${j.estadio?' no '+j.estadio:''}.`,
        hashtags:[`#${slugify(j.mandante).replace(/-/g,'')}`, '#futebol', '#brasileirao'],
        jogoRelacionado:`${j.mandante} x ${j.visitante}` })
    }
    return reply.send({ success:true, data:sugestoes, total:sugestoes.length, timestamp:new Date().toISOString() })
  })

  app.get('/conteudos/noticias', async (_req, reply) => {
    const noticias = await scraperNoticiasEsporte(24)
    return reply.send({ success:true, data:noticias, total:noticias.length, timestamp:new Date().toISOString() })
  })

  app.get('/conteudos/pacote', async (_req, reply) => {
    const [noticias, nbaHoje, nbaProximos, ufcEventos] = await Promise.allSettled([
      scraperNoticiasEsporte(24),
      scraperJogosNBAHoje(),
      scraperProximosJogosNBA(7),
      scraperUFCProximos(),
    ])

    const data = {
      futebol: {
        noticias: noticias.status === 'fulfilled' ? noticias.value : [],
        copaMundo2006: COPA_MUNDO_2006,
        endpoints: {
          copaMundo2006: '/api/world-cup/2006',
          noticias: '/api/noticias',
          melhoresMomentos: '/api/football/matches/recent',
        },
      },
      basquete: {
        liga: 'NBA',
        jogosHoje: nbaHoje.status === 'fulfilled' ? nbaHoje.value : [],
        proximosJogos: nbaProximos.status === 'fulfilled' ? nbaProximos.value : [],
        endpoints: {
          hoje: '/api/nba/games/today',
          proximos: '/api/nba/games/upcoming',
          tabela: '/api/nba/standings',
          times: '/api/nba/teams',
        },
      },
      mma: {
        liga: 'UFC',
        eventos: ufcEventos.status === 'fulfilled' ? ufcEventos.value : [],
        endpoints: {
          eventos: '/api/fights/events',
          proximos: '/api/fights/events/upcoming',
          lutador: '/api/fights/fighters/:id',
        },
      },
    }

    return reply.send({ success:true, data, timestamp:new Date().toISOString() })
  })
}
