import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import PwaRegister from "@/components/PwaRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "Realm of Eternity - MMORPG Idle",
  description: "Seu destino aguarda. Conquiste o reino mesmo enquanto dorme. MMORPG Idle Online.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Realm of Eternity",
  },
  icons: {
    icon: "/images/icons/icone_diamante.png",
    apple: "/images/icons/icone_diamante.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a12",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
