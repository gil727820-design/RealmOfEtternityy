import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { requireCharacterAuth } from "@/game/auth";

/**
 * Compra de diamantes via PIX.
 *
 * O jogador informa qual pacote quer (valueBRL), vê o QR/chave PIX configurados
 * pelo admin e envia um COMPROVANTE (imagem, redimensionada no navegador para
 * um Data URL base64). A compra fica como `pending` no painel admin, que aprova
 * → credita os diamantes no personagem (diamondsPerReal define quantos
 * diamantes valem R$ 1).
 *
 * O comprovante é guardado como base64 no próprio registro da compra (coluna
 * `data` de server_settings) — diferente do modelo antigo que gravava o arquivo
 * em `public/uploads/proofs/`, que NÃO funciona em hospedagens serverless
 * (Vercel/Netlify), onde o disco é somente leitura, e ainda deixava comprovantes
 * com dados bancários publicamente acessíveis por URL adivinhável.
 */

/** Tamanho máximo do Data URL aceito (6MB de base64 ≈ 4.5MB de imagem). */
const MAX_SCREENSHOT_LEN = 6 * 1024 * 1024;

/**
 * Assinaturas (magic numbers) de formatos de imagem aceitos.
 * Comprovantes de banco são quase sempre JPEG/PNG/WebP.
 */
function sniffImage(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  // PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "image/png";
  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  // GIF87a / GIF89a
  if (buffer.toString("latin1", 0, 6) === "GIF87a" || buffer.toString("latin1", 0, 6) === "GIF89a") return "image/gif";
  // WebP (RIFF....WEBP)
  if (buffer.toString("latin1", 0, 4) === "RIFF" && buffer.toString("latin1", 8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Valida o Data URL recebido e devolve o buffer da imagem (ou null). */
function parseScreenshot(dataUrl: string): Buffer | null {
  const m = /^data:image\/(png|jpeg|gif|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!m) return null;
  const buffer = Buffer.from(m[2], "base64");
  if (buffer.length === 0 || !sniffImage(buffer)) return null;
  return buffer;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let body: Record<string, unknown> = {};

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      for (const [k, v] of form.entries()) {
        if (typeof v === "string") body[k] = v;
      }
      // Compatibilidade: se um arquivo `screenshot` vier num FormData antigo,
      // converte para Data URL aqui mesmo.
      if (!body.screenshotData) {
        const file = form.get("screenshot");
        if (file && typeof file !== "string" && file.name) {
          const buffer = Buffer.from(await file.arrayBuffer());
          const mime = sniffImage(buffer);
          if (mime && buffer.length > 0 && buffer.length <= 5 * 1024 * 1024) {
            body.screenshotData = `data:${mime};base64,${buffer.toString("base64")}`;
          }
        }
      }
    } else {
      body = await req.json();
    }

    const characterId = String(body.characterId || "");
    const valueBRL = Number(body.valueBRL || 0);
    const screenshotData = String(body.screenshotData || "");

    if (!characterId) return NextResponse.json({ error: "ID do personagem é obrigatório" }, { status: 400 });
    if (!Number.isFinite(valueBRL) || valueBRL <= 0) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }
    if (!screenshotData || screenshotData.length > MAX_SCREENSHOT_LEN) {
      return NextResponse.json({ error: "Envie o arquivo do comprovante (imagem de até ~4MB)" }, { status: 400 });
    }
    // Só o dono do personagem pode registrar uma compra para ele.
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;

    // Garante que o comprovante é uma imagem de verdade (magic numbers) —
    // bloqueia binários arbitrários / HTML disfarçado.
    if (!parseScreenshot(screenshotData)) {
      return NextResponse.json({ error: "O comprovante deve ser uma imagem (PNG, JPG, GIF ou WebP)" }, { status: 400 });
    }

    const settings = await jsonDb.getServerSettings();
    const diamondsPerReal = Number(settings?.diamondsPerReal) > 0 ? Number(settings.diamondsPerReal) : 1000;
    const diamonds = Math.floor(valueBRL * diamondsPerReal);

    const purchase = await jsonDb.createPurchase({
      characterId: char.id,
      characterName: char.name || String(char.id).slice(0, 8),
      valueBRL,
      diamonds,
      screenshotData,
      pixKey: typeof settings?.donatePixKey === "string" ? settings.donatePixKey : "",
      status: "pending",
    });

    return NextResponse.json({ success: true, purchase });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("PIX purchase error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
