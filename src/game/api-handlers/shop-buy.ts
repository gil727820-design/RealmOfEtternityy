import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";
import { VIP_TIERS, currentVipTier } from "@/game/vip";
import { effectiveMaxEnergy } from "@/game/energy";
import { requireCharacterAuth } from "@/game/auth";
import { pityCounters, pityDecision, pityStatus } from "@/game/pity";
import { hatchPetEgg, grantPetPatch, EGG_MAX_RARITY } from "@/game/pets";

const SHOP_ITEMS: Record<string, { price: number; currency: "gold"|"diamonds"; type: string; value: number; value2?: number; value3?: string }> = {
  // Baús
  common: { price: 1500, currency: "gold", type: "chest", value: 2, value2: 2, value3: "uncommon" },
  uncommon: { price: 3500, currency: "gold", type: "chest", value: 3, value2: 3, value3: "rare" },
  rare: { price: 7000, currency: "gold", type: "chest", value: 3, value2: 4, value3: "epic" },
  epic: { price: 150, currency: "diamonds", type: "chest", value: 3, value2: 4, value3: "epic" },
  legendary: { price: 450, currency: "diamonds", type: "chest", value: 4, value2: 5, value3: "legendary" },
  mythic: { price: 900, currency: "diamonds", type: "chest", value: 4, value2: 6, value3: "mythic" },
  divine: { price: 1800, currency: "diamonds", type: "chest", value: 5, value2: 7, value3: "divine" },
  secret: { price: 4000, currency: "diamonds", type: "chest", value: 5, value2: 8, value3: "supreme" },
  // Ovos de Pet (value: 0=básico, 1=raro, 2=épico)
  pet_egg: { price: 25000, currency: "gold", type: "pet_egg", value: 0 },
  pet_egg_rare: { price: 200, currency: "diamonds", type: "pet_egg", value: 1 },
  pet_egg_epic: { price: 600, currency: "diamonds", type: "pet_egg", value: 2 },
  // Poções
  vida: { price: 250, currency: "gold", type: "potion", value: 100 },
  mana: { price: 250, currency: "gold", type: "potion", value: 100 },
  energia: { price: 300, currency: "gold", type: "potion", value: 50 },
  forca: { price: 350, currency: "gold", type: "potion", value: 10 },
  velocidade: { price: 350, currency: "gold", type: "potion", value: 10 },
  vigor: { price: 400, currency: "gold", type: "potion", value: 20 },
  experiencia: { price: 400, currency: "diamonds", type: "potion", value: 50 },
  antidoto: { price: 300, currency: "gold", type: "potion", value: 50 },
  // VIP (tiers: bronze → imperador, 30 dias cada)
  ...Object.fromEntries(
    VIP_TIERS.map((tier) => [
      `vip_${tier.id}`,
      { price: tier.price, currency: "diamonds", type: "vip", value: VIP_TIERS.indexOf(tier) },
    ])
  ),
};

const RARITY_ORDER = ["common","uncommon","rare","epic","legendary","mythic","divine","ancestral","supreme"];

/** Nomes amigáveis dos tiers VIP para mensagens de erro (pt-BR). */
const VIP_NAMES: Record<string, string> = {
  bronze: "Bronze", silver: "Prata", gold: "Ouro", platinum: "Platina",
  diamond: "Diamante", master: "Mestre", legend: "Lenda", emperor: "Imperador",
};

