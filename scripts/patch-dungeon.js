const fs = require('fs');
let c = fs.readFileSync('src/components/panels/DungeonPanel.tsx', 'utf8');

// 1. Add boss imports
c = c.replace(
  'dungeonCapFloor,',
  'dungeonCapFloor,\n  DUNGEON_BOSSES,\n  getDungeonBoss,'
);

// 2. Add bossPreview and ranking state
c = c.replace(
  'const [result, setResult]',
  'const [bossPreview, setBossPreview] = useState<any>(null);\n  const [ranking, setRanking] = useState<any[]>([]);\n  const [result, setResult]'
);

// 3. Add boss preview and ranking useEffect after refresh effect
c = c.replace(
  'useEffect(() => { (async () => { await refresh(); setLoading(false); })(); }, [refresh]);',
  'useEffect(() => { (async () => { await refresh(); setLoading(false); })(); }, [refresh]);\n\n  useEffect(() => {\n    const boss = getDungeonBoss(attempt);\n    setBossPreview(boss || null);\n  }, [attempt]);\n\n  useEffect(() => {\n    fetch("/api/dungeon/ranking").then(r => r.json()).then(d => setRanking(d.ranking || [])).catch(() => {});\n  }, []);'
);

// 4. Add sections before stats
const lines = [
  '',
  '      {/* Boss Preview */}',
  '      {bossPreview && (',
  '        <div className="game-card p-5 border-[#e94560]/30 bg-gradient-to-r from-[#e94560]/10 to-transparent">',
  '          <div className="flex items-center gap-4">',
  '            <div className="text-5xl">{bossPreview.icon}</div>',
  '            <div>',
  '              <h3 className="text-lg font-black text-[#e94560]">Boss: {bossPreview.name}</h3>',
  '              <p className="text-sm text-gray-400">{bossPreview.description}</p>',
  '              <div className="flex gap-3 mt-2 text-xs flex-wrap">',
  '                <span className="text-[#ffd700]">💰 +{bossPreview.bonusGold.toLocaleString()}</span>',
  '                <span className="text-[#00ff88]">✨ +{bossPreview.bonusXp.toLocaleString()} XP</span>',
  '                <span className="text-[#06b6d4]">💎 +{bossPreview.bonusCrystals}</span>',
  '              </div>',
  '            </div>',
  '          </div>',
  '        </div>',
  '      )}',
  '',
  '      {/* Boss Guide */}',
  '      <div className="game-card p-4">',
  '        <h3 className="font-bold text-sm text-gray-300 mb-3">👹 Bosses da Masmorra</h3>',
  '        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">',
  '          {DUNGEON_BOSSES.map((b) => {',
  '            const bestFloor = Number(((character as any)?.dungeonStats?.bestFloor) ?? 0);',
  '            const beaten = bestFloor >= b.floor;',
  '            return (',
  '              <div key={b.floor} className={"text-center p-2 rounded-lg border " + (beaten ? "border-[#00ff88]/40 bg-[#00ff88]/5" : "border-white/10 bg-white/5")}>',
  '                <div className="text-xl">{b.icon}</div>',
  '                <div className="text-[9px] font-bold text-white truncate">{b.name}</div>',
  '                <div className="text-[8px] text-gray-500">Andar {b.floor}</div>',
  '                {beaten && <div className="text-[8px] text-[#00ff88]">✓ Derrotado</div>}',
  '              </div>',
  '            );',
  '          })}',
  '        </div>',
  '      </div>',
  '',
  '      {/* Ranking */}',
  '      {ranking.length > 0 && (',
  '        <div className="game-card p-4">',
  '          <h3 className="font-bold text-sm text-gray-300 mb-3">🏆 Ranking de Masmorras</h3>',
  '          <div className="space-y-1.5">',
  '            {ranking.slice(0, 10).map((r: any, i: number) => (',
  '              <div key={r.id} className={"flex items-center gap-3 p-2 rounded-lg " + (r.id === characterId ? "bg-[#a855f7]/10 border border-[#a855f7]/30" : "bg-white/5")}>',
  '                <div className="w-6 text-center font-bold text-sm">',
  '                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span className="text-gray-500">{i + 1}</span>}',
  '                </div>',
  '                <div className="flex-1">',
  '                  <div className="text-sm font-medium text-white">{r.name}</div>',
  '                  <div className="text-[10px] text-gray-500">Lv.{r.level} • {r.totalRuns} runs</div>',
  '                </div>',
  '                <div className="text-sm font-bold text-[#a855f7]">🗼 Andar {r.bestFloor}</div>',
  '              </div>',
  '            ))}',
  '          </div>',
  '        </div>',
  '      )}',
  '',
].join('\n');

c = c.replace('{/* Estatísticas + como funciona */}', lines + '      {/* Estatísticas + como funciona */}');

fs.writeFileSync('src/components/panels/DungeonPanel.tsx', c);
console.log('Done');
