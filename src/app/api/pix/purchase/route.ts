import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import jsonDb from "@/db/repo";

/**
 * Compra de diamantes via PIX.
 *
 * O jogador informa qual pacote quer (valueBRL), vê o QR/chave PIX configurados
 * pelo admin e envia um COMPROVANTE (arquivo de qualquer tipo).
 * A compra fica como `pending` no painel admin, que aprova → credita os
 * diamantes no personagem (diamondsPerReal define quantos diamantes valem R$ 1).
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let body: Record<string, unknown> = {};
    let screenshotUrl = "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      for (const [k, v] of form.entries()) {
        if (typeof v === "string") body[k] = v;
      }
      const file = form.get("screenshot");
      if (file && typeof file !== "string" && file.name) {
        const ext = path.extname(file.name).toLowerCase() || ".bin";
        const buffer = Buffer.from(await file.arrayBuffer());
        if (buffer.length === 0 || buffer.length > 10 * 1024 * 1024) {
          return NextResponse.json({ error: "Arquivo inválido ou maior que 10MB" }, { status: 400 });
        }
        const dir = path.join(process.cwd(), "public", "uploads", "proofs");
        await fs.mkdir(dir, { recursive: true });
        const fileName = `proof_${randomUUID()}${ext}`;
        await fs.writeFile(path.join(dir, fileName), buffer);
        screenshotUrl = `/uploads/proofs/${fileName}`;
      }
    } else {
      body = await req.json();
    }

    const characterId = String(body.characterId || "");
    const valueBRL = Number(body.valueBRL || 0);

    if (!characterId) return NextResponse.json({ error: "ID do personagem é obrigatório" }, { status: 400 });
    if (!Number.isFinite(valueBRL) || valueBRL <= 0) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }
    if (!screenshotUrl) {
      return NextResponse.json({ error: "Envie o arquivo do comprovante" }, { status: 400 });
    }

    const char = await jsonDb.findCharacterById(characterId);
    if (!char) return NextResponse.json({ error: "Personagem não encontrado" }, { status: 404 });

    const settings = await jsonDb.getServerSettings();
    const diamondsPerReal = Number(settings?.diamondsPerReal) > 0 ? Number(settings.diamondsPerReal) : 1000;
    const diamonds = Math.floor(valueBRL * diamondsPerReal);

    const purchase = await jsonDb.createPurchase({
      characterId: char.id,
      characterName: char.name || String(char.id).slice(0, 8),
      valueBRL,
      diamonds,
      screenshotUrl,
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