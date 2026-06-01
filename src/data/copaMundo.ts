/**
 * Dados estáticos da Copa do Mundo FIFA 2026.
 * Sede: Canadá 🇨🇦, México 🇲🇽 e Estados Unidos 🇺🇸.
 * Formato: 48 seleções, 12 grupos de 4, classificação para 16-avos.
 *
 * Fontes: FIFA.com / Wikipedia (atualizado em maio/2026 — sorteio oficial).
 * Quando a fonte oficial publicar o sorteio final, basta atualizar este arquivo.
 */

export interface SedeCopaMundo {
  cidade: string
  pais: string
  estadio: string
  capacidade: number
  jogosPrevistos: number
}

export const SEDES_COPA_MUNDO_2026: SedeCopaMundo[] = [
  // Estados Unidos
  { cidade: 'Atlanta',         pais: 'EUA',     estadio: 'Mercedes-Benz Stadium',     capacidade: 71000, jogosPrevistos: 8 },
  { cidade: 'Boston',          pais: 'EUA',     estadio: 'Gillette Stadium',           capacidade: 65878, jogosPrevistos: 7 },
  { cidade: 'Dallas',          pais: 'EUA',     estadio: 'AT&T Stadium',               capacidade: 80000, jogosPrevistos: 9 },
  { cidade: 'Houston',         pais: 'EUA',     estadio: 'NRG Stadium',                capacidade: 72220, jogosPrevistos: 7 },
  { cidade: 'Kansas City',     pais: 'EUA',     estadio: 'Arrowhead Stadium',          capacidade: 76416, jogosPrevistos: 6 },
  { cidade: 'Los Angeles',     pais: 'EUA',     estadio: 'SoFi Stadium',               capacidade: 70240, jogosPrevistos: 8 },
  { cidade: 'Miami',           pais: 'EUA',     estadio: 'Hard Rock Stadium',          capacidade: 64767, jogosPrevistos: 7 },
  { cidade: 'Nova York/NJ',    pais: 'EUA',     estadio: 'MetLife Stadium',            capacidade: 82500, jogosPrevistos: 8 },
  { cidade: 'Filadélfia',      pais: 'EUA',     estadio: 'Lincoln Financial Field',    capacidade: 69596, jogosPrevistos: 6 },
  { cidade: 'San Francisco',   pais: 'EUA',     estadio: "Levi's Stadium",             capacidade: 68500, jogosPrevistos: 6 },
  { cidade: 'Seattle',         pais: 'EUA',     estadio: 'Lumen Field',                capacidade: 68740, jogosPrevistos: 6 },
  // Canadá
  { cidade: 'Toronto',         pais: 'Canadá',  estadio: 'BMO Field',                  capacidade: 45736, jogosPrevistos: 6 },
  { cidade: 'Vancouver',       pais: 'Canadá',  estadio: 'BC Place',                   capacidade: 54500, jogosPrevistos: 7 },
  // México
  { cidade: 'Cidade do México',pais: 'México',  estadio: 'Estádio Azteca',             capacidade: 87000, jogosPrevistos: 5 },
  { cidade: 'Guadalajara',     pais: 'México',  estadio: 'Estádio Akron',              capacidade: 49850, jogosPrevistos: 4 },
  { cidade: 'Monterrey',       pais: 'México',  estadio: 'Estádio BBVA',               capacidade: 53500, jogosPrevistos: 4 },
]

export interface SelecaoCopa {
  pais: string
  bandeira: string
  confederacao: 'CONMEBOL' | 'UEFA' | 'CONCACAF' | 'AFC' | 'CAF' | 'OFC'
  pote: 1 | 2 | 3 | 4
  ranking: number
}

/**
 * Seleções classificadas (parcial — vai sendo preenchida conforme as eliminatórias terminam).
 * 6 vagas CONMEBOL + 16 UEFA + 6 CONCACAF (3 anfitriões + 3 + 2 repescagem) + 8 AFC + 9 CAF + 1 OFC + 2 repescagem.
 */
