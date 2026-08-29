"use client";

import { useState } from "react";

const sections = [
  {
    id: "basics",
    icon: "🎮",
    title: "Como Jogar",
    questions: [
      {
        q: "Como começo o jogo?",
        a: "Crie uma conta, escolha uma classe e um nome para seu personagem. Você começa na Vila Iniciante com tutorial. Siga as missões da vila para ganhar seus primeiros recursos e subir de nível!",
      },
      {
        q: "Qual a melhor classe para iniciantes?",
        a: "🛡️ Cavaleiro e Paladino são ótimos para iniciantes — têm alta defesa e HP. 🪓 Berserker e ⛩️ Samurai são mais ofensivos mas morrem fácil. 🔮 Mago e ✨ Invocador são DPS puro mas frágeis. Escolha o estilo que mais gosta!",
      },
      {
        q: "Como faço para subir de nível?",
        a: "• Complete missões (📜) — melhor forma no início\n• Lute contra monstros nas regiões (🗺️)\n• Enfrente a Torre (🗼) — melhor para farm\n• Derrote bosses — recompensas maiores\n• Use o modo AFK (💤) — ganha XP offline",
      },
      {
        q: "O que é o modo AFK?",
        a: "O modo AFK (Away From Keyboard) faz seu personagem lutar automaticamente contra monstros da região atual. Você ganha XP, ouro e itens mesmo offline!\n\n📐 Fórmula: ~150 ouro/hora + ~100 XP/hora (escala com level)\n⏱️ Máximo recomendado: 8 horas",
      },
      {
        q: "Como funciona a energia?",
        a: "⚡ Energia é usada para iniciar batalhas em regiões e masmorras.\n🔄 Regenera 1 ponto a cada 5 minutos\n📊 Custo por atividade:\n• Farm de Região: 5 energia\n• Masmorra: 15 energia\n• Mini-Boss: 10 energia\n• Boss Regional: 20 energia\n💡 Quando o admin ativa, fica infinita!",
      },
    ],
  },
  {
    id: "gold",
    icon: "💰",
    title: "Onde Conseguir Ouro",
    questions: [
      {
        q: "Todas as formas de ganhar ouro:",
        a: "🗼 Torre Infinita (melhor fonte!):\n• Mob comum: 40 + (andar × 25)\n• Boss (cada 10 andares): 150 + (andar × 35)\n• Andar 100 = ~2.540 comum / ~3.650 boss\n\n🕳️ Masmorras:\n• Expedição 2h: ~200 ouro\n• Expedição 4h: ~500 ouro\n• Expedição 8h: ~1.100 ouro\n• Boss andar 100: 40.000 ouro\n\n⚔️ Farm de Região:\n• Monstro: ~30-500+ ouro (escala com level)\n• Mini-Boss: ~500-3.800 (cooldown 30min)\n• Boss Regional: ~2.000-2.600 (1x/dia)\n\n📜 Missões:\n• Tier 1: 200 ouro\n• Tier 10: 2.000 ouro\n• Semanal: 10.000 ouro\n\n😴 AFK: ~150 ouro/hora\n🎯 Conquistas: 500-60.000 (one-time)\n🏆 PvP: ~300 por vitória",
      },
      {
        q: "Qual a melhor forma de farmar ouro?",
        a: "A Torre é a melhor fonte progressiva! No andar 100 você ganha ~2.540 por mob comum e ~3.650 por chefe. Quanto mais alto o andar, mais ouro ganha!\n\n💡 Dica: Use o modo Equilibrado no Auto Battle para subir mais rápido!",
      },
      {
        q: "Quanto dá por andar na torre?",
        a: "📐 Fórmulas:\n• Mob comum: 40 + (andar × 25) ouro\n• Boss (cada 10 andares): 150 + (andar × 35) ouro\n• XP comum: xpForLevel(level) × (0.02 + floorBoost × 0.003)\n• XP boss: ×3 do comum\n\n📊 Exemplos:\n• Andar 1: 65 ouro comum / 185 boss\n• Andar 50: 1.290 comum / 1.900 boss\n• Andar 100: 2.540 comum / 3.650 boss\n• Andar 200: 5.040 comum / 7.150 boss",
      },
    ],
  },
  {
    id: "equipment",
    icon: "⚔️",
    title: "Equipamentos & Itens",
    questions: [
      {
        q: "Como consigo equipamentos?",
        a: "📦 Fontes de equipamentos:\n• Drops de monstros e bosses (rng)\n• Missões e conquistas (recompensa fixa)\n• Loja Fantasma (moedas da torre)\n• Códigos promocionais do admin\n• Loot de masmorras\n• Eventos especiais\n• Craft (criação com materiais)\n\n💡 Quanto mais difícil o conteúdo, melhor o loot!",
      },
      {
        q: "O que significam as raridades?",
        a: "📊 Escala de raridade (menor → maior):\n🩶 Comum (cinza)\n💚 Incomum (verde)\n💙 Raro (azul)\n💜 Épico (roxo)\n💛 Lendário (dourado)\n❤️ Mítico (vermelho)\n💎 Divino (cristal)\n⭐ Supremo (dourado brilhante)\n\nItens mais raros têm stats MUITO melhores!",
      },
      {
        q: "Como funciona o sistema de encantamento?",
        a: "✨ Encantamentos adicionam bônus em slots específicos:\n\n🔥 Arma: Gumes de Fogo (+5-50 ATK) / Golpe Crítico (+3-20% CRIT) / Roubo de Vida (+2-15% LS)\n🛡️ Armadura: Armadura Gelida (+5-50 DEF)\n👢 Botas: Passos de Vento (+3-25 SPD)\n📖 Capacete: Sabedoria Antiga (+50-500 HP)\n💍 Acessório: Evasão Sombria (+2-16% EVA) / Olho de Águia (+3-20% PRE)\n\nCada encantamento tem 5 níveis. Níveis 3+ têm chance de falhar!",
      },
      {
        q: "O que são Relíquias?",
        a: "🏛️ Relíquias são itens especiais equipados no slot de relíquia.\n📊 Dão bônus passivos permanentes:\n• ATK, DEF, HP, SPD, CRIT, EVA, etc.\n\n📥 Como obter:\n• Drop de mini-bosses: 10% de chance\n• Loja de eventos\n• Conquistas especiais",
      },
      {
        q: "O que são Pets?",
        a: "🐾 Pets são companheiros que dão bônus passivos!\n\n📥 Como obter:\n• Ovos dropados por mini-bosses: 8% de chance\n• Loja de pets\n• Eventos especiais\n\n⚡ Cada pet tem habilidades únicas:\n• Golpe de Fogo, Escudo de Gelo, Cura, etc.\n• Habilidades evoluem com nível do pet",
      },
      {
        q: "O que é o sistema de Skins?",
        a: "🎨 Skins são cosméticos visuais pagos apenas com diamantes!\n\n💰 Preços:\n• Épico: 5 diamantes\n• Lendário: 10 diamantes\n• Mítico: 25 diamantes\n• Desconto -20% para sua classe!\n\n📝 Skins são apenas visuais, não afetam stats!",
      },
    ],
  },
  {
    id: "tower",
    icon: "🗼",
    title: "Torre Infinita",
    questions: [
      {
        q: "Como funciona a Torre?",
        a: "🗼 A Torre tem andares infinitos com progressão suave!\n\n⚔️ Estrutura por andar:\n• 10 monstros + 1 boss (a cada 10 andares)\n• Dificuldade cresce gradualmente\n\n📊 Stats do monstro (Floor F):\n• HP: 20 + F×12 + F²×0.02\n• ATK: 4 + F×1.8 + F²×0.012\n• DEF: 1 + F×1.1 + F²×0.008\n\n⚡ Custo: 5 energia por batalha\n🎯 Sem limite de tentativas!",
      },
      {
        q: "O que são Moedas da Torre?",
        a: "🗼 Moedas da Torre são ganhas a cada andar!\n\n💰 Ganho por andar:\n• Mob comum: 6 + (andar/10)\n• Boss: 40 + (andar/8)\n\n🛍️ Onde gastar:\n• Loja Fantasma (itens raros)\n• Missões semanais\n• Upgrades especiais",
      },
      {
        q: "Como funciona o Auto Battle?",
        a: "🤖 Modos de Auto Battle:\n\n⚔️ AGRESSIVO:\n• +15% ATK, -10% DEF\n• Para quando tem muito mais poder\n\n⚖️ EQUILIBRADO:\n• Sem modificador\n• ParaProgressão constante\n\n🛡️ DEFENSIVO:\n• -10% ATK, +15% DEF\n• Para subir andares mais altos\n\n💡 Dica: Use DEFENSIVO quando estiver travado!",
      },
      {
        q: "Posso resetar a torre?",
        a: "🔄 O admin pode resetar a torre geral.\n\n⚠️ Efeitos do reset:\n• Todos voltam ao andar 1\n• Moedas da torre NÃO são perdidas\n• Ranking é resetado\n\n💡 Suas moedas continuam para gastar na Loja!",
      },
    ],
  },
  {
    id: "dungeon",
    icon: "🕳️",
    title: "Masmorras",
    questions: [
      {
        q: "Como entro em uma masmorra?",
        a: "🚪 Vá na aba Masmorras e escolha a expedição!\n\n⏱️ Opções de tempo:\n• 2 horas: 15 energia\n• 4 horas: 15 energia (recomendado)\n• 8 horas: 15 energia (melhor valor)\n\n🏆 Bosses nomeados a cada 10 andares!\n📊 Limite: 8 masmorras/dia",
      },
      {
        q: "Bosses das Masmorras:",
        a: "👹 15 Bosses nomeados:\n\n🏰 Andar 10: Goblin Rei (500g + 3💎)\n🕷️ Andar 20: Aranha Gigante (1.000g + 5💎)\n💀 Andar 30: Esqueleto Ancestral (2.000g + 8💎)\n👹 Andar 40: Ogro de Guerra (3.500g + 12💎)\n🐉 Andar 50: Draconide Sombrio (5.000g + 18💎)\n👻 Andar 60: Lich Supremo (8.000g + 25💎)\n🐍 Andar 70: Hidra de 7 Cabeças (12.000g + 35💎)\n🗿 Andar 80: Golem de Obsidiana (18.000g + 45💎)\n🦇 Andar 90: Vampiro Ancião (25.000g + 55💎)\n😈 Andar 100: Rei Demônio (40.000g + 80💎)\n🔥 Andar 110: Fênix do Caos (55.000g + 100💎)\n😇 Andar 120: Anjo Caído (70.000g + 120💎)\n🦎 Andar 130: Basilisco Primordial (90.000g + 150💎)\n💀 Andar 140: Ceifador Dimensional (120.000g + 200💎)\n🌌 Andar 150: O Vazio Absoluto (200.000g + 300💎)",
      },
      {
        q: "Recompensas das expedições:",
        a: "📊 Recompensas por tempo:\n• 2h: ~200 ouro + ~150 XP\n• 4h: ~500 ouro + ~400 XP + 1 cristal\n• 8h: ~1.100 ouro + ~900 XP + 2 cristais\n\n💡 4h ≈ 2.5× a 2h\n💡 8h ≈ 5.5× a 2h\n\n🏆 Bosses dropam ouro extra + cristais!",
      },
    ],
  },
  {
    id: "pvp",
    icon: "⚔️",
    title: "PvP Arena",
    questions: [
      {
        q: "Como funciona o PvP?",
        a: "⚔️ Arena PvP em tempo real!\n\n🎮 Mecânica:\n• Luta contra outro jogador online\n• Sistema de rating (ELO)\n• Limite: 3 batalhas/dia\n\n🏆 Patentes:\n• 🥉 Bronze: 0-599\n• 🥈 Prata: 600-1199\n• 🥇 Ouro: 1200-1799\n• 💎 Platina: 1800-2399\n• 👑 Diamante: 2400+",
      },
      {
        q: "Recompensas PvP:",
        a: "🏆 Por vitória:\n• ~300 ouro\n• ~200 XP\n• +rating (sobe patente)\n\n🎯 Patentes desbloqueiam:\n• Itens exclusivos\n• Cosméticos especiais\n• Títulos únicos\n\n💰 Moedas PvP: usadas na loja PvP para itens exclusivos!",
      },
    ],
  },
  {
    id: "guild",
    icon: "🏰",
    title: "Guildas",
    questions: [
      {
        q: "Como crio ou entro em uma guilda?",
        a: "🏰 Vá na aba Guildas:\n\n➕ Criar Guilda:\n• Custo: ouro (escala)\n• Escolha nome e tag\n• Você vira o líder!\n\n📥 Entrar em Guilda:\n• Procure guildas abertas\n• Envie pedido de entrada\n• Aguarde aprovação do líder",
      },
      {
        q: "O que faço numa guilda?",
        a: "⚔️ Atividades de guilda:\n\n📋 Guild Quests: missões da guilda\n⚔️ Guild Wars: batalhas entre guildas\n👹 Guild Boss: boss da guilda\n📊 Nível da guilda: sobe com XP da guilda\n💬 Chat da guilda: interaja com membros\n🛡️ Buffs da guilda: bônus passivos para todos",
      },
      {
        q: "Guild Wars - Como funciona?",
        a: "⚔️ Batalhas entre guildas por pontos!\n\n🎮 Mecânica:\n• Sua guilda vs outra guilda\n• Dano causado = pontos\n• Recompensas proporcionais ao dano\n\n💰 Recompensas:\n• 900-3.900 ouro por batalha\n• XP para a guilda\n• Reputação",
      },
    ],
  },
  {
    id: "missions",
    icon: "📜",
    title: "Missões",
    questions: [
      {
        q: "Tipos de missões:",
        a: "📜 3 tipos de missões:\n\n📅 DIÁRIAS:\n• Resetam todo dia\n• 10 missões por dia\n• Recompensas: ouro, XP, cristais\n\n📅 SEMANAIS:\n• Resetam toda semana\n• 5 missões por semana\n• Recompensas maiores\n\n🏆 CONQUISTAS:\n• One-time (só completa uma vez)\n• 55 conquistas em 7 categorias\n• Recompensas exclusivas",
      },
      {
        q: "Tier das missões:",
        a: "📊 Tier escala com level do jogador:\n\n• Tier 1 (Lv.1-10): 200g + 150 XP\n• Tier 5 (Lv.11-25): 800g + 600 XP + 1 cristal\n• Tier 10 (Lv.26-50): 2.000g + 1.500 XP + 3 cristais\n• Tier 20 (Lv.51-100): 5.000g + 4.000 XP + 8 cristais\n• Semanal: 10.000g + 8.000 XP + 15 cristais",
      },
    ],
  },
  {
    id: "progression",
    icon: "📈",
    title: "Progressão",
    questions: [
      {
        q: "Curva de XP por nível:",
        a: "📈 Fórmula: xpForLevel(level) = 120 × 1.16^(level-1)\n\n📊 Exemplos:\n• Level 1: 120 XP\n• Level 10: 520 XP\n• Level 25: 2.500 XP\n• Level 50: 11.700 XP\n• Level 100: 53.000 XP\n• Level 150: 135.000 XP\n\n💡 ~3-4 missões do seu tier = 1 nível!",
      },
      {
        q: "O que é Ascensão?",
        a: "🌌 Quando atinge o nível máximo, pode ascender!\n\n🔄 O que acontece:\n• Nível reseta para 1\n• Ganha bônus permanentes\n• Desbloqueia conteúdo end-game\n\n💰 Custo da ascensão:\n• Gold: escala com patamar\n• Cristais: escala com patamar\n\n📊 Bônus por ascensão:\n• +ATK%, +HP%, +Speed\n• +XP%, +Gold%",
      },
      {
        q: "O que é Maestria da Classe?",
        a: "👑 Maestria é desbloqueada ao maxar TODAS as habilidades da classe!\n\n🎁 Recompensas:\n• Bônus passivo permanente\n• Título exclusivo da classe\n\n📊 13 classes com maestria:\n• ⚔️ Guerreiro: +15% ATK, -10% dano recebido\n• 🛡️ Paladino: +10% DEF, +10% HP\n• 🪓 Berserker: +20% ATK, -15% DEF\n• 🔮 Mago: +25% ATK mágico\n• Etc.",
      },
      {
        q: "O que é Especialização?",
        a: "⭐ Ao atingir níveis específicos, desbloqueia especialização!\n\n🎮 Escolha entre 2 caminhos:\n• Caminho A: foco em dano\n• Caminho B: foco em defesa\n\n📊 Cada especialização tem:\n• Habilidades exclusivas\n• Bônus únicos\n• Playstyle diferente",
      },
    ],
  },
  {
    id: "events",
    icon: "📅",
    title: "Eventos",
    questions: [
      {
        q: "Eventos Diários:",
        a: "📅 7 eventos fixos por dia da semana:\n\n☀️ Domingo: Dia de Descanso (20K gold + 10K XP AFK)\n🐉 Segunda: Invasão de Monstros (5K gold + 5 cristais)\n🏰 Terça: Masmorra Especial (8K gold + 10 cristais)\n⚔️ Quarta: Torneio PvP (10K gold + 50 PvP coins)\n🎪 Quinta: Mercador Viajante (3K gold + 5 diamantes)\n🗺️ Sexta: Caça ao Tesouro (12K gold + 15 cristais)\n👹 Sábado: Boss Mundial Reforçado (15K gold + 20 cristais)",
      },
      {
        q: "Exploração do Mundo:",
        a: "🗺️ 20 explorações por dia!\n\n📦 Eventos possíveis:\n• Baú Escondido: 500g + 3 cristais\n• Baú Dourado: 2.000g + 10 cristais + 1💎\n• Mercador Viajante: 800g\n• Monstro Raro: 1.200g + 8 cristais\n• Monstro Elite: 3.000g + 20 cristais + 2💎\n• Bênção Ancestral: 1.000 XP\n• Santuário Antigo: 15 cristais + 500 XP\n• ⚠️ Armadilha: -5% ouro\n\n⚡ Custo: 3 energia por exploração",
      },
    ],
  },
  {
    id: "collection",
    icon: "🎒",
    title: "Coleção & Bestiário",
    questions: [
      {
        q: "O que é o Bestiário?",
        a: "📚 Bestiário registra todos os monstros derrotados!\n\n🎯 Objetivo: derrotar todos os monstros\n\n📊 Categorias:\n• 🏘️ Vila Iniciante\n• 🌲 Floresta Sombria\n• 🏛️ Ruinas Anciãs\n• ⛏️ Minas Abandonadas\n• Etc. (12 regiões)\n\n🎁 Recompensas por completar:\n• Títulos exclusivos\n• Bônus permanentes\n• Itens especiais",
      },
      {
        q: "Como funciona a Coleção?",
        a: "🎒 Coleção registra todos os itens obtidos!\n\n📊 Categorias:\n• ⚔️ Armas\n• 🛡️ Armaduras\n• 💍 Acessórios\n• 🏛️ Relíquias\n• 🐾 Pets\n• 🎨 Skins\n\n🎯 Objetivo: completar todas as categorias\n🎁 Bônus por completar categorias!",
      },
    ],
  },
  {
    id: "codes",
    icon: "🎟️",
    title: "Códigos",
    questions: [
      {
        q: "Como resgato um código?",
        a: "🎟️ Vá na aba Codes no menu!\n\n📝 Passos:\n1. Clique em Codes\n2. Digite o código\n3. Clique em Resgatar\n\n🎁 Tipos de recompensa:\n• XP e Energia\n• Ouro e Diamantes\n• Cristais\n• VIP temporário\n• Itens especiais",
      },
      {
        q: "Onde encontro códigos?",
        a: "📢 Códigos são compartilhados:\n\n• Pelo admin nas redes sociais\n• Em eventos especiais\n• Como recompensa por participar\n• Em colaborações\n• Em datas comemorativas\n\n💡 Siga as redes sociais do jogo!",
      },
    ],
  },
  {
    id: "economy",
    icon: "💎",
    title: "Moedas & Economia",
    questions: [
      {
        q: "Todas as moedas do jogo:",
        a: "💰 Moedas do jogo:\n\n💰 OURO: moeda principal\n• Ganho em todas as atividades\n• Usado para compras e upgrades\n\n💎 DIAMANTES: moeda premium\n• Comprados com PIX ou ganhos em eventos\n• Usados para skins e itens especiais\n\n🔮 CRISTAIS: moeda rara\n• Ganho em missões e bosses\n• Usado para encantamentos\n\n🗼 MOEDAS DA TORRE:\n• Ganho na torre\n• Usado na Loja Fantasma\n\n⚔️ MOEDAS PVP:\n• Ganho no PvP\n• Usado na loja PvP\n\n🏆 PONTOS DE GUILDA:\n• Ganho em guild quests\n• Usado na loja da guilda",
      },
      {
        q: "O que é o Livro-Razão?",
        a: "📒 Registro permanente de todas as suas compras!\n\n🛡️ Proteção:\n• Se o jogo for resetado\n• O admin pode reenviar seus diamantes\n• Pelo livro-razão\n\n📝 Todas as compras PIX ficam registradas!",
      },
    ],
  },
  {
    id: "admin",
    icon: "⚙️",
    title: "Painel Admin",
    questions: [
      {
        q: "Funcionalidades do Admin:",
        a: "⚙️ O admin pode:\n\n📊 Dashboard: visão geral do jogo\n👤 Gerenciar usuários e personagens\n🏰 Gerenciar guildas\n📦 Enviar itens para jogadores\n📢 Enviar mensagens globais\n⚙️ Ajustar limites e balance\n🎟️ Criar códigos promocionais\n📜 Ver logs do jogo\n💎 Gerenciar compras PIX\n👻 Loja Fantasma\n🌍 Evento Global\n🧪 Modo Teste",
      },
      {
        q: "Resetar o jogo:",
        a: "⚠️ ATENÇÃO: Reset é irreversível!\n\n🔄 O que é resetado:\n• Todas as contas\n• Todos os personagens\n• Todas as guildas\n• Inventário e equipamentos\n• Correio e códigos usados\n\n✅ O que é mantido:\n• Catálogo de itens\n• Catálogo de missões\n• Configurações do jogo",
      },
    ],
  },
  {
    id: "misc",
    icon: "❓",
    title: "Diversos",
    questions: [
      {
        q: "Como troco de classe?",
        a: "🔄 Vá no Dashboard → Trocar Classe\n\n💰 Custo: 5.000 + (nível × 100) ouro\n\n⚠️ O que muda:\n• Classe e stats mudam\n• Habilidades mudam\n• Equipamentos NÃO mudam\n• Nível e XP continuam iguais",
      },
      {
        q: "Como funciona o Inventário?",
        a: "🎒 Inventário tem slots limitados!\n\n📊 Slots:\n• Início: 20 slots\n• Expansível com ouro/diamantes\n• VIP aumenta slots\n\n📦 Organização:\n• Itens equipados\n• Itens na mochila\n• Relíquias\n• Materiais",
      },
      {
        q: "Dicas para iniciantes:",
        a: "💡 Dicas:\n\n1. 📜 Comece pelas missões - melhor XP no início\n2. 🗼 Suba na torre - melhor ouro progressivo\n3. 🛡️ Evite PvP no início - foque em level\n4. 💎 Guarde diamantes - compre coisas importantes\n5. 🏰 Entre numa guilda - bônus e ajuda\n6. 📖 Leia o FAQ - entenda o jogo\n7. 🎯 Complete conquistas - recompensas extras\n8. 😴 Use AFK - ganhe XP offline\n9. 🎪 Participe de eventos - recompensas raras\n10. 🔄 Reset não perca moedas da torre!",
      },
      {
        q: "Como acesso o FAQ?",
        a: "📖 Sempre disponível em:\n• /faq (direto pela URL)\n• Menu do jogo\n• Link no rodapé",
      },
    ],
  },
];

