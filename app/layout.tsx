import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Montserrat } from "next/font/google";
import "./globals.css";

/*
 * Montserrat, referans sayfanın (yukselenkoleji.k12.tr) tema fontudur ve
 * hesaplayıcı bileşeni de onu miras alır. Geniş, geometrik ve büyük harflerde
 * dengeli olduğu için hem başlık bandına hem de kart etiketlerine oturuyor;
 * bu yüzden hem başlık hem arayüz yüzü olarak kullanılıyor.
 */
const display = Montserrat({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  variable: "--f-display",
  display: "swap",
});

const ui = Montserrat({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--f-ui",
  display: "swap",
});

/* Rakam yüzü — netler, puanlar, sıralamalar; tabular figürlerle sütun hizası. */
const mono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--f-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rota — YKS puan hesaplama, başarı sırası ve tercih robotu",
  description:
    "TYT ve AYT netlerini gir; beş puan türünün tamamını, OBP'li yerleştirme puanını, tahmini başarı sıranı ve bu sıralamayla girebileceğin üniversiteleri gör. Taban puan geçmişi, şehir dağılımı, en yüksek ve en düşük puanla kapanan programlar.",
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }] },
};

export const viewport: Viewport = {
  /* Tarayıcı çubuğu, sayfanın en üstündeki bandın rengini alsın. */
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#071130" },
    { media: "(prefers-color-scheme: dark)", color: "#050c1f" },
  ],
};

/* Kayıtlı tema, ilk boyamadan önce uygulanır — yoksa yanlış temada bir kare görünür. */
const themeInit = `
try {
  var t = localStorage.getItem("rota-tema");
  if (t === "dark" || t === "light") document.documentElement.dataset.theme = t;
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${display.variable} ${ui.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
