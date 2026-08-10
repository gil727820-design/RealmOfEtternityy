import { NextRequest, NextResponse } from "next/server";
import jsonDb from "@/db/repo";

export async function GET(_req: NextRequest) {
  try {
    const audio = await jsonDb.listRegionAudio();
    const files: Record<string, string> = {};
    for (const a of audio) {
      if (a.url) files[String(a.regionId)] = String(a.url);
    }
    return NextResponse.json({ files });
  } catch (e: unknown) {
    console.error("region/audio error:", e);
    return NextResponse.json({ files: {} });
  }
}