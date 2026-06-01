import { Campeonato } from '../types'

export const CAMPEONATOS: Campeonato[] = [
  { id:'1', nome:'Brasileirão Série A', slug:'brasileirao-serie-a', edicao:'2025', tipo:'liga', pais:'Brasil', ativo:true },
  { id:'2', nome:'Brasileirão Série B', slug:'brasileirao-serie-b', edicao:'2025', tipo:'liga', pais:'Brasil', ativo:true },
  { id:'3', nome:'Copa do Brasil', slug:'copa-do-brasil', edicao:'2025', tipo:'copa', pais:'Brasil', ativo:true },
  { id:'4', nome:'Copa Libertadores', slug:'libertadores', edicao:'2025', tipo:'continental', pais:'América do Sul', ativo:true },
  { id:'5', nome:'Copa Sul-Americana', slug:'sul-americana', edicao:'2025', tipo:'continental', pais:'América do Sul', ativo:true },
  { id:'6', nome:'Campeonato Paulista', slug:'campeonato-paulista', edicao:'2025', tipo:'estadual', pais:'Brasil', ativo:false },
  { id:'7', nome:'Campeonato Carioca', slug:'campeonato-carioca', edicao:'2025', tipo:'estadual', pais:'Brasil', ativo:false },
  { id:'8', nome:'Campeonato Mineiro', slug:'campeonato-mineiro', edicao:'2025', tipo:'estadual', pais:'Brasil', ativo:false },
  { id:'9', nome:'Campeonato Gaúcho', slug:'campeonato-gaucho', edicao:'2025', tipo:'estadual', pais:'Brasil', ativo:false },
]