export default function FAQPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = sections.map((s) => ({
    ...s,
    questions: s.questions.filter(
      (q) =>
        q.q.toLowerCase().includes(search.toLowerCase()) ||
        q.a.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((s) => s.questions.length > 0);

  return (
    <div
      style={{ background: "linear-gradient(135deg, #0a0a12 0%, #1a1a2e 100%)", minHeight: "100vh" }}
      className="p-4 md:p-6"
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center pt-8 pb-4">
          <div className="text-6xl mb-4">📖</div>
          <h1 className="text-3xl md:text-4xl font-black text-white mb-2">
            <span className="bg-gradient-to-r from-[#ffd700] via-white to-[#a855f7] bg-clip-text text-transparent">
              FAQ — Realm of Eternity
            </span>
          </h1>
          <p className="text-gray-400 text-sm md:text-base">Perguntas Frequentes — Tudo sobre o jogo</p>

          {/* Busca */}
          <div className="mt-6 max-w-md mx-auto">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Buscar no FAQ..."
              className="w-full bg-[#0a0a12] border border-white/20 rounded-xl px-4 py-3 text-white text-sm focus:border-[#ffd700] focus:outline-none transition"
            />
          </div>

          <div className="mt-4 flex justify-center gap-2">
            <a href="/" className="game-btn text-sm">🎮 Voltar ao Jogo</a>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#1a1a2e] rounded-xl border border-white/10 p-3 text-center">
            <div className="text-2xl font-black text-[#ffd700]">{sections.length}</div>
            <div className="text-[10px] text-gray-500">Categorias</div>
          </div>
          <div className="bg-[#1a1a2e] rounded-xl border border-white/10 p-3 text-center">
            <div className="text-2xl font-black text-[#a855f7]">{sections.reduce((a, s) => a + s.questions.length, 0)}</div>
            <div className="text-[10px] text-gray-500">Perguntas</div>
          </div>
          <div className="bg-[#1a1a2e] rounded-xl border border-white/10 p-3 text-center">
            <div className="text-2xl font-black text-[#22c55e]">100%</div>
            <div className="text-[10px] text-gray-500">Gratuito</div>
          </div>
        </div>

        {/* Sections */}
        {filtered.map((section) => (
          <div key={section.id} className="bg-[#1a1a2e] rounded-2xl border border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="text-2xl">{section.icon}</span>
                {section.title}
                <span className="text-[10px] text-gray-500 ml-auto">{section.questions.length} perguntas</span>
              </h2>
            </div>
            <div className="divide-y divide-white/5">
              {section.questions.map((qa, idx) => {
                const qid = `${section.id}-${idx}`;
                const isOpen = openId === qid;
                return (
                  <div key={qid}>
                    <button
                      onClick={() => setOpenId(isOpen ? null : qid)}
                      className="w-full text-left px-5 py-3 flex items-center justify-between gap-3 hover:bg-white/5 transition-colors"
                    >
                      <span className="text-sm font-semibold text-gray-200">{qa.q}</span>
                      <span className={`text-xl transition-transform ${isOpen ? "rotate-45" : ""}`}>+</span>
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4">
                        <p className="text-sm text-gray-400 whitespace-pre-line leading-relaxed bg-black/30 rounded-xl p-4 border border-white/5">
                          {qa.a}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Footer */}
        <div className="text-center py-8 text-gray-600 text-xs">
          <p>Realm of Eternity — MMORPG Idle Online</p>
          <p className="mt-1">Dúvidas? Fale com o admin no jogo!</p>
        </div>
      </div>
    </div>
  );
}
