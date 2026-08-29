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

  useEffect(() => {
    setMounted(true);
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("realm-of-eternity-storage");
      }
    } catch { /* ignora */ }
    (async () => {
      try {
        const res = await fetch("/api/auth");
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
        const res = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "register", username, password }),
        });
        const data = await res.json();
        if (!res.ok) { 
          setError(data.error || t("general.error", locale)); 
          setLoading(false);
          return; 
        }
        setVolume(0.08);
      }
      
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", username, password }),
      });
      const data = await res.json();
      if (!res.ok) { 
        setError(data.error || t("general.error", locale)); 
        setLoading(false);
        return; 
      }

      setUser(data.userId, data.locale);
      const charList = Array.isArray(data.characters) ? data.characters : data.character ? [data.character] : [];
      if (charList.length > 0) {
        setCharacters(charList);
        setShowCharacterSelect(true);
        setMailboxCount(Number(data.mailboxCount) || 0);
      } else {
        resetSession();
      }

      await fetch("/api/game?action=seed", { method: "POST" }).catch(() => {});
    } catch (err) {
      console.error("Auth error:", err);
      setError(t("general.error", locale));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[100dvh] min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden safe-bottom" style={{ background: '#060a14' }}>
      {/* Background épico */}
      <div className="absolute inset-0 z-0">
        <img
          src="/images/fundo_auth_new.png"
          alt=""
          className="w-full h-full object-cover"
          style={{ opacity: 0.3, filter: 'brightness(0.55) saturate(0.85) sepia(0.25)' }}
          draggable={false}
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #060a14 0%, rgba(6,10,20,0.55) 45%, #060a14 100%)' }} />
        <div className="vignette absolute inset-0" />
        {/* Brasas douradas */}
        <div className="ember" style={{ left: '12%', bottom: '20%', animationDelay: '0s' }} />
        <div className="ember" style={{ left: '22%', bottom: '45%', animationDelay: '2.5s' }} />
        <div className="ember" style={{ left: '35%', bottom: '12%', animationDelay: '5s' }} />
        <div className="ember" style={{ left: '63%', bottom: '38%', animationDelay: '1.5s' }} />
        <div className="ember" style={{ left: '78%', bottom: '18%', animationDelay: '3.5s' }} />
        <div className="ember" style={{ left: '88%', bottom: '55%', animationDelay: '6s' }} />
        <div className="ember" style={{ left: '48%', bottom: '28%', animationDelay: '4.2s' }} />
      </div>

      {/* Idioma */}
      <div className="absolute top-4 right-4 flex gap-2 z-20">
        <button 
          onClick={() => setLocale('en')} 
          className={`px-3 py-1.5 rounded text-[11px] font-bold tracking-widest transition-all ${locale === 'en' ? 'bg-[#d4a843]/15 text-[#f0c86a] border border-[#d4a843]/40 shadow-[0_0_12px_rgba(212,168,67,0.15)]' : 'text-gray-500 hover:text-gray-300'}`}
        >EN</button>
        <button 
          onClick={() => setLocale('pt-BR')} 
          className={`px-3 py-1.5 rounded text-[11px] font-bold tracking-widest transition-all ${locale === 'pt-BR' ? 'bg-[#d4a843]/15 text-[#f0c86a] border border-[#d4a843]/40 shadow-[0_0_12px_rgba(212,168,67,0.15)]' : 'text-gray-500 hover:text-gray-300'}`}
        >PT-BR</button>
      </div>

      {/* Conteúdo */}
      <div className="w-full max-w-sm relative z-10 flex flex-col items-center">
        
        {/* Logo */}
        <div className="text-center mb-6 animate-fadeInDown">
          <img
            src="/images/logo_auth_new.png"
            alt="Realm of Eternity"
            className="w-48 sm:w-60 h-auto mx-auto drop-shadow-[0_0_25px_rgba(212,168,67,0.35)]"
            draggable={false}
          />
        </div>

        {/* Régua ornamental */}
        <div className="ornate-rule w-56 sm:w-64 mb-7 animate-fadeInDown" style={{ animationDelay: '0.1s' }} />

        {/* Card Login — moldura real */}
        <div className="w-full rounded-2xl p-6 sm:p-8 card-royal animate-fadeInUp" style={{ animationDelay: '0.15s', background: 'linear-gradient(165deg, rgba(16,21,38,0.92) 0%, rgba(9,13,26,0.94) 100%)', border: '1px solid rgba(212,168,67,0.14)', boxShadow: '0 24px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(240,200,106,0.08)' }}>
          
          <h2 className="font-display text-xl sm:text-2xl font-bold text-white text-center mb-1 tracking-wide">
            {isLogin ? t("auth.login", locale) : t("auth.register", locale)}
          </h2>
          <p className="text-gray-500 text-xs text-center mb-6 tracking-wide">
            {isLogin 
              ? (locale === 'en' ? 'Welcome back, hero' : 'Bem-vindo de volta, herói')
              : (locale === 'en' ? 'Forge your legend' : 'Forje sua lenda')
            }
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/25 text-red-300 p-3 rounded-lg mb-4 text-center text-sm animate-shake">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 tracking-wider uppercase">
                {t("auth.username", locale)}
              </label>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                className="w-full px-3.5 py-2.5 rounded-lg text-white text-sm outline-none transition-all game-input"
                placeholder={locale === 'en' ? 'Username' : 'Nome de usuário'}
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 tracking-wider uppercase">
                {t("auth.password", locale)}
              </label>
              <input
                type="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg text-white text-sm outline-none transition-all game-input"
                placeholder={locale === 'en' ? '••••••••' : '••••••••'}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg text-sm font-bold text-white mt-3 transition-all disabled:opacity-50 font-display tracking-widest uppercase game-btn"
              style={{
                background: 'linear-gradient(135deg, #d4a843 0%, #a8812a 50%, #8a6a1f 100%)',
                border: '1px solid rgba(240,200,106,0.45)',
                boxShadow: '0 4px 20px rgba(212,168,67,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="spinner w-4 h-4 border-2 !border-t-[#f0c86a]" />
                  {t("general.loading", locale)}
                </span>
              ) : (
                isLogin ? t("auth.login", locale) : t("auth.createAccount", locale)
              )}
            </button>
          </form>

          <div className="mt-5 text-center">
            <button 
              onClick={() => { setIsLogin(!isLogin); setError(""); }} 
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {isLogin ? (
                <>
                  {locale === 'en' ? "Don't have an account? " : "Não tem conta? "}
                  <span className="text-[#f0c86a] font-semibold">{locale === 'en' ? "Sign up" : "Criar conta"}</span>
                </>
              ) : (
                <>
                  {locale === 'en' ? "Already have an account? " : "Já tem conta? "}
                  <span className="text-[#f0c86a] font-semibold">{locale === 'en' ? "Log in" : "Entrar"}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-7 text-gray-600/50">
          <p className="text-[10px] tracking-widest">v1.0.0 · © 2026 {t("app.title", locale)}</p>
        </div>
      </div>
    </div>
  );
}
