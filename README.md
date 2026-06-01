# Futebol Brasil API 🏆

API REST premium para dados esportivos — futebol brasileiro, futebol europeu, Copa do Mundo 2026, NBA e lutas/UFC. Criada para alimentar o portal de streaming **tv-moderno-limpo**.

---

## Como instalar

```bash
cd futebol-brasil-api
npm install
```

## Como rodar

```bash
# Desenvolvimento (hot reload)
npm run dev

# Build de produção
npm run build
npm start
```

A API sobe na porta **3333** por padrão (ou `PORT` no `.env`).

---

## Variáveis de ambiente

Copie `.env.example` para `.env` e ajuste:

```bash
cp .env.example .env
```

Variáveis principais:

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3333` | Porta do servidor |
| `NODE_ENV` | `development` | Ambiente |
| `ENABLE_SCRAPERS` | `true` | Liga/desliga scrapers externos |

---

## Endpoints

### 🏠 Home agregada (endpoint principal)

```
GET /api/sports/home
```
Retorna seções prontas para cards do app de TV: ao vivo, futebol do dia, Brasileirão, Europa, Copa 2026, NBA e Lutas.

### ⚽ Futebol

```
GET /api/football/matches/today
GET /api/football/matches/upcoming?days=7
GET /api/football/matches/live
GET /api/football/matches/recent
GET /api/football/competitions
GET /api/football/competitions/:id/standings
GET /api/football/competitions/:id/matches?date=YYYY-MM-DD
GET /api/football/teams
GET /api/football/teams/:id
GET /api/football/teams/:id/squad
```

IDs de competição disponíveis: `brasileirao-serie-a`, `brasileirao-serie-b`, `copa-do-brasil`, `libertadores`, `sul-americana`, `champions-league`, `premier-league`, `la-liga`, `serie-a-italia`, `bundesliga`, `ligue-1`.

### 🌍 Copa do Mundo 2026

```
GET /api/world-cup/2026
GET /api/world-cup/2026/teams
GET /api/world-cup/2026/groups
GET /api/world-cup/2026/matches
GET /api/world-cup/2026/stadiums
```

### 🏀 NBA

```
GET /api/nba/games/today
GET /api/nba/games/upcoming?days=7
GET /api/nba/standings
GET /api/nba/teams
GET /api/nba/teams/:id
GET /api/nba/players/:id
```

### 🥊 Lutas / UFC

```
GET /api/fights/events
GET /api/fights/events/upcoming
GET /api/fights/events/:id
GET /api/fights/fighters/:id
```

### 🔍 Busca

```
GET /api/search?q=flamengo
```

### ❤️ Health

```
GET /api/health
GET /api/health/cache/clear
```

### Endpoints legados (compatibilidade)

```
GET /api/jogos/hoje
GET /api/jogos?data=YYYY-MM-DD
GET /api/times
GET /api/times/:slug
GET /api/campeonatos
GET /api/nba/jogos/hoje
GET /api/ufc/calendario
GET /api/agenda
GET /api/copa-mundo
```

---

## Fontes utilizadas

| Módulo | Fonte | Notas |
|---|---|---|
| Futebol brasileiro | ESPN API pública (`site.api.espn.com`) | Sem chave necessária |
| Futebol europeu | ESPN API pública | Sem chave necessária |
| Copa 2026 | ESPN + dados estáticos | Jogos via ESPN quando disponíveis |
| NBA | ESPN API pública (`basketball/nba`) | Sem chave necessária |
| UFC/MMA | ESPN API pública (`mma/ufc`) | Sem chave necessária |
| Times brasileiros | Dados curados + ESPN | Escudos via Globo/GE |
| Jogos (fallback) | Sofascore API pública | Fallback para futebol BR |

---

## Cache

Sistema de cache em memória com persistência em arquivo `.cache.json`.

| Tipo | TTL |
|---|---|
| Jogos ao vivo | 1 min |
| Home agregada | 2 min |
| Jogos do dia | 5 min |
| Próximos jogos / transmissões | 30 min |
| Tabelas | 1 hora |
| Times / Elencos | 24 horas |
| Competições | 6 horas |

Para limpar o cache: `GET /api/health/cache/clear`

---

## Integração com tv-moderno-limpo

No projeto **tv-moderno-limpo**, adicione ao `.env`:

```
VITE_SPORTS_API_URL=http://localhost:3333
```

O serviço `services/sportsApi.ts` já está configurado para consumir esta API. Funções disponíveis:

```typescript
import {
  getSportsHome,
  getTodayFootballMatches,
  getUpcomingMatches,
  getLiveMatches,
  getTeamDetails,
  getCompetitionStandings,
  getNbaGames,
  getFightEvents,
} from '@/services/sportsApi'
```

---

## Backup / Branch antes de alterar

```bash
git checkout -b feature/api-esportes-premium
git add -A
git commit -m "feat: backup antes da expansão premium"
```

---

## Limitações conhecidas

- Dados de jogadores ao vivo dependem da ESPN — podem ter delay de 30s–2min
- Sorteio da Copa 2026 em `world-cup/2026/groups` é estimado (atualizar após anúncio oficial)
- Sofascore pode bloquear IPs após muitas requisições — ESPN é o fallback principal
- Fotos de jogadores usam ESPN headshots (podem não estar disponíveis para todos)

---

## Próximos passos

- [ ] Adicionar módulo de Brasileirão Série B completo
- [ ] Integrar API-Football.com para dados mais ricos (com chave)
- [ ] Adicionar módulo de boxe (além do UFC)
- [ ] Cache distribuído com Redis para produção
- [ ] Webhook para atualizar dados ao vivo via push
- [ ] Adicionar artilharia para ligas europeias
