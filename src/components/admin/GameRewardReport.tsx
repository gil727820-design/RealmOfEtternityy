"use client";

/**
 * 📊 Relatório de Recompensas do Jogo
 * Mostra como o jogo calcula recompensas em cada atividade.
 * Para o admin entender o balanceamento do jogo.
 */

const SECTIONS = [
  {
    title: "🗼 Torre Infinita",
    icon: "🗼",
    color: "#a855f7",
    rows: [
      { activity: "Monstro normal (Floor 1)", gold: 65, xp: "~30", crystals: 0, energy: 5, notes: "Gold = 40 + floor×25" },
      { activity: "Monstro normal (Floor 10)", gold: 290, xp: "~60", crystals: 0, energy: 5, notes: "Gold = 40 + 10×25" },
      { activity: "Monstro normal (Floor 50)", gold: 1290, xp: "~200", crystals: 0, energy: 5, notes: "Gold = 40 + 50×25" },
      { activity: "Monstro normal (Floor 100)", gold: 2540, xp: "~500", crystals: 0, energy: 5, notes: "Gold = 40 + 100×25" },
      { activity: "Boss (Floor 10)", gold: 500, xp: "~180", crystals: 0, energy: 5, notes: "Gold = 150 + f×35, XP ×3" },
      { activity: "Boss (Floor 50)", gold: 1900, xp: "~600", crystals: 0, energy: 5, notes: "Boss paga 3× XP" },
      { activity: "Boss (Floor 100)", gold: 3650, xp: "~1500", crystals: 0, energy: 5, notes: "Gold = 150 + 100×35" },
    ],
  },
  {
    title: "🕳️ Masmorras",
    icon: "🕳️",
    color: "#ec4899",
    rows: [
      { activity: "Expedição 2h (Lv.1)", gold: 200, xp: 150, crystals: 0, energy: 15, notes: "Reward escala com level" },
      { activity: "Expedição 4h (Lv.1)", gold: 500, xp: 400, crystals: 1, energy: 15, notes: "4h ≈ 2.5× a 2h" },
      { activity: "Expedição 8h (Lv.1)", gold: 1100, xp: 900, crystals: 2, energy: 15, notes: "8h ≈ 5.5× a 2h" },
      { activity: "Boss andar 10", gold: 500, xp: 500, crystals: 0, energy: 15, notes: "Goblin Rei" },
      { activity: "Boss andar 50", gold: 5000, xp: 5000, crystals: 0, energy: 15, notes: "Draconide Sombrio" },
      { activity: "Boss andar 100", gold: 40000, xp: 40000, crystals: 0, energy: 15, notes: "Rei Demônio" },
      { activity: "Boss andar 150", gold: 200000, xp: 200000, crystals: 0, energy: 15, notes: "O Vazio Absoluto" },
    ],
  },
  {
    title: "⚔️ Farm de Região",
    icon: "⚔️",
    color: "#22c55e",
    rows: [
      { activity: "Monstro Lv.1", gold: 30, xp: 25, crystals: 0, energy: 5, notes: "Recompensa base" },
      { activity: "Monstro Lv.10", gold: 120, xp: 100, crystals: 0, energy: 5, notes: "Escala com level" },
      { activity: "Monstro Lv.25", gold: 350, xp: 280, crystals: 0, energy: 5, notes: "~14 gold/lv" },
      { activity: "Mini Boss", gold: 500, xp: 400, crystals: 2, energy: 10, notes: "2× monstro normal" },
      { activity: "Boss Regional", gold: 2000, xp: 1500, crystals: 5, energy: 20, notes: "10× monstro normal" },
    ],
  },
  {
    title: "📜 Missões Diárias",
    icon: "📜",
    color: "#4ecdc4",
    rows: [
      { activity: "Missão Tier 1", gold: 200, xp: 150, crystals: 0, energy: 5, notes: "Fácil, level 1-10" },
      { activity: "Missão Tier 5", gold: 800, xp: 600, crystals: 1, energy: 10, notes: "Médio, level 11-25" },
      { activity: "Missão Tier 10", gold: 2000, xp: 1500, crystals: 3, energy: 15, notes: "Difícil, level 26-50" },
      { activity: "Missão Tier 20", gold: 5000, xp: 4000, crystals: 8, energy: 20, notes: "Épico, level 51-100" },
      { activity: "Missão Semanal", gold: 10000, xp: 8000, crystals: 15, energy: 30, notes: "Recompensa maior" },
    ],
  },
  {
    title: "😴 AFK (Offline)",
    icon: "😴",
    color: "#6366f1",
    rows: [
      { activity: "1 hora AFK", gold: 150, xp: 100, crystals: 0, energy: 0, notes: "Base: 150g/h + 100xp/h" },
      { activity: "4 horas AFK", gold: 600, xp: 400, crystals: 0, energy: 0, notes: "Máximo recomendado" },
      { activity: "8 horas AFK", gold: 1200, xp: 800, crystals: 0, energy: 0, notes: "Returns com level alto" },
    ],
  },
  {
    title: "⚔️ PvP Arena",
    icon: "⚔️",
    color: "#ef4444",
    rows: [
      { activity: "Vitória PvP", gold: 300, xp: 200, crystals: 0, energy: 0, notes: "3/dia limite" },
      { activity: "Derrota PvP", gold: 50, xp: 50, crystals: 0, energy: 0, notes: "Consolação" },
    ],
  },
  {
    title: "🗼 Torre - XP por Nível",
    icon: "📊",
    color: "#f59e0b",
    rows: [
      { activity: "Level 1", gold: 0, xp: 120, crystals: 0, energy: 0, notes: "xpForLevel(1) = 120" },
      { activity: "Level 10", gold: 0, xp: 520, crystals: 0, energy: 0, notes: "120 × 1.16^9" },
      { activity: "Level 25", gold: 0, xp: 2500, crystals: 0, energy: 0, notes: "~2.5K XP pra upar" },
      { activity: "Level 50", gold: 0, xp: 11700, crystals: 0, energy: 0, notes: "~11.7K XP" },
      { activity: "Level 100", gold: 0, xp: 53000, crystals: 0, energy: 0, notes: "~53K XP pra upar" },
      { activity: "Level 150", gold: 0, xp: 135000, crystals: 0, energy: 0, notes: "~135K XP" },
    ],
  },
  {
    title: "💰 Econômico - Limites Diários",
    icon: "💰",
    color: "#ffd700",
    rows: [
      { activity: "Torre", gold: "∞", xp: "∞", crystals: 0, energy: "5/tentativa", notes: "Sem limite de tentativas" },
      { activity: "Masmorra", gold: "∞", xp: "∞", crystals: "∞", energy: "15/expedição", notes: "8/dia (era 5)" },
      { activity: "Missões", gold: "~5K", xp: "~3K", crystals: "~15", energy: "5-20/missão", notes: "~10 missões/dia" },
      { activity: "Farm Região", gold: "~500", xp: "~400", crystals: 0, energy: "5/fight", notes: "Sem limite" },
      { activity: "PvP", gold: 950, xp: 750, crystals: 0, energy: 0, notes: "3 vitórias/dia" },
      { activity: "AFK", gold: "~1500", xp: "~1000", crystals: 0, energy: 0, notes: "8h = max" },
      { activity: "Exploração", gold: "~3000", xp: "~1000", crystals: "~20", energy: "3/exploração", notes: "20/dia" },
    ],
  },
];

