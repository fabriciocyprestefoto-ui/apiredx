import { Transmissao } from '../types'

/**
 * MAPA DE EMISSORAS — REDX API Esporte
 *
 * Cada entrada tem:
 *   canal:     nome normalizado para exibir
 *   tipo:      tv_aberta | tv_fechada | streaming | youtube
 *   url:       link direto para assistir ao vivo no portal de streaming
 *   logo:      URL da logo em PNG/SVG transparente (CDN estável)
 *   logoAlt:   URL alternativa de fallback
 *   cor:       cor primária da marca (hex) para o portal usar como fundo/borda
 *   descricao: texto curto para tooltip
 */

export interface EmissoraInfo {
  id: string
  canal: string
  tipo: Transmissao['tipo']
  url: string | null
  logo: string | null
  logoAlt?: string | null
  cor: string
  descricao: string
}

export const EMISSORAS: Record<string, EmissoraInfo> = {

  // ── TV ABERTA ───────────────────────────────────────────────────────────────

  'globo': {
    id: 'globo',
    canal: 'TV Globo',
    tipo: 'tv_aberta',
    url: 'https://globoplay.globo.com/ao-vivo/tv-globo/',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/TV_Globo_2021.svg/200px-TV_Globo_2021.svg.png',
    logoAlt: 'https://upload.wikimedia.org/wikipedia/commons/5/5d/Rede_Globo_logo_2021.svg',
    cor: '#F08300',
    descricao: 'TV Globo — aberta, ao vivo no GloboPlay',
  },

  'band': {
    id: 'band',
    canal: 'Band',
    tipo: 'tv_aberta',
    url: 'https://band.uol.com.br/ao-vivo',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Band_logo_2014.svg/200px-Band_logo_2014.svg.png',
    logoAlt: null,
    cor: '#005FAD',
    descricao: 'Band — TV aberta, transmite Brasileirão e Copa',
  },

  'record': {
    id: 'record',
    canal: 'RecordTV',
    tipo: 'tv_aberta',
    url: 'https://www.recordtv.com.br/ao-vivo',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Record_News_logo_2023.svg/200px-Record_News_logo_2023.svg.png',
    logoAlt: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Logo_RecordTV_2015.svg/200px-Logo_RecordTV_2015.svg.png',
    cor: '#E30613',
    descricao: 'RecordTV — TV aberta, assista no PlayPlus',
  },

  'sbt': {
    id: 'sbt',
    canal: 'SBT',
    tipo: 'tv_aberta',
    url: 'https://www.sbt.com.br/ao-vivo',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Logo_SBT_atual.svg/200px-Logo_SBT_atual.svg.png',
    logoAlt: null,
    cor: '#00AEEF',
    descricao: 'SBT — TV aberta, transmite Copa Sul-Americana',
  },

  // ── TV FECHADA ──────────────────────────────────────────────────────────────

  'sportv': {
    id: 'sportv',
    canal: 'SporTV',
    tipo: 'tv_fechada',
    url: 'https://globoplay.globo.com/ao-vivo/sportv/',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/SporTV_2017_logo.svg/200px-SporTV_2017_logo.svg.png',
    logoAlt: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/SporTV_logo_2016.svg/200px-SporTV_logo_2016.svg.png',
    cor: '#009B3A',
    descricao: 'SporTV — canal de esportes da Globo, disponível no GloboPlay',
  },

  'premiere': {
    id: 'premiere',
    canal: 'Premiere',
    tipo: 'tv_fechada',
    url: 'https://premiere.globo.com',
    logo: 'https://upload.wikimedia.org/wikipedia/pt/d/d3/Premiere_logo.png',
    logoAlt: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Premiere_logo_2020.svg/200px-Premiere_logo_2020.svg.png',
    cor: '#F5A623',
    descricao: 'Premiere — pacote de futebol da Globo, todos os jogos do Brasileirão',
  },

  'espn': {
    id: 'espn',
    canal: 'ESPN',
    tipo: 'tv_fechada',
    url: 'https://www.disneyplus.com/en-gb/movies/espn/66f6piiKZbNE',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/ESPN_wordmark.svg/200px-ESPN_wordmark.svg.png',
    logoAlt: null,
    cor: '#CC0000',
    descricao: 'ESPN — esportes no Disney+, Champions, Premier League',
  },

  'espn2': {
    id: 'espn2',
    canal: 'ESPN 2',
    tipo: 'tv_fechada',
    url: 'https://www.disneyplus.com/en-gb/movies/espn/66f6piiKZbNE',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/ESPN_wordmark.svg/200px-ESPN_wordmark.svg.png',
    logoAlt: null,
    cor: '#CC0000',
    descricao: 'ESPN 2 — canal de esportes no Disney+',
  },

  'espn3': {
    id: 'espn3',
    canal: 'ESPN 3',
    tipo: 'tv_fechada',
    url: 'https://www.disneyplus.com/en-gb/movies/espn/66f6piiKZbNE',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/ESPN_wordmark.svg/200px-ESPN_wordmark.svg.png',
    logoAlt: null,
    cor: '#CC0000',
    descricao: 'ESPN 3 — canal de esportes no Disney+',
  },

  'espn4': {
    id: 'espn4',
    canal: 'ESPN 4',
    tipo: 'tv_fechada',
    url: 'https://www.disneyplus.com/en-gb/movies/espn/66f6piiKZbNE',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/ESPN_wordmark.svg/200px-ESPN_wordmark.svg.png',
    logoAlt: null,
    cor: '#CC0000',
    descricao: 'ESPN 4 — canal de esportes no Disney+',
  },

  'tnt': {
    id: 'tnt',
    canal: 'TNT Sports',
    tipo: 'tv_fechada',
    url: 'https://max.com',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/TNT_Logo_2016.svg/200px-TNT_Logo_2016.svg.png',
    logoAlt: null,
    cor: '#FF3700',
    descricao: 'TNT Sports — Champions League, disponível no Max',
  },

  'space': {
    id: 'space',
    canal: 'Space',
    tipo: 'tv_fechada',
    url: 'https://max.com',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/SpaceLogo.svg/200px-SpaceLogo.svg.png',
    logoAlt: null,
    cor: '#1B1B4B',
    descricao: 'Space — canal de esportes disponível no Max',
  },

  'combate': {
    id: 'combate',
    canal: 'Canal Combate',
    tipo: 'tv_fechada',
    url: 'https://canalcombate.globo.com',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Logo_canal_Combate_2017.png/200px-Logo_canal_Combate_2017.png',
    logoAlt: null,
    cor: '#E30613',
    descricao: 'Canal Combate — UFC, MMA ao vivo no GloboPlay',
  },

  'fox sports': {
    id: 'fox-sports',
    canal: 'Fox Sports',
    tipo: 'tv_fechada',
    url: null,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Fox_Sports_logo.svg/200px-Fox_Sports_logo.svg.png',
    logoAlt: null,
    cor: '#003865',
    descricao: 'Fox Sports — canal de esportes',
  },

  'record news': {
    id: 'record-news',
    canal: 'Record News',
    tipo: 'tv_fechada',
    url: 'https://recordnews.r7.com',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Record_News_logo_2023.svg',
    logoAlt: null,
    cor: '#E30613',
    descricao: 'Record News — canal de notícias e esportes',
  },

  // ── STREAMING ───────────────────────────────────────────────────────────────

  'prime video': {
    id: 'prime-video',
    canal: 'Prime Video',
    tipo: 'streaming',
    url: 'https://www.primevideo.com/storefront/live-sports',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/1/11/Amazon_Prime_Video_logo.svg',
    logoAlt: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Amazon_Prime_Video_logo.svg/200px-Amazon_Prime_Video_logo.svg.png',
    cor: '#00A8E0',
    descricao: 'Amazon Prime Video — Copa do Brasil, jogos ao vivo',
  },

  'amazon': {
    id: 'prime-video',
    canal: 'Prime Video',
    tipo: 'streaming',
    url: 'https://www.primevideo.com/storefront/live-sports',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/1/11/Amazon_Prime_Video_logo.svg',
    logoAlt: null,
    cor: '#00A8E0',
    descricao: 'Amazon Prime Video — Copa do Brasil, jogos ao vivo',
  },

  'disney+': {
    id: 'disney-plus',
    canal: 'Disney+',
    tipo: 'streaming',
    url: 'https://www.disneyplus.com',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Disney%2B_logo.svg/200px-Disney%2B_logo.svg.png',
    logoAlt: null,
    cor: '#113CCF',
    descricao: 'Disney+ — ESPN, Champions, Premier League, La Liga',
  },

  'paramount+': {
    id: 'paramount-plus',
    canal: 'Paramount+',
    tipo: 'streaming',
    url: 'https://www.paramountplus.com',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/Paramount_Plus_logo_%282024%29.svg',
    logoAlt: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Paramount%2B_logo.svg/200px-Paramount%2B_logo.svg.png',
    cor: '#0064FF',
    descricao: 'Paramount+ — UEFA Europa Conference, UFC',
  },

  'paramount': {
    id: 'paramount-plus',
    canal: 'Paramount+',
    tipo: 'streaming',
    url: 'https://www.paramountplus.com',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/Paramount_Plus_logo_%282024%29.svg',
    logoAlt: null,
    cor: '#0064FF',
    descricao: 'Paramount+ — UEFA Europa Conference, UFC',
  },

  'dazn': {
    id: 'dazn',
    canal: 'DAZN',
    tipo: 'streaming',
    url: 'https://www.dazn.com',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/DAZN_brand_logo.svg/200px-DAZN_brand_logo.svg.png',
    logoAlt: null,
    cor: '#F8FF00',
    descricao: 'DAZN — plataforma de esportes ao vivo',
  },

  'max': {
    id: 'max',
    canal: 'Max',
    tipo: 'streaming',
    url: 'https://www.max.com',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/HBO_Max_Logo.svg/200px-HBO_Max_Logo.svg.png',
    logoAlt: null,
    cor: '#002BE7',
    descricao: 'Max (HBO Max) — Champions League, TNT Sports',
  },

  'hbo max': {
    id: 'max',
    canal: 'Max',
    tipo: 'streaming',
    url: 'https://www.max.com',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/HBO_Max_Logo.svg/200px-HBO_Max_Logo.svg.png',
    logoAlt: null,
    cor: '#002BE7',
    descricao: 'Max (HBO Max) — Champions League, TNT Sports',
  },

  'globoplay': {
    id: 'globoplay',
    canal: 'Globoplay',
    tipo: 'streaming',
    url: 'https://globoplay.globo.com',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Rede_Globo_logo_2021.svg/200px-Rede_Globo_logo_2021.svg.png',
    logoAlt: null,
    cor: '#F08300',
    descricao: 'Globoplay — streaming da Globo, ao vivo e sob demanda',
  },

  'onefootball': {
    id: 'onefootball',
    canal: 'OneFootball',
    tipo: 'streaming',
    url: 'https://onefootball.com',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/OneFootball_logo.svg/200px-OneFootball_logo.svg.png',
    logoAlt: null,
    cor: '#00C3FF',
    descricao: 'OneFootball — Bundesliga, partidas avulsas',
  },

  'nosso futebol': {
    id: 'nosso-futebol',
    canal: 'Nosso Futebol',
    tipo: 'streaming',
    url: 'https://nossofutebol.com.br',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/TV_Globo_2021.svg/200px-TV_Globo_2021.svg.png',
    logoAlt: null,
    cor: '#009B3A',
    descricao: 'Nosso Futebol+ — streaming para fãs de futebol',
  },

  'playplus': {
    id: 'playplus',
    canal: 'PlayPlus',
    tipo: 'streaming',
    url: 'https://www.playplus.com',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Logo_RecordTV_2015.svg/200px-Logo_RecordTV_2015.svg.png',
    logoAlt: null,
    cor: '#E30613',
    descricao: 'PlayPlus — streaming da Record TV',
  },

  'apple tv': {
    id: 'apple-tv-plus',
    canal: 'Apple TV+',
    tipo: 'streaming',
    url: 'https://tv.apple.com',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Apple_TV_Plus_Logo.svg/200px-Apple_TV_Plus_Logo.svg.png',
    logoAlt: null,
    cor: '#555555',
    descricao: 'Apple TV+ — MLS Season Pass, futebol americano',
  },

  'apple tv+': {
    id: 'apple-tv-plus',
    canal: 'Apple TV+',
    tipo: 'streaming',
    url: 'https://tv.apple.com',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Apple_TV_Plus_Logo.svg/200px-Apple_TV_Plus_Logo.svg.png',
    logoAlt: null,
    cor: '#555555',
    descricao: 'Apple TV+ — MLS Season Pass, futebol americano',
  },

  'ufc fight pass': {
    id: 'ufc-fight-pass',
    canal: 'UFC Fight Pass',
    tipo: 'streaming',
    url: 'https://ufcfightpass.com',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/UFC_Logo.svg/200px-UFC_Logo.svg.png',
    logoAlt: null,
    cor: '#D20A0A',
    descricao: 'UFC Fight Pass — todas as lutas UFC ao vivo e on demand',
  },

  'fight pass': {
    id: 'ufc-fight-pass',
    canal: 'UFC Fight Pass',
    tipo: 'streaming',
    url: 'https://ufcfightpass.com',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/UFC_Logo.svg/200px-UFC_Logo.svg.png',
    logoAlt: null,
    cor: '#D20A0A',
    descricao: 'UFC Fight Pass — todas as lutas UFC ao vivo e on demand',
  },

  'nba league pass': {
    id: 'nba-league-pass',
    canal: 'NBA League Pass',
    tipo: 'streaming',
    url: 'https://watch.nba.com',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/03/National_Basketball_Association_logo.svg/200px-National_Basketball_Association_logo.svg.png',
    logoAlt: null,
    cor: '#1D428A',
    descricao: 'NBA League Pass — todos os jogos da NBA ao vivo',
  },

  'league pass': {
    id: 'nba-league-pass',
    canal: 'NBA League Pass',
    tipo: 'streaming',
    url: 'https://watch.nba.com',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/03/National_Basketball_Association_logo.svg/200px-National_Basketball_Association_logo.svg.png',
    logoAlt: null,
    cor: '#1D428A',
    descricao: 'NBA League Pass — todos os jogos da NBA ao vivo',
  },

  'netflix': {
    id: 'netflix',
    canal: 'Netflix',
    tipo: 'streaming',
    url: 'https://netflix.com',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Netflix_2015_logo.svg/200px-Netflix_2015_logo.svg.png',
    logoAlt: null,
    cor: '#E50914',
    descricao: 'Netflix — esportes ao vivo e documentários',
  },

  'fifa+': {
    id: 'fifa-plus',
    canal: 'FIFA+',
    tipo: 'streaming',
    url: 'https://www.fifa.com/fifaplus',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/FIFA_logo_without_slogan.svg/200px-FIFA_logo_without_slogan.svg.png',
    logoAlt: null,
    cor: '#326295',
    descricao: 'FIFA+ — documentários e jogos ao vivo da FIFA',
  },

  // ── YOUTUBE / DIGITAL ───────────────────────────────────────────────────────

  'cazetv': {
    id: 'cazetv',
    canal: 'CazéTV',
    tipo: 'youtube',
    url: 'https://www.youtube.com/@CazeTVOficial/live',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b2/Caz%C3%A9TV_logo.png',
    logoAlt: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/YouTube_full-color_icon_%282017%29.svg/48px-YouTube_full-color_icon_%282017%29.svg.png',
    cor: '#FF0033',
    descricao: 'CazéTV — Copa do Mundo, futebol europeu ao vivo no YouTube',
  },

  'cazé': {
    id: 'cazetv',
    canal: 'CazéTV',
    tipo: 'youtube',
    url: 'https://www.youtube.com/@CazeTVOficial/live',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b2/Caz%C3%A9TV_logo.png',
    logoAlt: null,
    cor: '#FF0033',
    descricao: 'CazéTV — futebol ao vivo no YouTube, gratuito',
  },

  'cazé tv': {
    id: 'cazetv',
    canal: 'CazéTV',
    tipo: 'youtube',
    url: 'https://www.youtube.com/@CazeTVOficial/live',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b2/Caz%C3%A9TV_logo.png',
    logoAlt: null,
    cor: '#FF0033',
    descricao: 'CazéTV — futebol ao vivo no YouTube, gratuito',
  },

  'canal goat': {
    id: 'canal-goat',
    canal: 'Canal GOAT',
    tipo: 'youtube',
    url: 'https://www.youtube.com/@CanalGOATBR/live',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/YouTube_full-color_icon_%282017%29.svg/48px-YouTube_full-color_icon_%282017%29.svg.png',
    logoAlt: null,
    cor: '#FF0000',
    descricao: 'Canal GOAT — futebol e esportes no YouTube',
  },

  'goat': {
    id: 'canal-goat',
    canal: 'Canal GOAT',
    tipo: 'youtube',
    url: 'https://www.youtube.com/@CanalGOATBR/live',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/YouTube_full-color_icon_%282017%29.svg/48px-YouTube_full-color_icon_%282017%29.svg.png',
    logoAlt: null,
    cor: '#FF0000',
    descricao: 'Canal GOAT — futebol e esportes no YouTube',
  },

  'youtube': {
    id: 'youtube',
    canal: 'YouTube',
    tipo: 'youtube',
    url: 'https://youtube.com',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/YouTube_full-color_icon_%282017%29.svg/48px-YouTube_full-color_icon_%282017%29.svg.png',
    logoAlt: null,
    cor: '#FF0000',
    descricao: 'YouTube — canais de esporte ao vivo',
  },

  'ge tv': {
    id: 'ge-tv',
    canal: 'ge.globo',
    tipo: 'youtube',
    url: 'https://ge.globo.com',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/TV_Globo_2021.svg/200px-TV_Globo_2021.svg.png',
    logoAlt: null,
    cor: '#F08300',
    descricao: 'ge.globo — cobertura de futebol da Globo',
  },

  'ge': {
    id: 'ge',
    canal: 'ge.globo',
    tipo: 'streaming',
    url: 'https://ge.globo.com',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/TV_Globo_2021.svg/200px-TV_Globo_2021.svg.png',
    logoAlt: null,
    cor: '#F08300',
    descricao: 'ge.globo — portal de esportes da Globo',
  },

  'tnt sports': {
    id: 'tnt-sports',
    canal: 'TNT Sports',
    tipo: 'tv_fechada',
    url: 'https://max.com',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/TNT_Logo_2016.svg/200px-TNT_Logo_2016.svg.png',
    logoAlt: null,
    cor: '#FF3700',
    descricao: 'TNT Sports — Champions League disponível no Max',
  },

  'xsports': {
    id: 'xsports',
    canal: 'X Sports',
    tipo: 'streaming',
    url: 'https://twitter.com',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/X_logo_2023.svg/200px-X_logo_2023.svg.png',
    logoAlt: null,
    cor: '#000000',
    descricao: 'X Sports — esportes transmitidos ao vivo no X (Twitter)',
  },

  'x sports': {
    id: 'xsports',
    canal: 'X Sports',
    tipo: 'streaming',
    url: 'https://twitter.com',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/X_logo_2023.svg/200px-X_logo_2023.svg.png',
    logoAlt: null,
    cor: '#000000',
    descricao: 'X Sports — esportes transmitidos ao vivo no X (Twitter)',
  },

  'futebol na band': {
    id: 'band',
    canal: 'Futebol na Band',
    tipo: 'tv_aberta',
    url: 'https://band.uol.com.br/ao-vivo',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Band_logo_2014.svg/200px-Band_logo_2014.svg.png',
    logoAlt: null,
    cor: '#005FAD',
    descricao: 'Futebol na Band — Brasileirão série A ao vivo',
  },

  'nba': {
    id: 'nba-league-pass',
    canal: 'NBA League Pass',
    tipo: 'streaming',
    url: 'https://watch.nba.com',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/03/National_Basketball_Association_logo.svg/200px-National_Basketball_Association_logo.svg.png',
    logoAlt: null,
    cor: '#1D428A',
    descricao: 'NBA League Pass — todos os jogos da NBA ao vivo',
  },

  'ufc': {
    id: 'ufc-fight-pass',
    canal: 'UFC Fight Pass',
    tipo: 'streaming',
    url: 'https://ufcfightpass.com',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/UFC_Logo.svg/200px-UFC_Logo.svg.png',
    logoAlt: null,
    cor: '#D20A0A',
    descricao: 'UFC Fight Pass — todas as lutas UFC ao vivo',
  },

  'sporttv': {
    id: 'sportv',
    canal: 'SporTV',
    tipo: 'tv_fechada',
    url: 'https://globoplay.globo.com/ao-vivo/sportv/',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/SporTV_2017_logo.svg/200px-SporTV_2017_logo.svg.png',
    logoAlt: null,
    cor: '#009B3A',
    descricao: 'SporTV — canal de esportes da Globo',
  },

  'a confirmar': {
    id: 'a-confirmar',
    canal: 'A confirmar',
    tipo: 'desconhecido' as Transmissao['tipo'],
    url: null,
    logo: null,
    logoAlt: null,
    cor: '#6B7280',
    descricao: 'Transmissão ainda não confirmada',
  },
}

