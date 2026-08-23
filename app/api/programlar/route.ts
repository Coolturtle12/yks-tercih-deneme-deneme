/**
 * Program arama. Arayüzdeki 3. adım bu uca bağlıdır — filtreleme sunucuda
 * yapılır, çünkü 21 binlik kılavuzun tamamını tarayıcıya indirmenin anlamı yok.
 *
 * Örnek:
 *   /api/programlar?puanTuru=SAY&puan=478.4&grup=Tıp&uniTur=DEVLET&siralama=yakinlik
 */

import { ara, filtreCoz } from "@/app/lib/veri";
import { KILAVUZ_YILI } from "@/app/lib/yks";

export async function GET(request: Request) {
  const filtre = filtreCoz(new URL(request.url).searchParams);
  const sonuc = ara(filtre);

  return Response.json(
    { kilavuzYili: KILAVUZ_YILI, kaynak: "YÖK Atlas tercih kılavuzu", ...sonuc },
    { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } },
  );
}
