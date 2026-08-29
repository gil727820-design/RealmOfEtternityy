import { NextResponse } from "next/server";
import { RECIPES } from "@/game/materials";

export async function GET() {
  return NextResponse.json({ recipes: RECIPES });
}
