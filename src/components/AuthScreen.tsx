"use client";
import { useState, useEffect } from "react";
import { useGameStore } from "@/store/gameStore";
import { t } from "@/i18n";

export default function AuthScreen() {
  const [mounted, setMounted] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setUser, setCharacters, setShowCharacterSelect, setMailboxCount, resetSession, locale, setLocale, setVolume } = useGameStore();

  // Restaura a sessão pelo cookie httpOnly (sem cache local). Se houver sessão
  // válida, entra direto; senão, mostra o formulário de login.
  useEffect(() => {
    setMounted(true);
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) return;
        const data = await res.json();
        setUser(data.userId, data.locale);
        const charList = Array.isArray(data.characters) ? data.characters : data.character ? [data.character] : [];
        if (charList.length > 0) {
          setCharacters(charList);
          setShowCharacterSelect(true);
          setMailboxCount(Number(data.mailboxCount) || 0);
        } else {
          resetSession();
        }
      } catch {
        /* sem sessão — mostra o formulário */
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!isLogin) {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok) { 
          setError(data.error || t("general.error", locale)); 
          setLoading(false); 
          return; 
        }
        // Conta nova: começa com o volume baixo (8%) — padrão agradável.
        setVolume(0.08);
      }
      
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) { 
        setError(data.error || t("general.error", locale)); 
        setLoading(false); 
        return; 
      }

      setUser(data.userId, data.locale);
      // Autenticação: com múltiplos personagens por conta, mostra a tela de
      // seleção para o jogador escolher com quem entrar (ou criar outro).
      // Contas sem personagem seguem direto para a criação.
      const charList = Array.isArray(data.characters) ? data.characters : data.character ? [data.character] : [];
      if (charList.length > 0) {
        setCharacters(charList);
        // Mostra a tela de seleção para o jogador escolher com quem entrar.
        setShowCharacterSelect(true);
        setMailboxCount(Number(data.mailboxCount) || 0);
      } else {
        resetSession();
      }

      await fetch("/api/seed", { method: "POST" }).catch(() => {});
    } catch (err) {
      console.error("Auth error:", err);
      setError(t("general.error", locale));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#060611]">
      {/* Background Orbs */}
      <div className="absolute top-[10%] left-[10%] w-[400px] h-[400px] bg-[#e94560] rounded-full blur-[120px] opacity-20 animate-pulse" />
      <div className="absolute top-[40%] right-[10%] w-[300px] h-[300px] bg-[#00d4aa] rounded-full blur-[100px] opacity-20 animate-pulse" style={{ animationDelay: '2s' }} />
      <div className="absolute bottom-[10%] left-[30%] w-[350px] h-[350px] bg-[#7c5cfc] rounded-full blur-[110px] opacity-20 animate-pulse" style={{ animationDelay: '4s' }} />

      {/* Floating Particles */}
      <div className="absolute inset-0 pointer-events-none">
        {mounted && [...Array(25)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/10"
            style={{
              width: Math.random() * 8 + 2 + 'px',
              height: Math.random() * 8 + 2 + 'px',
              left: Math.random() * 100 + '%',
              top: Math.random() * 100 + '%',
              animation: 'float ' + (Math.random() * 5 + 5) + 's linear infinite',
              animationDelay: Math.random() * 5 + 's'
            }}
          />
        ))}
      </div>

      {/* Vinheta cinematográfica + brasas douradas */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 vignette" />
        {mounted && [...Array(8)].map((_, i) => (
          <div
            key={'ember' + i}
            className="ember"
            style={{
              left: 6 + i * 12 + '%',
              bottom: -10,
              animationDelay: (i * 0.7 + Math.random()) + 's',
              animationDuration: (8 + (Math.random() * 8)) + 's'
            }}
          />
        ))}
      </div>

      {/* Language Selector */}
      <div className="absolute top-4 right-4 flex gap-2 z-20">
        <button onClick={() => setLocale('en')} className="px-3 py-1 bg-black/40 border border-white/10 rounded-lg text-xs hover:bg-white/10 text-white">EN</button>
        <button onClick={() => setLocale('pt-BR')} className="px-3 py-1 bg-black/40 border border-white/10 rounded-lg text-xs hover:bg-white/10 text-white">PT-BR</button>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo and Title */}
        <div className="text-center mb-8 animate-fadeInDown">
          <div className="inline-block relative mb-3 animate-float">
            <span className="text-7xl glow-red-blink">⚔️</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black mb-3 gradient-text tracking-wide">
            {t("app.title", locale)}
          </h1>
          <p className="text-gray-400 italic">{t("app.tagline", locale)}</p>
          <div className="flex justify-center gap-2 mt-4">
            <span className="badge badge-new">MMORPG</span>
            <span className="badge badge-hot">IDLE</span>
          </div>
        </div>

        {/* Auth Form */}
        <div className="game-card card-royal p-8 animate-fadeInUp">
          <h2 className="text-2xl font-bold mb-6 text-center text-white">
            {isLogin ? t("auth.login", locale) : t("auth.register", locale)}
          </h2>

          {error && <div className="animate-shake bg-red-500/20 text-red-300 p-3 rounded-lg mb-4 text-center">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-1.5 text-left">
              <label htmlFor="auth-username" className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {t("auth.username", locale)}
              </label>
              <input
                id="auth-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                className="game-input animate-fadeIn stagger-1"
                placeholder=""
                required
              />
            </div>
            <div className="flex flex-col gap-1.5 text-left">
              <label htmlFor="auth-password" className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {t("auth.password", locale)}
              </label>
              <input
                id="auth-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="game-input game-input-accent animate-fadeIn stagger-2"
                placeholder=""
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="game-btn w-full animate-fadeIn stagger-3"
            >
              {loading ? t("general.loading", locale) : (isLogin ? t("auth.login", locale) : t("auth.createAccount", locale))}
            </button>
          </form>

          <button 
            onClick={() => setIsLogin(!isLogin)} 
            className="w-full mt-4 text-sm text-gray-500 hover:text-white animate-fadeIn stagger-4"
          >
            {isLogin ? t("auth.dontHave", locale) : t("auth.alreadyHave", locale)}
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-600 animate-fadeIn stagger-5">
          <p className="text-xs">v1.0.0 | © 2026 {t("app.title", locale)}</p>
          <div className="flex justify-center gap-4 mt-2">
            <span>🎮</span><span>⚔️</span><span>🏰</span>
          </div>
        </div>
      </div>
    </div>
  );
}