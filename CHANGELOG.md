# Changelog — Realm of Eternity (MMORPG)

Todas as mudanças notáveis deste projeto estão documentadas aqui.

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

---

### Adicionado (PvP — Liga e Regras Visuais)

- Copiados ícones de imagem para ligas e rating em `public/images/icons/`: `liga_bronze.png`, `liga_prata.png`, `liga_ouro.png`, `liga_platina.png`, `liga_diamante.png`, `liga_mestre.png`, `liga_lenda.png`, `liga_imperador.png` e `icone_rating.png`.
- **`constants.ts`** — cada liga em `PVP_LEAGUES` agora possui o campo `image` (caminho do PNG com o emblema da liga).
- **`PvPPanel.tsx`**:
  - Cabeçalho e cartão da liga usam a **imagem da liga** (`league.image`) e o **ícone de rating** (`icone_rating.png`) no lugar dos emojis.
  - Nome da liga exibido via i18n (`league.${id}`) em vez do id bruto.
  - Novo botão **"Todas as Ligas"** no cartão da liga abrindo um modal que lista todas as ligas em ordem com o emblema, o rating mínimo e destaque para a liga atual.
  - Corrigido `getLeagueData` para retornar a liga correta (antes `.find()` sempre retornava bronze) e removida variável `leagueIndex` não usada.
- **`en.ts` / `pt-BR.ts`**: nova chave `pvp.allLeagues` ("All Leagues" / "Todas as Ligas").

### Validado

- `npx tsc --noEmit` sem erros.

---

### Alterado (PvP — Rating começa em 0)

- **Ponto de partida do rating** agora é **0** para personagens novos (`create/route.ts`), para o default do `jsonDb.ts` e do schema (`schema.ts`), e nos personagens salvos em `data/characters.json` (todos resetados para `0` / liga `bronze`).
- **`constants.ts`** — rebalanceadas as faixas de `PVP_LEAGUES` para a nova escala: bronze 0, prata 300, ouro 600, platina 1000, diamante 1400, mestre 1800, lenda 2300 e imperador 2800 (progressão gradual saindo do 0).
- **Fallbacks corrigidos** (antes `|| 1000` transformava rating 0 em 1000):
  - `battle/route.ts` — `oppRating` e `newAtkRating` agora usam `|| 0`.
  - `fight/route.ts` — filtro de oponentes e geração de bots usam `|| 0`; bots não geram rating negativo (`Math.max(0, ...)`).
  - `rankings/route.ts` — `pvpRating` usa `|| 0`.
  - `PvPPanel.tsx` — `currentRating` usa `|| 0` para exibir 0 corretamente.
- **`titles.ts`** — títulos PvP rebalanceados para a nova escala (brawler ≥300, gladiator ≥1000, warlord ≥1800).
- **Rating por partida reduzido** — variação de rating agora é **+5 (vitória) / −3 (derrota)** em vez de +25/−15, em `battle/route.ts` e `fight/route.ts`. Subida mais lenta e gradual a cada partida.
- **`PvPPanel.tsx`** — ícone `icone_rating.png` adicionado também no resultado da batalha e na lista de oponentes (antes o rating aparecia só como texto). O arquivo `public/images/icons/icone_rating.png` já está no projeto (idêntico ao de `ligaeretting/`).

### Validado

- `npx tsc --noEmit` sem erros.

---

### Adicionado (PvP — Modo Híbrido + 2 Jogadores)

- **Modo de batalha híbrido** no PvP com dois estilos:
  - **⚡ Automático** — o personagem luta sozinho, usando `skill` sempre que tem mana suficiente.
  - **🎮 Turno a Turno** — o jogador controla cada ação manualmente.
- Botão **"Assumir Controle"** durante o modo automático: interrompe o loop automático e passa o controle para o jogador no meio da luta.
- PvP verdadeiro **2 jogadores**: a batalha aceita um oponente real (outro personagem) além de bots, com recalculo de rating para ambos os lados.
- Nova rota **`/api/pvp/battle`** com a lógica de batalha turno a turno (ataque, habilidade, defesa, esquiva, crítico, mana/HP do oponente e limite de 40 rodadas).
- Controles da batalha posicionados **acima do log** de combate.
- Nome da habilidade específico da classe (via `classSkillName`) usado nos botões de batalha.
- 19 chaves de i18n novas para a batalha PvP (pt-BR + en).

### Alterado

- **`constants.ts`**:
  - Adicionado `CLASS_SKILL_NAMES` (mapa classe → nome de habilidade).
  - Adicionado helper `classSkillName(cls, locale)`.
- **`TowerPanel.tsx`**:
  - Botões de controle movidos **acima do log** de batalha.
  - Texto da habilidade substituído de hardcoded para `skillLabel` (baseado em `classType` + `locale`).
  - Import de `classSkillName` adicionado.
- **`PvPPanel.tsx`** — painel reescrito com:
  - Duas opções por oponente (Automático / Turno a Turno).
  - Tela de batalha com barras de HP/MP, floats de dano, shake/flash, comparativo de atributos, log colorido e indicador BOT/Jogador.
  - Tela de resultado com variação de rating (+25/-15), moedas (+12/+3), botões "Voltar à Arena" e "Revanche".
- **`en.ts`** — chave corrigida de `pvp.chooseUp` → `pvp.ratingUp`.
- **`pt-BR.ts`** — chaves novas para o fluxo PvP híbrido.

### Renomeado / Reestruturado

- **Nova arquivo**: `src/app/api/pvp/battle/route.ts` (batalha turno a turno + persistência de rating/liga/coins).
- **`src/app/api/pvp/fight/route.ts`** — rota existente mantida como fonte de oponentes (bots + jogadores reais), consumida pelo novo fluxo.

### Adicionado (PvP — Recompensas de XP e Dinheiro)

- Vitória PvP agora concede **XP (+30)** e **ouro/dinheiro (+12)** além do rating; derrota concede **+8 XP** e **+3 ouro**, com subida de nível automática (+3 pontos de status) quando o XP acumulado atinge o próximo nível.
- Tela de resultado passou a exibir as recompensas com **imagens** (ícone de moeda `/images/icons/icone_moeda.png` para ouro e `/images/icons/icone_xp.png` para XP — este último criado posteriormente).

### Corrigido

- **PvPPanel.tsx** — caminhos dos ícones de atributos corrigidos (`attr_ataque.png`, `attr_defesa.png` etc.), restaurando as imagens no comparativo da arena.
- Nome de chave i18n `pvp.chooseUp` → `pvp.ratingUp` (en).

### Validado

- `npx tsc --noEmit` sem erros.