export async function POST(req: NextRequest) {
  try {
    const { characterId, itemId, costType, costValue } = await req.json();
    if (!characterId || !itemId) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    
    const shopItem = SHOP_ITEMS[itemId];
    if (!shopItem) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    
    // Só o dono pode gastar o ouro/diamantes do próprio personagem na loja.
    const auth = await requireCharacterAuth(req, characterId);
    if (!auth.ok) return auth.response;
    const char = auth.char;
    
    // Validação de saldo (server-side)
    if (shopItem.currency === "gold" && (char.gold || 0) < shopItem.price) {
      return NextResponse.json({ error: "Ouro insuficiente" }, { status: 400 });
    }
    if (shopItem.currency === "diamonds" && (char.diamonds || 0) < shopItem.price) {
      return NextResponse.json({ error: "Diamantes insuficientes" }, { status: 400 });
    }
    
    if (shopItem.currency === "gold") {
      await jsonDb.updateCharacter(characterId, { gold: (char.gold || 0) - shopItem.price });
    } else {
      await jsonDb.updateCharacter(characterId, { diamonds: (char.diamonds || 0) - shopItem.price });
    }
    
    if (shopItem.type === "chest") {
      const count = shopItem.value;
      const maxRarityIdx = Math.max(0, RARITY_ORDER.indexOf(shopItem.value3 ?? "rare"));
      const level = Math.max(1, Number(char.level) || 1);
      const allItems = await jsonDb.getAllItemTemplates();
      const eligible = allItems.filter((it: any) => {
        const idx = RARITY_ORDER.indexOf(it.rarity || "common");
        if (idx < 0 || idx > maxRarityIdx) return false;
        // Baús NUNCA entregam poções/consumíveis — só equipamentos.
        if (it.type === "consumable" || it.stackable === true) return false;
        // Nunca entregar item acima do nível do jogador (não pode equipar).
        const minLv = Number(it.minLevel) || 1;
        return minLv <= level + 10; // pequena folga só para não frustrar
      });

      // Ponderado por raridade: o topo do baú tem o maior peso e cada nível
      // abaixo corta o peso pela metade. Baú comum solta quase só comum/incomum;
      // baú lendário raramente solta comum — "nada absurdo vindo de baú básico".
      const weighted: Array<{ pick: Record<string, unknown>; weight: number }> = eligible.map((it: any) => {
        const idx = Math.max(0, RARITY_ORDER.indexOf(it.rarity || "common"));
        const dist = maxRarityIdx - idx;
        return { pick: it, weight: Math.pow(0.5, dist) };
      });
      const totalW = weighted.reduce((s, w) => s + w.weight, 0);

      const rolled: Array<Record<string, unknown>> = [];
      let pityState: Record<string, number> = pityCounters(char);
      let pityTriggered = false;
      for (let i = 0; i < count; i++) {
        if (weighted.length > 0) {
          // Topo do baú = raridade máxima permitida por ele.
          const topRarity = shopItem.value3 ?? "rare";
          const topIdx = Math.max(0, RARITY_ORDER.indexOf(topRarity));

          // Pity: checa se ESTA abertura estoura o contador (current+1 >= lim).
          // Se estourar → força o topo e zera; senão incrementa (conta abertura).
          const check = pityDecision({ pityCounters: pityState }, itemId, false);
          pityState = check.pityCounters;

          if (check.guaranteed) {
            pityTriggered = true;
            // Seleciona apenas itens da raridade top do baú (pity garantido).
            const tops = eligible.filter((it: any) => {
              const idx = Math.max(0, RARITY_ORDER.indexOf(it.rarity || "common"));
              return idx === topIdx;
            });
            if (tops.length > 0) {
              const pick = tops[Math.floor(Math.random() * tops.length)];
              await jsonDb.grantItem(characterId, Number(pick.id), 1);
              rolled.push(pick);
              continue; // pity já zerado pela chamada acima (guaranteed zera)
            }
          }

          let r = Math.random() * totalW;
          let pick = weighted[0].pick;
          for (const w of weighted) {
            r -= w.weight;
            if (r <= 0) { pick = w.pick; break; }
          }
          await jsonDb.grantItem(characterId, Number(pick.id), 1);
          rolled.push(pick);

          // Se saiu o topo NATURALMENTE, zera o contador (a chamada de checagem
          // já tinha incrementado; zera agora). Item não-topo mantém o incremento.
          const gotTop = RARITY_ORDER.indexOf(String((pick as any).rarity || "common")) === topIdx;
          if (gotTop) {
            const after = pityDecision({ pityCounters: pityState }, itemId, true);
            pityState = after.pityCounters;
          }
        }
      }
      await jsonDb.updateCharacter(characterId, { pityCounters: pityState });
      const updated = await jsonDb.findCharacterById(characterId);
      return NextResponse.json({
        success: true,
        type: "chest",
        items: rolled,
        character: updated,
        pity: pityStatus(updated ?? char, itemId),
        pityTriggered,
      });
    }
    
    if (shopItem.type === "pet_egg") {
      // Choca o ovo: pet aleatório ponderado pela raridade (teto do ovo).
      const quality = (["basic", "rare", "epic"] as const)[shopItem.value] ?? "basic";
      const eggKey = `egg_${quality}`;

      // PITY do ovo 🎁: após N aberturas sem a raridade TOP do ovo, o próximo
      // ovo GARANTE o melhor pet (básico → raro, raro → lendário, épico → divino).
      let pityState: Record<string, number> = pityCounters(char);
      const check = pityDecision({ pityCounters: pityState }, eggKey, false);
      pityState = check.pityCounters;

      const def = check.guaranteed ? hatchPetEgg(quality, true) : hatchPetEgg(quality);
      const res = grantPetPatch(char, def.id);

      // Saiu a raridade top NATURALMENTE → zera o contador (a checagem acima já
      // tinha incrementado; zera agora). Pet abaixo do topo mantém o incremento.
      if (def.rarity === EGG_MAX_RARITY[quality]) {
        const after = pityDecision({ pityCounters: pityState }, eggKey, true);
        pityState = after.pityCounters;
      }

      await jsonDb.updateCharacter(characterId, {
        ...res.patch,
        pityCounters: pityState,
        lastActivity: new Date().toISOString(),
      });
      const updated = await jsonDb.findCharacterById(characterId);
      return NextResponse.json({
        success: true,
        type: "pet_egg",
        pet: {
          id: def.id,
          nameKey: def.nameKey,
          icon: def.icon,
          rarity: def.rarity,
          added: res.added,
          pityTriggered: check.guaranteed,
        },
        pity: pityStatus(updated ?? char, eggKey),
        pityTriggered: check.guaranteed,
        character: updated,
      });
    }

    if (shopItem.type === "potion") {
      // Poções principais passaram a ser itens de inventário (consumíveis empilháveis).
      // Se o template ainda não existir no banco (seed não rodado), mantém o efeito instantâneo antigo.
      const POTION_TEMPLATES: Record<string, string> = {
        vida: "item.hp_potion",
        mana: "item.mana_potion",
        energia: "item.energy_potion",
        experiencia: "item.elixir_xp",
      };
      const templateKey = POTION_TEMPLATES[itemId];
      const template = templateKey ? await jsonDb.getItemTemplateByNameKey(templateKey) : null;
      if (template) {
        await jsonDb.grantItem(characterId, template.id, 1);
        const updated = await jsonDb.findCharacterById(characterId);
        return NextResponse.json({ success: true, type: "potion", granted: template, character: updated });
      }

      if (itemId === "vida") {
        await jsonDb.updateCharacter(characterId, { hp: char.maxHp });
      } else if (itemId === "mana") {
        await jsonDb.updateCharacter(characterId, { mana: char.maxMana });
      } else if (itemId === "energia") {
        const newEnergy = Math.min(effectiveMaxEnergy(char), (char.energy || 0) + (shopItem.value || 0));
        await jsonDb.updateCharacter(characterId, { energy: newEnergy });
      } else if (itemId === "forca") {
        await jsonDb.updateCharacter(characterId, { strength: (char.strength || 0) + (shopItem.value || 0) });
      } else if (itemId === "velocidade") {
        await jsonDb.updateCharacter(characterId, { speed: (char.speed || 0) + (shopItem.value || 0) });
      } else if (itemId === "vigor") {
        await jsonDb.updateCharacter(characterId, { vitality: (char.vitality || 0) + (shopItem.value || 0) });
      } else if (itemId === "experiencia") {
        await jsonDb.updateCharacter(characterId, { xp: (char.xp || 0) + (shopItem.value || 0) });
      } else if (itemId === "antidoto") {
        await jsonDb.updateCharacter(characterId, { status: "normal" });
      }
      const updated = await jsonDb.findCharacterById(characterId);
      return NextResponse.json({ success: true, type: "potion", character: updated });
    }
    
    if (shopItem.type === "vip") {
      const tier = VIP_TIERS[shopItem.value];
      if (!tier) return NextResponse.json({ error: "VIP não encontrado" }, { status: 404 });
      // Só permite comprar VIP ACIMA do atual — tiers inferiores/iguais ficam bloqueados.
      const current = currentVipTier(char);
      if (current) {
        const currentIdx = VIP_TIERS.indexOf(current);
        const buyIdx = VIP_TIERS.indexOf(tier);
        if (buyIdx <= currentIdx) {
          return NextResponse.json({
            error: `Você já possui o VIP ${VIP_NAMES[current.id] || current.id} — só é possível comprar VIPs acima do seu atual.`,
          }, { status: 400 });
        }
      }
      const now = new Date();
      const vipUntil = new Date(now.getTime() + tier.days * 24 * 3600 * 1000).toISOString();
      await jsonDb.updateCharacter(characterId, {
        vipTier: tier.id,
        vipUntil,
        vipLevel: VIP_TIERS.indexOf(tier) + 1,
      });
      const updated = await jsonDb.findCharacterById(characterId);
      return NextResponse.json({ success: true, type: "vip", vipTier: tier.id, vipUntil, character: updated });
    }
    
    const updated = await jsonDb.findCharacterById(characterId);
    return NextResponse.json({ success: true, type: shopItem.type, character: updated });
  } catch (e: unknown) {
    console.error("Shop error:", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}