export const SELECOES_COPA_MUNDO_2026: SelecaoCopa[] = [
  // Anfitriões (já classificados)
  { pais: 'Estados Unidos', bandeira: '🇺🇸', confederacao: 'CONCACAF', pote: 1, ranking: 16 },
  { pais: 'México',         bandeira: '🇲🇽', confederacao: 'CONCACAF', pote: 1, ranking: 19 },
  { pais: 'Canadá',         bandeira: '🇨🇦', confederacao: 'CONCACAF', pote: 2, ranking: 30 },
  // CONMEBOL
  { pais: 'Argentina',      bandeira: '🇦🇷', confederacao: 'CONMEBOL', pote: 1, ranking: 1 },
  { pais: 'Brasil',         bandeira: '🇧🇷', confederacao: 'CONMEBOL', pote: 1, ranking: 5 },
  { pais: 'Uruguai',        bandeira: '🇺🇾', confederacao: 'CONMEBOL', pote: 2, ranking: 11 },
  { pais: 'Colômbia',       bandeira: '🇨🇴', confederacao: 'CONMEBOL', pote: 2, ranking: 12 },
  { pais: 'Equador',        bandeira: '🇪🇨', confederacao: 'CONMEBOL', pote: 2, ranking: 23 },
  { pais: 'Paraguai',       bandeira: '🇵🇾', confederacao: 'CONMEBOL', pote: 3, ranking: 41 },
  // UEFA (top)
  { pais: 'França',         bandeira: '🇫🇷', confederacao: 'UEFA',     pote: 1, ranking: 2 },
  { pais: 'Espanha',        bandeira: '🇪🇸', confederacao: 'UEFA',     pote: 1, ranking: 3 },
  { pais: 'Inglaterra',     bandeira: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', confederacao: 'UEFA',     pote: 1, ranking: 4 },
  { pais: 'Portugal',       bandeira: '🇵🇹', confederacao: 'UEFA',     pote: 1, ranking: 6 },
  { pais: 'Países Baixos',  bandeira: '🇳🇱', confederacao: 'UEFA',     pote: 1, ranking: 7 },
  { pais: 'Bélgica',        bandeira: '🇧🇪', confederacao: 'UEFA',     pote: 2, ranking: 8 },
  { pais: 'Alemanha',       bandeira: '🇩🇪', confederacao: 'UEFA',     pote: 2, ranking: 9 },
  { pais: 'Croácia',        bandeira: '🇭🇷', confederacao: 'UEFA',     pote: 2, ranking: 10 },
  { pais: 'Itália',         bandeira: '🇮🇹', confederacao: 'UEFA',     pote: 2, ranking: 13 },
  { pais: 'Suíça',          bandeira: '🇨🇭', confederacao: 'UEFA',     pote: 2, ranking: 17 },
  // CAF/AFC/OFC (principais)
  { pais: 'Marrocos',       bandeira: '🇲🇦', confederacao: 'CAF',      pote: 2, ranking: 14 },
  { pais: 'Senegal',        bandeira: '🇸🇳', confederacao: 'CAF',      pote: 3, ranking: 18 },
  { pais: 'Japão',          bandeira: '🇯🇵', confederacao: 'AFC',      pote: 2, ranking: 15 },
  { pais: 'Coreia do Sul',  bandeira: '🇰🇷', confederacao: 'AFC',      pote: 3, ranking: 22 },
  { pais: 'Austrália',      bandeira: '🇦🇺', confederacao: 'AFC',      pote: 3, ranking: 24 },
  { pais: 'Irã',            bandeira: '🇮🇷', confederacao: 'AFC',      pote: 3, ranking: 20 },
  { pais: 'Nova Zelândia',  bandeira: '🇳🇿', confederacao: 'OFC',      pote: 4, ranking: 89 },
]

export interface InfoCopaMundo2026 {
  edicao: number
  ano: number
  paises: string[]
  bandeiras: string[]
  selecoesParticipantes: number
  totalJogos: number
  inicio: string
  fim: string
  mascote: string
  bola: string
  hino: string
}

export const INFO_COPA_MUNDO_2026: InfoCopaMundo2026 = {
  edicao: 23,
  ano: 2026,
  paises: ['Canadá', 'México', 'Estados Unidos'],
  bandeiras: ['🇨🇦', '🇲🇽', '🇺🇸'],
  selecoesParticipantes: 48,
  totalJogos: 104,
  inicio: '2026-06-11',
  fim: '2026-07-19',
  mascote: 'Maple, Zayu & Clutch',
  bola: 'Adidas Trionda',
  hino: 'A definir',
}
