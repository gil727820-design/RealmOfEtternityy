/**
 * Teste visual no navegador (CDP) — usa o Chrome headless já aberto na 9222.
 * Entra no jogo com a conta de teste via localStorage, navega pelas abas
 * (mapa, torre, loja) e salva screenshots em /screenshots + relata imagens
 * quebradas e requisições com erro.
 *
 * Uso: node scripts/browser-check.mjs
 */
import fs from "fs";

const CHAR = JSON.parse(fs.readFileSync("./char-test.json", "utf8")).character;
const USER_ID = "7b53b873-8105-4938-a540-94c92a58caf6";
const DEBUG_PORT = 9222;
const BASE = "http://localhost:3000";
const OUT_DIR = "screenshots";
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

// ---------- CDP helpers ----------
async function getPageWsUrl() {
  const list = await (await fetch(`http://localhost:${DEBUG_PORT}/json/list`)).json();
  const page = list.find((t) => t.type === "page");
  if (!page) throw new Error("Nenhuma aba de página encontrada no Chrome");
  return page.webSocketDebuggerUrl;
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    let id = 0;
    ws.onopen = () =>
      resolve({
        ws,
        send(method, params = {}) {
          return new Promise((res, rej) => {
            const mid = ++id;
            pending.set(mid, { res, rej });
            ws.send(JSON.stringify({ id: mid, method, params }));
          });
        },
      });
    ws.onerror = (e) => reject(e);
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message));
        else res(msg.result);
      }
    };
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function evaluate(cdp, expression) {
  const r = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) throw new Error("JS error: " + JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result?.value;
}

async function waitFor(cdp, expr, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (await evaluate(cdp, expr)) return true;
    } catch { /* ignore */ }
    await sleep(400);
  }
  return false;
}

// ---------- sessão persistida do jogo (zustand) ----------
function persistedState(activeTab) {
  return JSON.stringify({
    state: {
      userId: USER_ID,
      characterId: CHAR.id,
      character: CHAR,
      inventory: [],
      activeMissions: [],
      availableMissions: [],
      afkRewards: null,
      locale: "pt-BR",
      activeTab,
      isLoggedIn: true,
      hasCharacter: true,
      mailboxCount: 0,
      soundOn: false,
      volume: 0.08,
      notification: null,
    },
    version: 0,
  });
}

async function loadTab(cdp, tab, label) {
  // Injeta a sessão (e o modo teste do admin p/ ignorar manutenção) e recarrega
  await evaluate(cdp, `localStorage.setItem("realm-of-eternity-storage", ${JSON.stringify(persistedState(tab))}); localStorage.setItem("adminTestMode", "1"); location.reload(); true`);
  await waitFor(cdp, `document.readyState === "complete"`, 20000);
  // Espera o conteúdo do jogo aparecer (elemento com texto do painel)
  await sleep(4500);

  const broken = await evaluate(cdp, `
    (() => {
      const imgs = [...document.querySelectorAll("img")];
      const brokenImgs = imgs.filter(i => i.complete && i.naturalWidth === 0);
      const total = imgs.length;
      const bgOk = getComputedStyle(document.body).backgroundImage;
      const pageTitle = document.title;
      const hasText = document.body ? document.body.innerText.slice(0, 80) : "";
      return { brokenImgs: brokenImgs.map(i => i.src.slice(0, 120)), total, pageTitle, hasText };
    })()
  `);

  const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync(`${OUT_DIR}/${label}.png`, Buffer.from(shot.data, "base64"));
  console.log(`📸 ${label}: screenshot salvo (${(fs.statSync(`${OUT_DIR}/${label}.png`).size / 1024).toFixed(0)}KB) — imagens na página: ${broken.total}, quebradas: ${broken.brokenImgs.length}`);
  if (broken.brokenImgs.length) console.log("   ❌ quebradas:", broken.brokenImgs.join(", "));
  console.log("   título:", broken.pageTitle, "| texto:", JSON.stringify(broken.hasText).slice(0, 80));
}

(async () => {
  const wsUrl = await getPageWsUrl();
  const cdp = await connect(wsUrl);

  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });

  const failedReqs = [];
  const httpErrors = new Set();
  const onMsg = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === "Network.loadingFailed" && msg.params?.errorText && !msg.params?.canceled) {
      failedReqs.push(`${msg.params.errorText} (${msg.params.requestId})`);
    }
    if (msg.method === "Network.responseReceived" && msg.params?.response?.status >= 400) {
      httpErrors.add(`${msg.params.response.status} ${msg.params.response.url.slice(0, 120)}`);
    }
  };
  cdp.ws.addEventListener("message", onMsg);

  // Marcador de painel esperado por aba (confirma que a navegação funcionou)
  const PANEL_CHECK = {
    map: ["MAPA", "Atual", "Nível"],
    tower: ["ANDAR", "TORRE", "BATALHAR"],
    shop: ["VIP", "BAÚS", "DIAMANTES"],
    dashboard: ["ATAQUE", "STATUS", "AÇÕES RÁPIDAS"],
  };

  await cdp.send("Page.navigate", { url: BASE });
  await waitFor(cdp, `document.readyState === "complete"`, 20000);

  const seen = new Set();
  const countByExt = {};

  for (const [tab, label] of [["map", "01-mapa"], ["tower", "02-torre"], ["shop", "03-loja"], ["dashboard", "04-inicio"]]) {
    await loadTab(cdp, tab, label);
    const checks = PANEL_CHECK[tab] || [];
    const bodyText = await evaluate(cdp, `document.body.innerText`);
    const upper = (bodyText || "").toUpperCase();
    const missing = checks.filter((c) => !upper.includes(c));
    console.log("   painel " + tab + (missing.length ? " ⚠️ sem marcadores: " + missing.join(", ") : " ✅ confirmado"));
    // Conta imagens carregadas por extensão
    const imgs = await evaluate(cdp, `[...document.images].map(i => i.currentSrc || i.src)`);
    for (const u of imgs || []) {
      const ext = (u.split("?")[0].match(/\.(png|webp|jpg|jpeg)(?:$|\/)/i) || [])[1] || "outro";
      countByExt[ext] = (countByExt[ext] || 0) + 1;
      seen.add(u);
    }
  }

  console.log("\n⚠️ Requisições com erro (rede):", failedReqs.length);
  failedReqs.slice(0, 10).forEach((r) => console.log("  -", r));
  console.log("⚠️ Respostas HTTP >= 400:", httpErrors.size);
  [...httpErrors].slice(0, 10).forEach((r) => console.log("  -", r));
  console.log("\n🖼️ Imagens únicas carregadas:", seen.size, "| por extensão:", JSON.stringify(countByExt));

  cdp.ws.close();
  console.log("\n✅ Screenshots em /screenshots");
})().catch((e) => {
  console.error("FALHA:", e.message);
  process.exit(1);
});
