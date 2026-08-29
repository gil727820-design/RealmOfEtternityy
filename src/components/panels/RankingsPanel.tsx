"use client";
import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";
import { classImage, type ClassName } from "@/game/constants";

const RANK_TYPES = [
  { id: "power", icon: "⭐", label: "Poder Total", color: "#fbbf24" },
  { id: "level", icon: "📊", label: "Nível", color: "#4ecdc4" },
  { id: "pvp", icon: "⚔️", label: "PvP Rating", color: "#e94560" },
  { id: "tower", icon: "🗼", label: "Torre", color: "#a855f7" },
  { id: "wealth", icon: "💰", label: "Riqueza", color: "#22c55e" },
  { id: "prestige", icon: "👑", label: "Prestígio", color: "#f59e0b" },
  { id: "bestiary", icon: "📚", label: "Bestiário", color: "#06b6d4" },
  { id: "collection", icon: "🎒", label: "Coleção", color: "#8b5cf6" },
  { id: "dungeon", icon: "🕳️", label: "Masmorras", color: "#ef4444" },
  { id: "ascension", icon: "🔮", label: "Ascensão", color: "#ec4899" },
] as const;

const MEDALS = ["🥇", "🥈", "🥉"];
const MEDAL_COLORS = ["from-yellow-400/20 to-amber-500/10", "from-gray-300/20 to-gray-400/10", "from-orange-400/20 to-orange-500/10"];