export default function GameRewardReport() {
  return (
    <div className="bg-[#1a1a2e] rounded-2xl border border-[#ffd700]/20 p-5">
      <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg bg-[#ffd700]/20 flex items-center justify-center text-xs">📊</span>
        Relatório de Recompensas do Jogo
      </h3>
      <p className="text-[10px] text-gray-500 mb-4">
        Fórmulas e valores de recompensa de cada atividade. Use para balancear o jogo.
      </p>

      <div className="space-y-4">
        {SECTIONS.map((section) => (
          <div key={section.title} className="bg-[#0a0a12] rounded-xl border border-white/5 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5" style={{ background: `${section.color}10` }}>
              <span className="text-sm">{section.icon}</span>
              <span className="text-xs font-bold text-white">{section.title}</span>
              <span className="text-[9px] text-gray-500 ml-auto">{section.rows.length} atividades</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-gray-500 border-b border-white/5">
                    <th className="text-left px-4 py-2 font-bold">Atividade</th>
                    <th className="text-right px-3 py-2 font-bold text-[#ffd700]">💰 Ouro</th>
                    <th className="text-right px-3 py-2 font-bold text-[#a855f7]">✨ XP</th>
                    <th className="text-right px-3 py-2 font-bold text-[#06b6d4]">🔮 Cristais</th>
                    <th className="text-right px-3 py-2 font-bold text-[#22c55e]">⚡ Energia</th>
                    <th className="text-left px-3 py-2 font-bold">Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row, i) => (
                    <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition">
                      <td className="px-4 py-2 text-gray-300 font-medium">{row.activity}</td>
                      <td className="px-3 py-2 text-right font-bold" style={{ color: "#ffd700" }}>
                        {typeof row.gold === "number" ? row.gold.toLocaleString() : row.gold}
                      </td>
                      <td className="px-3 py-2 text-right font-bold" style={{ color: "#a855f7" }}>
                        {typeof row.xp === "number" ? row.xp.toLocaleString() : row.xp}
                      </td>
                      <td className="px-3 py-2 text-right font-bold" style={{ color: "#06b6d4" }}>
                        {row.crystals}
                      </td>
                      <td className="px-3 py-2 text-right font-bold" style={{ color: "#22c55e" }}>
                        {typeof row.energy === "number" ? row.energy : row.energy}
                      </td>
                      <td className="px-3 py-2 text-gray-500 text-[10px]">{row.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
