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
        a: "Cavaleiro e Paladino são ótimos para iniciantes — têm alta defesa e HP. Berserker e Samurai são mais ofensivos mas morrem fácil. Mago e Invocador são DPS puro mas frágeis. Escolha o estilo que mais gosta!",
      },
      {
        q: "Como faço para subir de nível?",
        a: "Complete missões (📜), lute contra monstros nas regiões (🗺️), enfrente a Torre (🗼), derrote bosses e use o modo AFK (💤) que ganha XP enquanto dorme!",
      },
      {
        q: "O que é o modo AFK?",
        a: "O modo AFK (Away From Keyboard) faz seu personagem lutar automaticamente contra monstros da região atual. Você ganha XP, ouro e itens mesmo offline! A energia regenera 1 a cada 5 minutos.",
      },
      {
        q: "Como funciona a energia?",
        a: "Energia é usada para iniciar batalhas em regiões e masmorras. Regenera 1 ponto a cada 5 minutos. Você pode ter energia infinita quando o admin ativa este modo!",
      },
    ],
  },
  {
    id: "gold",
    icon: "💰",
    title: "Onde Conseguir Ouro",
    questions: [
      {
        q: "Quais são todas as formas de ganhar ouro?",
        a: "• Torre: 65-25.000+ por batalha (escala com andar)\n• Farm de Região: 33-825+ por batalha\n• Mini-Boss: 97-3.810+ (cooldown 30 min)\n• Boss Regional: 124-2.600+ (1x por dia)\n• Missões: 15-300 fixas + 10-605 geradas\n• Login Diário: 800-8.000 por dia (ciclo 7 dias)\n• Eventos Aleatórios: 1.500 (baú) / 2.500 (apostar)\n• Conquistas: 500-60.000 (one-time)\n• Guild Wars: 900-3.900 por batalha\n• Boss Mundial: recompensa compartilhada",
      },
      {
        q: "Qual a melhor forma de farmar ouro?",
        a: "A Torre é a melhor fonte progressiva! No andar 100 você ganha ~2.540 por mob comum e ~3.650 por chefe. Quanto mais alto o andar, mais ouro ganha!",
      },
      {
        q: "Quanto dá por andar na torre?",
        a: "Fórmula: Mob comum = 40 + (andar × 25) ouro | Chefe = 150 + (andar × 35) ouro. Andar 100 = ~2.540 comum / ~3.650 chefe. Andar 500 = ~12.540 comum / ~17.650 chefe.",
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
        a: "• Drops de monstros e bosses\n• Missões e conquistas\n• Loja Fantasma (moedas da torre)\n• Códigos promocionais do admin\n• Loot de masmorras\n• Eventos especiais",
      },
      {
        q: "O que significam as raridades?",
        a: "Comum (cinza) < Incomum (verde) < Raro (azul) < Épico (roxo) < Lendário (dourado) < Mítico (vermelho) < Divino (cristal). Itens mais raros têm stats muito melhores!",
      },
      {
        q: "Como funcional o sistema de encantamento?",
        a: "Itens podem ser encantados na Forja com cristais e ouro. Encantamentos adicionam bônus de stats. Encantamentos de Chefe (🔥) são ainda mais poderosos!",
      },
      {
        q: "O que são Relíquias?",
        a: "Relíquias são itens especiais que ficam no slot de relíquia e dão bônus passivos permanentes (ATK, DEF, HP, etc.). Dropam de mini-bosses com 10% de chance!",
      },
      {
        q: "O que são Pets?",
        a: "Pets são companheiros que dão bônus passivos. Podem ser obtidos de ovos dropados por mini-bosses (8% de chance) ou pela loja. Cada pet tem habilidades únicas!",
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
        a: "A Torre tem andares infinitos. Cada andar tem 10 mobs + 1 chefe. Quanto mais alto, mais difícil e mais recompensa! Você pode lutar manualmente ou usar Auto Battle.",
      },
      {
        q: "O que são Moedas da Torre?",
        a: "Moedas da Torre (🗼) são ganhas a cada andar e usadas para comprar itens na Loja Fantasma e em missões semanais!",
      },
      {
        q: "Posso resetar a torre?",
        a: "O admin pode resetar a torre geral (todos voltam ao andar 1). Suas moedas da torre NÃO são perdidas no reset!",
      },
      {
        q: "Como funciona o Auto Battle?",
        a: "O Auto Battle luta automaticamente. Escolha entre Agressivo (mais dano, menos defesa), Equilibrado ou Defensivo (menos dano, mais defesa). Ative auto-skill para usar habilidades!",
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
        a: "Vá na aba de Masmorras, escolha a dificuldade (Normal, Difícil, Épica, Lendária) e pague o custo de energia. Cada dificuldade tem monstros mais fortes e recompensas melhores!",
      },
      {
        q: "Quais as recompensas das masmorras?",
        a: "XP, ouro e itens de raridade variada. Masmorras mais difíceis dropsam itens de raridade maior! Também pode dropar cristais e relíquias.",
      },
      {
        q: "Quantas vezes posso jogar a masmorra?",
        a: "Depende da energia! Cada tentativa custa energia. Com energia infinita (quando ativa pelo admin), pode jogar ilimitado!",
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
        a: "Na Arena PvP você luta contra outros jogadores em tempo real! Ganhe patentes e recompensas ao subir no ranking!",
      },
      {
        q: "O que são as patentes PvP?",
        a: "Bronze → Prata → Ouro → Platina → Diamante → Mestre. Suba de patente ao vencer batalhas! Cada patente dá recompensas especiais.",
      },
      {
        q: "Quais recompensas PvP?",
        a: "Moedas PvP (pvpCoins) para gastar na loja PvP, XP e recompensas de patente ao subir de nível!",
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
        a: "Vá na aba Guildas e clique em Criar (custa ouro) ou Entre para uma guilda existente!",
      },
      {
        q: "O que faço numa guilda?",
        a: "Complete guild quests, participe de Guild Wars, lute contra Guild Bosses, suba de nível na guilda e interaja no chat!",
      },
      {
        q: "O que são Guild Wars?",
        a: "Batalhas entre guildas por pontos e recompensas. Participantes ganham ouro e XP proporcional ao dano causado!",
      },
    ],
  },
  {
    id: "bosses",
    icon: "👹",
    title: "Bosses",
    questions: [
      {
        q: "O que é o Boss Regional?",
        a: "Um boss forte em cada região! Pode lutar 1x por dia. Derrotar dá recompensas generosas incluindo ouro, XP, itens e relíquias!",
      },
      {
        q: "O que é o Mini-Boss?",
        a: "Boss mais fraco que o Regional com cooldown de 30 minutos. Drops relíquias (10%), pets (8%) e muito ouro!",
      },
      {
        q: "O que é o Boss Mundial?",
        a: "Evento global onde TODOS os jogadores juntos lutam contra um boss com HP gigante! Forme squads, ataque juntos e ganhe recompensas proporcionais ao seu dano!",
      },
      {
        q: "O que é a Loja Fantasma?",
        a: "Loja temporária que abre em horários específicos! Compre itens raros com moedas da torre. A loja fica aberta por um tempo limitado!",
      },
    ],
  },
  {
    id: "progression",
    icon: "📈",
    title: "Progressão",
    questions: [
      {
        q: "O que é Ascensão?",
        a: "Quando atinge o nível máximo, pode ascender! A ascensão reseta seu nível mas dá bônus permanentes de stats e desbloqueia conteúdo end-game!",
      },
      {
        q: "O que é Prestígio?",
        a: "O Prestígio é o nível de ascensão. Cada vez que ascende, sobe 1 nível de prestígio. Prestígio alto desbloqueia recompensas exclusivas!",
      },
      {
        q: "O que é Maestria?",
        a: "A Maestria é um sistema de progressão secundário que dá bônus passivos baseado no tempo jogado e conquistas!",
      },
      {
        q: "O que é Especialização?",
        a: "Ao atingir certos níveis, você pode escolher uma especialização de classe que desbloqueia habilidades e bônus únicos!",
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
        a: "Vá na aba Codes no menu, digite o código e clique em Resgatar! O código pode dar XP, energia, ouro, diamantes, cristais, VIP ou itens!",
      },
      {
        q: "Onde encontro códigos?",
        a: "Códigos são compartilhados pelo admin nas redes sociais, eventos especiais ou como recompensa por participar de eventos do jogo!",
      },
    ],
  },
  {
    id: "misc",
    icon: "❓",
    title: "Diversos",
    questions: [
      {
        q: "O que são Diamantes e Cristais?",
        a: "Diamantes 💎 são premium (comprados com PIX ou ganhos em eventos). Cristais 🔮 são moedas raras ganhas em missões diárias e bosses. Ambos usados para upgrade de itens!",
      },
      {
        q: "O que é o Livro-Razão?",
        a: "Registro permanente de todas as suas compras. Se o jogo for resetado, o admin pode reenviar seus diamantes pelo livro-razão!",
      },
      {
        q: "Como troco de classe?",
        a: "Vá no Dashboard, procure 'Trocar Classe'. Custo: 5.000 + (nível × 100) ouro. Sua classe e stats mudam para a nova classe!",
      },
      {
        q: "Como acesso o FAQ?",
        a: "Sempre disponível em /faq ou pelo menu do jogo!",
      },
    ],
  },
];

export default function FAQPage() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div
      style={{ background: "linear-gradient(135deg, #0a0a12 0%, #1a1a2e 100%)", minHeight: "100vh" }}
      className="p-4 md:p-6"
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center pt-8 pb-4">
          <div className="text-6xl mb-4">📖</div>
          <h1 className="text-3xl md:text-4xl font-black text-white mb-2">FAQ</h1>
          <p className="text-gray-400 text-sm md:text-base">Perguntas Frequentes — Realm of Eternity</p>
          <div className="mt-4 flex justify-center gap-2">
            <a href="/" className="game-btn text-sm">🎮 Voltar ao Jogo</a>
          </div>
        </div>

        {/* Sections */}
        {sections.map((section) => (
          <div key={section.id} className="bg-[#1a1a2e] rounded-2xl border border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="text-2xl">{section.icon}</span>
                {section.title}
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
