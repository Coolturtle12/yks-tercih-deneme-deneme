import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rota — YKS tercihlerini netleştir",
  description: "YKS netlerini hesapla, puanını gör ve sana uygun bölümleri keşfet.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="tr"><body>{children}</body></html>;
}
