import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Realm of Eternity - MMORPG Idle",
  description: "Seu destino aguarda. Conquiste o reino mesmo enquanto dorme. MMORPG Idle Online.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