export default function RankingsPanel() {
  const { locale, characterId } = useGameStore();
  const [type, setType] = useState<string>("power");
  const [rankings, setRankings] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Array<Record<string, unknown>>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/game?action=rankings&type=${type}`);
      const data = await res.json();
      setRankings(data.rankings ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [type]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = useCallback(async (q: string) => {
    setSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const res = await fetch(`/api/game?action=rankings&type=power&search=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults(data.rankings ?? []);
    } catch { setSearchResults([]); }
  }, []);

  const getScore = (r: Record<string, unknown>) => {
    switch (type) {
      case "level": return `Lv.${String(r.level ?? 0)}`;
      case "pvp": return `⚔️ ${String(r.pvpRating ?? 0)}`;
      case "tower": return `🗼 Andar ${String(r.towerFloor ?? 0)}`;
      case "wealth": return `💰 ${Number(r.gold ?? 0).toLocaleString()}`;
      case "prestige": return `👑 ${String(r.prestige ?? 0)}`;
      case "bestiary": return `📚 ${String(r.bestiaryCount ?? 0)} entries`;
      case "collection": return `🎒 ${String(r.collectionCount ?? 0)} items`;
      case "dungeon": return `🕳️ ${String(r.dungeonCleared ?? 0)} clears`;
      case "ascension": return `🔮 ${String(r.ascensionCount ?? 0)}x`;
      default: return `⭐ ${Number(r.power ?? 0).toLocaleString()}`;
    }
  };

  const getMyPosition = () => {
    const idx = rankings.findIndex((r) => r.id === characterId);
    return idx >= 0 ? idx + 1 : null;
  };

  const filteredRankings = search
    ? rankings.filter((r) => {
        const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return norm(String(r.name ?? "")).includes(norm(search));
      })
    : rankings;

  const displayRankings = search ? filteredRankings : rankings;
  const myPos = getMyPosition();

  // Stats summary
  const totalPower = rankings.reduce((sum, r) => sum + Number(r.power ?? 0), 0);
  const avgLevel = rankings.length ? Math.round(rankings.reduce((sum, r) => sum + Number(r.level ?? 0), 0) / rankings.length) : 0;
  const maxTower = rankings.length ? Math.max(...rankings.map((r) => Number(r.towerFloor ?? 0))) : 0;

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#e94560]/20 via-[#0f3460]/30 to-[#16213e]/40 border border-[#e94560]/30 p-5">
        <div className="absolute inset-0 bg-[url('/images/sidebar/menu_rankings.png')] bg-center bg-no-repeat bg-contain opacity-10" />
        <div className="relative z-10">
          <h2 className="text-2xl font-black flex items-center gap-3">
            <span className="text-4xl">🏆</span>
            <span className="bg-gradient-to-r from-[#fbbf24] to-[#e94560] bg-clip-text text-transparent">
              Ranking Global
            </span>
          </h2>
          <p className="text-gray-400 text-sm mt-1">Compete com todos os jogadores do servidor</p>
        </div>
      </div>

      {/* Stats Summary */}
      {rankings.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="game-card p-3 text-center">
            <div className="text-2xl font-black text-[#fbbf24]">{rankings.length}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider">Jogadores</div>
          </div>
          <div className="game-card p-3 text-center">
            <div className="text-2xl font-black text-[#4ecdc4]">Lv.{avgLevel}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider">Nível Médio</div>
          </div>
          <div className="game-card p-3 text-center">
            <div className="text-2xl font-black text-[#a855f7]">🗼 {maxTower}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider">Torre Máx</div>
          </div>
        </div>
      )}

      {/* My Position */}
      {myPos && (
        <div className="game-card p-4 bg-gradient-to-r from-[#e94560]/10 to-[#0f3460]/10 border-[#e94560]/40">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#e94560] to-[#fbbf24] flex items-center justify-center text-xl font-black text-white">
              #{myPos}
            </div>
            <div>
              <div className="text-xs text-gray-400">Sua posição no ranking</div>
              <div className="text-lg font-bold">
                {myPos <= 3 ? MEDALS[myPos - 1] : ""} #{myPos} de {rankings.length}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
        {RANK_TYPES.map(rt => {
          const active = type === rt.id;
          return (
            <button key={rt.id} onClick={() => setType(rt.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all duration-200 ${
                active
                  ? `border-[${rt.color}]/60 text-white bg-[${rt.color}]/15 shadow-lg shadow-[${rt.color}]/10`
                  : "border-white/5 text-gray-500 hover:text-white hover:border-white/20"
              }`}
              style={active ? { borderColor: rt.color + "60", backgroundColor: rt.color + "15", boxShadow: `0 0 15px ${rt.color}20` } : {}}>
              <span className="text-base">{rt.icon}</span>
              <span>{rt.label}</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="🔍 Buscar jogador..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full game-card px-4 py-3 text-sm text-white placeholder-gray-500 bg-transparent border border-white/10 focus:border-[#e94560]/50 focus:outline-none rounded-xl transition"
        />
        {search && (
          <button onClick={() => { setSearch(""); setSearchResults([]); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
            ✕
          </button>
        )}
      </div>

      {/* Rankings List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="game-card p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/5 rounded" />
                <div className="w-12 h-12 bg-white/5 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/5 rounded w-1/3" />
                  <div className="h-3 bg-white/5 rounded w-1/2" />
                </div>
                <div className="w-20 h-6 bg-white/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : displayRankings.length === 0 ? (
        <div className="game-card p-12 text-center">
          <div className="text-5xl mb-3">🏆</div>
          <div className="text-gray-400 font-medium">{search ? "Nenhum jogador encontrado" : "Nenhum jogador ainda"}</div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {displayRankings.map((r, i) => {
            const isMe = r.id === characterId;
            const isTop3 = i < 3;
            return (
              <div
                key={String(r.id)}
                className={`relative overflow-hidden rounded-xl p-3.5 flex items-center gap-3 transition-all duration-200 hover:scale-[1.01] ${
                  isTop3
                    ? `bg-gradient-to-r ${MEDAL_COLORS[i]} border ${i === 0 ? "border-yellow-400/30" : i === 1 ? "border-gray-300/30" : "border-orange-400/30"} shadow-lg`
                    : isMe
                      ? "bg-gradient-to-r from-[#e94560]/10 to-[#0f3460]/10 border border-[#e94560]/30"
                      : "game-card hover:border-white/20"
                }`}
              >
                {/* Rank Number */}
                <div className="w-10 text-center flex-shrink-0">
                  {isTop3 ? (
                    <span className="text-3xl drop-shadow-lg">{MEDALS[i]}</span>
                  ) : (
                    <span className={`text-lg font-black ${isMe ? "text-[#e94560]" : "text-gray-600"}`}>
                      {i + 1}
                    </span>
                  )}
                </div>

                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <img
                    src={classImage((r.classType as ClassName) ?? "warrior", (r.sex as string) ?? "male")}
                    alt={String(r.name)}
                    className={`w-11 h-11 rounded-xl border-2 object-cover ${
                      isTop3 ? "border-[#fbbf24]/50" : isMe ? "border-[#e94560]/50" : "border-white/10"
                    }`}
                  />
                  {isTop3 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-[#fbbf24] to-[#e94560] rounded-full flex items-center justify-center text-[10px] font-black text-white">
                      {i + 1}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold truncate ${isMe ? "text-[#e94560]" : isTop3 ? "text-white" : "text-gray-200"}`}>
                      {String(r.name)}
                    </span>
                    {isMe && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-[#e94560]/20 border border-[#e94560]/40 rounded-full text-[#e94560] font-bold">
                        VOCÊ
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 flex items-center gap-1.5">
                    <span className="w-4 text-center text-sm">{
                      (r.classType as string) === "warrior" ? "⚔️" :
                      (r.classType as string) === "mage" ? "🔮" :
                      (r.classType as string) === "archer" ? "🏹" :
                      (r.classType as string) === "assassin" ? "🗡️" :
                      (r.classType as string) === "berserker" ? "🪓" :
                      (r.classType as string) === "paladin" ? "🛡️" :
                      (r.classType as string) === "necromancer" ? "💀" :
                      (r.classType as string) === "druid" ? "🌿" :
                      (r.classType as string) === "monk" ? "👊" :
                      (r.classType as string) === "ranger" ? "🌿" :
                      (r.classType as string) === "knight" ? "🏰" :
                      (r.classType as string) === "darkMage" ? "🌑" :
                      "⚔️"
                    }</span>
                    <span>Lv.{String(r.level)}</span>
                    <span className="text-gray-600">•</span>
                    <span>{t(`class.${String(r.classType)}`, locale)}</span>
                  </div>
                </div>

                {/* Score */}
                <div className="text-right flex-shrink-0">
                  <div className={`text-sm font-black ${isTop3 ? "text-[#fbbf24]" : isMe ? "text-[#e94560]" : "text-gray-300"}`}>
                    {getScore(r)}
                  </div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                    {RANK_TYPES.find(rt => rt.id === type)?.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Info */}
      <div className="game-card p-4 text-center">
        <div className="text-xs text-gray-500">
          🏆 Rankings atualizados em tempo real • Top 50 jogadores por categoria
        </div>
      </div>
    </div>
  );
}