// ────────────────────────────────────────────────────────────────────────────
// Funções de normalização e mescla (retrocompatíveis com o código existente)
// ────────────────────────────────────────────────────────────────────────────

export function normalizarTransmissao(canalRaw: string): Transmissao {
  const lower = canalRaw.toLowerCase().trim()
  for (const [chave, val] of Object.entries(EMISSORAS)) {
    if (lower.includes(chave)) {
      return {
        canal: val.canal,
        tipo:  val.tipo,
        url:   val.url,
        logo:  val.logo,
      }
    }
  }
  return { canal: canalRaw.trim(), tipo: 'desconhecido', url: null, logo: null }
}

/** Retorna EmissoraInfo completo (inclui cor, descricao, logoAlt). */
export function resolverEmissora(canalRaw: string): EmissoraInfo | null {
  const lower = canalRaw.toLowerCase().trim()
  for (const [chave, val] of Object.entries(EMISSORAS)) {
    if (lower.includes(chave)) return val
  }
  return null
}

/**
 * Transmissões padrão por liga no mercado brasileiro (2025/2026).
 */
export const TRANSMISSOES_PADRAO_BR: Record<string, string[]> = {
  'bra.1':                ['Globo', 'SporTV', 'Premiere'],
  'bra.2':                ['SporTV', 'Premiere'],
  'bra.copa_brasil':      ['Globo', 'SporTV', 'Premiere', 'Prime Video'],
  'conmebol.libertadores':['Globo', 'ESPN', 'Disney+', 'Paramount+'],
  'conmebol.sudamericana':['SBT', 'ESPN', 'Disney+', 'Paramount+'],
  'uefa.champions':       ['SporTV', 'TNT Sports', 'Max', 'Space'],
  'uefa.europa':          ['ESPN', 'Disney+'],
  'uefa.europa.conf':     ['Paramount+'],
  'eng.1':                ['ESPN', 'Disney+'],
  'esp.1':                ['ESPN', 'Disney+'],
  'ita.1':                ['ESPN', 'Disney+', 'CazéTV'],
  'ger.1':                ['SporTV', 'OneFootball'],
  'fra.1':                ['CazéTV', 'X Sports'],
  'fifa.world':           ['Globo', 'SporTV', 'CazéTV'],
  'fifa.worldq.uefa':     ['SporTV', 'CazéTV'],
  'fifa.worldq.conmebol': ['SporTV', 'Globo'],
  'nba':                  ['NBA League Pass', 'ESPN', 'TNT Sports'],
  'ufc':                  ['UFC Fight Pass', 'Combate', 'Paramount+'],
}

