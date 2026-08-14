import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      // Caching: imagens estáticas (public/images, /sprites, /classes) são
      // imutáveis durante o deploy → navegador guarda sem re-baixar.
      {
        source: "/images/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/sprites/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/classes/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;