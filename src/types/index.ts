export interface Jogo {
  id: string
  mandante: string
  visitante: string
  escudoMandante: string | null
  escudoVisitante: string | null
  campeonato: string
  campeonatoSlug: string
  data: string
  horario: string
  estadio: string | null
  cidade: string | null
  status: 'agendado' | 'ao_vivo' | 'encerrado' | 'cancelado' | 'adiado'
  placarMandante: number | null
  placarVisitante: number | null
  transmissoes: Transmissao[]
  fonte: string
  melhoresMomentos?: VideoMelhoresMomentos[]
}

export interface VideoMelhoresMomentos {
  id: string
  titulo: string
  descricao: string | null
  url: string
  thumbnail: string | null
  data: string | null
  duracao: string | null
  fonte: string
}

export interface Transmissao {
  canal: string
  tipo: 'tv_aberta' | 'tv_fechada' | 'streaming' | 'youtube' | 'desconhecido'
  url: string | null
  logo: string | null
}

export interface TimeSeed {
  id: string
  nome: string
  slug: string
  escudo: string | null
  cidade: string
  estado: string
  estadio: string
  tecnico: string | null
  fundacao: string
  cores: string[]
  transfermarktSlug: string
  historia?: string
  titulos?: string[]
  urlOficial?: string
  // Campos enriquecidos (Série A)
  apelidos?: string[]
  mascote?: string | null
  hino?: string | null
  capacidadeEstadio?: number | null
  presidente?: string | null
  museu?: string | null
  socioTorcedor?: string | null
  redesSociais?: {
    instagram?: string | null
    twitter?: string | null
    youtube?: string | null
    tiktok?: string | null
    facebook?: string | null
  }
  rivais?: string[]
  conquistasInternacionais?: number
  conquistasNacionais?: number
}

export interface JogadorElenco {
  id?: string | null
  nome: string
  posicao: string | null
  numero: number | null
  nacionalidade: string | null
  idade: number | null
  foto: string | null
  fotoReal?: boolean
  perfilUrl?: string | null
}

export interface Campeonato {
  id: string
  nome: string
  slug: string
  edicao: string | null
  tipo: string
  pais: string
  ativo: boolean
}

export interface PosicaoTabela {
  posicao: number
  time: string
  escudo: string | null
  jogos: number
  pontos: number
  vitorias: number
  empates: number
  derrotas: number
  golsPro: number
  golsContra: number
  saldoGols: number
  aproveitamento: number
}

export interface Artilheiro {
  posicao: number
  jogador: string
  time: string
  gols: number
  assistencias: number | null
  foto: string | null
  fotoReal?: boolean
  perfilUrl?: string | null
}

export interface SugestaoConteudo {
  tipo: string
  titulo: string
  descricao: string
  hashtags: string[]
  jogoRelacionado: string | null
}

export interface NoticiaEsporte {
  id: string
  fonte: string
  titulo: string
  resumo: string | null
  url: string
  fonteUrl?: string
  apiUrl?: string
  imagem: string | null
  imagens?: string[]
  conteudo?: string | null
  publicadoEm: string | null
  categoria: string
}

// === NBA / Basquete ============================================================

export interface JogoNBA {
  id: string
  mandante: string
  visitante: string
  abreviacaoMandante: string
  abreviacaoVisitante: string
  logoMandante: string | null
  logoVisitante: string | null
  data: string
  horario: string
  arena: string | null
  cidade: string | null
  status: 'agendado' | 'ao_vivo' | 'encerrado' | 'adiado' | 'cancelado'
  pontosMandante: number | null
  pontosVisitante: number | null
  periodo: number | null
  tempoRestante: string | null
  quartos: { mandante: number[]; visitante: number[] }
  serie: string | null
  vencedor: 'mandante' | 'visitante' | null
  destaques: DestaqueNBA[]
  transmissoes: Transmissao[]
  fonte: string
}

export interface DestaqueNBA {
  jogador: string
  time: string
  estatistica: string
  valor: string
  foto: string | null
}

// === UFC / Lutas ===============================================================

export interface EventoUFC {
  id: string
  nome: string
  apelido: string | null
  data: string
  horario: string
  local: string | null
  cidade: string | null
  pais: string | null
  status: 'agendado' | 'ao_vivo' | 'encerrado'
  card: 'principal' | 'preliminar' | 'completo'
  lutaPrincipal: LutaUFC | null
  lutas: LutaUFC[]
  transmissoes: Transmissao[]
  fonte: string
}

export interface LutaUFC {
  id: string
  categoria: string
  lutador1: LutadorUFC
  lutador2: LutadorUFC
  rounds: number
  vencedor: string | null
  metodo: string | null
  roundFim: number | null
  tempoFim: string | null
  status: 'agendado' | 'ao_vivo' | 'encerrado'
}

export interface LutadorUFC {
  id: string
  nome: string
  apelido: string | null
  pais: string | null
  bandeira: string | null
  cartel: string | null
  foto: string | null
}

// === Agenda unificada ==========================================================

export type EsporteTipo = 'futebol' | 'basquete' | 'mma'

export interface AgendaItem {
  esporte: EsporteTipo
  liga: string
  ligaSlug: string
  titulo: string
  data: string
  horario: string
  status: string
  transmissoes: Transmissao[]
  url: string
  ref: Jogo | JogoNBA | EventoUFC
}
