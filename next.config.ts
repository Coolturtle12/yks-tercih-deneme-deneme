import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Bu veri dosyaları çalışma anında fs ile okunuyor (import edilmiyor), yani
   * derleyicinin izleyicisi göremiyor; derleme çıktısına elle dahil ediliyorlar.
   * data/il-koordinat.json burada yok, çünkü o `import ... with { type: "json" }`
   * ile paketleniyor.
   */
  outputFileTracingIncludes: {
    "/api/programlar": ["./data/programlar.json"],
    "/api/istatistik": ["./data/programlar.json"],
    "/api/tarihce": ["./data/tarihce.json"],
  },
};

export default nextConfig;