export function transmissoesPadraoLiga(ligaCodigo: string): Transmissao[] {
  const canais = TRANSMISSOES_PADRAO_BR[ligaCodigo]
  if (!canais?.length) return [normalizarTransmissao('A confirmar')]
  return canais.map(normalizarTransmissao)
}

export function mesclarTransmissoes(detectadas: Transmissao[], ligaCodigo: string): Transmissao[] {
  const reconhecidas = detectadas.filter(t => t.tipo !== 'desconhecido')
  if (reconhecidas.length > 0) {
    const padroes = transmissoesPadraoLiga(ligaCodigo)
    const canaisPresentes = new Set(reconhecidas.map(t => t.canal.toLowerCase()))
    const extras = padroes.filter(p => !canaisPresentes.has(p.canal.toLowerCase()))
    return [...reconhecidas, ...extras]
  }
  return transmissoesPadraoLiga(ligaCodigo)
}

/**
 * Lista completa de emissoras únicas (sem aliases/duplicatas) — para o endpoint /api/transmissoes/canais
 */
export function listarCanaisUnicos(): EmissoraInfo[] {
  const vistos = new Set<string>()
  const lista: EmissoraInfo[] = []
  for (const val of Object.values(EMISSORAS)) {
    if (!vistos.has(val.id)) {
      vistos.add(val.id)
      lista.push(val)
    }
  }
  return lista.sort((a, b) => {
    // Ordena: tv_aberta → tv_fechada → streaming → youtube → desconhecido
    const order: Record<string, number> = { tv_aberta: 0, tv_fechada: 1, streaming: 2, youtube: 3, desconhecido: 4 }
    return (order[a.tipo] ?? 5) - (order[b.tipo] ?? 5)
  })
}
