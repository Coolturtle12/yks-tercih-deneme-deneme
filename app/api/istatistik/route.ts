/**
 * Kılavuzun toplu istatistikleri — keşif ekranının veri kaynağı.
 *
 *   /api/istatistik                            → özet (varsayılan)
 *   /api/istatistik?tur=sehir&puanTuru=SAY     → harita için şehir dağılımı
 *   /api/istatistik?tur=uc&puanTuru=EA&limit=10 → uç noktalar
 *
 * `duzey` (lisans / onlisans) üç türde de geçerlidir.
 */

import { ozet, sehirDagilimi, ucNoktalar } from "@/app/lib/istatistik";
import { KILAVUZ_YILI, isPuanTuru } from "@/app/lib/yks";
import type { Duzey } from "@/app/lib/veri";

const ONBELLEK = { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const puanTuruParam = params.get("puanTuru");
  const puanTuru = isPuanTuru(puanTuruParam) ? puanTuruParam : undefined;

  const duzeyParam = params.get("duzey");
  const duzey: Duzey | undefined =
    duzeyParam === "lisans" || duzeyParam === "onlisans" ? duzeyParam : undefined;

  const limitParam = Number(params.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(200, limitParam) : undefined;

  const govde = { kilavuzYili: KILAVUZ_YILI, puanTuru: puanTuru ?? null, duzey: duzey ?? null };

  switch (params.get("tur")) {
    case "sehir":
      return Response.json({ tur: "sehir", ...govde, ...sehirDagilimi(puanTuru, duzey) }, { headers: ONBELLEK });

    case "uc":
      /*
       * Uç noktalar puan türü olmadan anlamsızdır: TYT ile SAY tabanları aynı
       * ölçekte değil, hepsini tek listede sıralamak "en yüksek puanla kapanan
       * program" diye yanlış bir cevap üretir. Sessizce bir tür seçmek yerine
       * istemciyi uyarıyoruz.
       */
      if (!puanTuru) {
        return Response.json({ hata: "tur=uc için puanTuru zorunludur (SAY, EA, SÖZ, DİL, TYT)." }, { status: 400 });
      }
      return Response.json({ tur: "uc", ...govde, ...ucNoktalar(puanTuru, duzey, limit) }, { headers: ONBELLEK });

    default:
      return Response.json({ tur: "ozet", ...govde, ...ozet(puanTuru) }, { headers: ONBELLEK });
  }
}
