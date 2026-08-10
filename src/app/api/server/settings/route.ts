import { NextResponse } from "next/server";
import jsonDb from "@/db/repo";

/**
 * Endpoint PÚBLICO (sem autenticação) usado pelo cliente para exibir a
 * mensagem global do admin e o estado de manutenção do servidor.
 */
export async function GET() {
  try {
    const settings = await jsonDb.getServerSettings();
    return NextResponse.json({
      announcement: typeof settings?.announcement === "string" ? settings.announcement : "",
      announcementStyle: settings?.announcementStyle === "popup" ? "popup" : "banner",
      announcementId: typeof settings?.announcementId === "string" ? settings.announcementId : "",
      maintenance: !!settings?.maintenance,
      maintenanceMessage:
        typeof settings?.maintenanceMessage === "string" ? settings.maintenanceMessage : "",
      donatePixKey: typeof settings?.donatePixKey === "string" ? settings.donatePixKey : "",
      donateQrCode: typeof settings?.donateQrCode === "string" ? settings.donateQrCode : "",
    });
  } catch {
    return NextResponse.json({
      announcement: "",
      announcementStyle: "banner",
      announcementId: "",
      maintenance: false,
      maintenanceMessage: "",
      donatePixKey: "",
      donateQrCode: "",
    });
  }
}