import clubes from './brasileirao_2026_full.json'
import { slugify } from '../utils/slugify'

export interface JogadorBrasileirao2026 {
  nome: string
  posicao: string
  foto: string
}

export interface ClubeBrasileirao2026 {
  nome: string
  sigla: string
  fundacao: string
  estadio: string
  capacidade_estadio: number
  mascote: string
  titulos_principais: string[]
  historia: string
  elenco: JogadorBrasileirao2026[]
  links_fotos_oficiais: string
}

export const BRASILEIRAO_2026_CLUBES = (clubes as ClubeBrasileirao2026[]).map(clube => ({
  ...clube,
  slug: slugify(clube.nome),
}))

const ALIASES: Record<string, string[]> = {
  'athletico-pr': ['athletico-paranaense', 'club-athletico-paranaense'],
  'atletico-mg': ['clube-atletico-mineiro', 'atletico-mineiro'],
  'botafogo': ['botafogo-de-futebol-e-regatas'],
  'flamengo': ['clube-de-regatas-do-flamengo'],
  'fluminense': ['fluminense-football-club'],
  'gremio': ['gremio-foot-ball-porto-alegrense'],
  'internacional': ['sport-club-internacional'],
  'sao-paulo': ['sao-paulo-futebol-clube'],
  'vasco': ['club-de-regatas-vasco-da-gama', 'vasco-da-gama'],
  'vitoria': ['esporte-clube-vitoria'],
}

export function buscarClubeBrasileirao2026(slug: string) {
  return BRASILEIRAO_2026_CLUBES.find(clube =>
    clube.slug === slug ||
    ALIASES[slug]?.includes(clube.slug) ||
    Object.entries(ALIASES).some(([canonical, aliases]) => canonical === clube.slug && aliases.includes(slug))
  ) ?? null
}
