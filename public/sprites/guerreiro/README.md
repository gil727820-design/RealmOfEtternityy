# Sprites do Guerreiro (pixel art)

Sprites copiados e composto a partir dos diretórios locais atuais:

- `C:\Users\Pereira\Downloads\SPRITTESTE\pixel_guerreiro\CORPO BASE E ITENS INICIAL` (personagem base + itens iniciais)
- `C:\Users\Pereira\Downloads\SPRITTESTE\pixel_guerreiro\armadura e espdas` (novos itens)

## Estrutura

| Pasta | Conteúdo |
| --- | --- |
| `base/` | Cópias dos sprites do kit inicial (corpo, escudo, capa, capacete, espada de ferro) |
| `novos/` | Cópias dos novos itens (armaduras, capas, escudos, espadas, espada clássica) |
| `combinacoes/` | Sprites finais compostos em camadas + `manifesto.json` |
| `scripts/` | `compor_guerreiro.py` (gera) e `validar_guerreiro.py` (verifica) |

## Especificação técnica

- Tamanho de todos os sprites finais: **1632 × 2176 px** (RGBA, fundo transparente).
- A composição é feita por sobreposição (alpha compositing) de camadas **sem reposicionamento**.
- Itens que vieram em escala menor (mesma proporção 3:4, ex.: `escudo_v2_ouro` 240×320,
  `01_espada.PNG` 295×393) são redimensionados de volta para o canvas 1632×2176,
  mantendo o alinhamento com as demais camadas.
- Ordem de empilhamento (de trás para a frente):
  `capa → corpo → armadura → capacete → escudo → espada`

## Combinações geradas

| Arquivo | Camadas |
| --- | --- |
| `01_guerreiro_corpo.png` | corpo base |
| `02_guerreiro_completo_inicial.png` | capa + corpo + capacete + escudo + espada (kit inicial) |
| `03_guerreiro_capa_real.png` | capa real + corpo |
| `04_guerreiro_capa_arcano.png` | capa arcano + corpo |
| `05_guerreiro_armadura_cavaleiro.png` | corpo + armadura de cavaleiro + capacete |
| `06_guerreiro_armadura_negra.png` | corpo + armadura negra + capacete |
| `07_guerreiro_espada_chama.png` | corpo + espada de chama |
| `08_guerreiro_espada_sombra.png` | corpo + espada de sombra |
| `09_guerreiro_escudo_ouro.png` | corpo + escudo de ouro |
| `10_guerreiro_escudo_cristal.png` | corpo + escudo de cristal |
| `11_set_cavaleiro_ferro.png` | capa real + corpo + capacete + escudo ferro + espada ferro |
| `12_set_cavaleiro_ouro.png` | capa real + corpo + capacete + escudo ouro + espada ferro |
| `13_set_cavaleiro_cristal.png` | capa arcano + corpo + capacete + escudo cristal + espada ferro |
| `14_set_cavaleiro_chama.png` | capa real + corpo + capacete + escudo ouro + espada chama |
| `15_set_guerreiro_sombrio.png` | capa arcano + corpo + armadura negra + capacete + escudo cristal + espada sombra |
| `16_set_guerreiro_sombrio_ferro.png` | capa arcano + corpo + armadura negra + capacete + escudo ferro + espada sombra |
| `17_set_armadura_cavaleiro_ferro.png` | capa real + corpo + armadura cavaleiro + capacete + escudo ferro + espada ferro |
| `18_set_armadura_cavaleiro_chama.png` | capa real + corpo + armadura cavaleiro + capacete + escudo ouro + espada chama |
| `19_set_armadura_cavaleiro_cristal.png` | capa arcano + corpo + armadura cavaleiro + capacete + escudo cristal + espada ferro |
| `20_set_espada_classica.png` | capa inicial + corpo + capacete + escudo inicial + espada clássica |

## Observação sobre 3 arquivos-fonte

`espada_v1_ferro.png`, `espada_v3_sombra.png` e `armadura_v2_negra.png` ainda
mantêm um resíduo translúcido de fundo nos cantos (alpha ~30–55). Isso é
herdado diretamente desses arquivos de entrada (copiados sem alteração). Para
fundo 100% limpo, reexporte esses 3 itens com fundo transparente e rode o
## Integração no site (TSX)

O jogo é um site Next.js. A composição em camadas (`itemSprites.ts` +
`WarriorSprite.tsx`) está descontinuada na UI e será substituída pelo futuro
sistema de skins; os PNGs continuam servidos como fonte para as skins:

- `src/game/itemSprites.ts` — mapeia `template.id` → camada do sprite e monta a
  lista ordenada (capa → corpo → armadura → capacete → escudo → espada).
- `src/components/WarriorSprite.tsx` — empilha os PNGs (mesmo canvas 1632×2176)
  como `<img>` dentro de um contêiner 3:4, sem reposicionamento.
- `src/components/panels/InventoryPanel.tsx` — atualmente usa a imagem estática
  da classe ao centro e emoji para os itens (sem sprites por item).
- `data/itemTemplates.json` — itens podem conter o campo `sheet` (URL), mas ele
  não é mais exibido na UI.

O script `scripts/compor_guerreiro.py` continua sendo usado apenas como
ferramenta offline para (re)gerar os PNGs e o `manifesto.json`.
script de novo.

## Regenerar

Edite a lista `COMBOS` em `scripts/compor_guerreiro.py` e rode:

```bash
python scripts/compor_guerreiro.py
python scripts/validar_guerreiro.py
```