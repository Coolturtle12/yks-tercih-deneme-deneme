/**
 * Taban puanların yıllara göre seyri. Tek uç, üç soruyu karşılar:
 *
 *   /api/tarihce?kod=203110477            → bir programın yıllara göre tabanı
 *   /api/tarihce?uni=Boğaziçi&puanTuru=SAY → bir üniversitenin ortalama seyri
 *   /api/tarihce?puanTuru=EA&limit=10      → zirveye göre üniversite listesi
 *
 * Üçü de aynı dosyadan okunduğu için ayrı uçlara bölmenin maliyeti var, faydası
 * yok: istemci hangisini istediğine sorgu diziyle karar veriyor.
 */

import {
  programTarihcesi,
  universiteTarihcesi,
  yillar,
  zirveyeGoreUniversiteler,
} from "@/app/lib/tarihce";
import { isPuanTuru } from "@/app/lib/yks";

const ONBELLEK = { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const puanTuruParam = params.get("puanTuru");
  const puanTuru = isPuanTuru(puanTuruParam) ? puanTuruParam : undefined;

  const kodParam = params.get("kod");
  if (kodParam) {
    const kod = Number(kodParam);
    const tarihce = Number.isInteger(kod) ? programTarihcesi(kod) : null;
    if (!tarihce) {
      // Yeni açılan ya da hiç dolmamış programın geçmişi yok; bu bir hata değil,
      // ama istemci "veri yok" ile "yanlış kod" ayrımını görebilmeli.
      return Response.json({ hata: "Bu kılavuz kodunun geçmiş verisi yok.", kod: kodParam }, { status: 404 });
    }
    return Response.json({ tur: "program", kod, ...tarihce }, { headers: ONBELLEK });
  }

  const uni = params.get("uni")?.trim();
  if (uni) {
    const tarihce = universiteTarihcesi(uni, puanTuru);
    if (!tarihce) {
      return Response.json(
        { hata: "Bu üniversitenin (bu puan türünde) geçmiş verisi yok.", uni, puanTuru },
        { status: 404 },
      );
    }
    return Response.json({ tur: "universite", puanTuru: puanTuru ?? null, ...tarihce }, { headers: ONBELLEK });
  }

  const limit = Number(params.get("limit"));
  return Response.json(
    {
      tur: "zirve",
      puanTuru: puanTuru ?? null,
      yillar: yillar(),
      universiteler: zirveyeGoreUniversiteler(puanTuru, Number.isFinite(limit) && limit > 0 ? limit : undefined),
    },
    { headers: ONBELLEK },
  );
}
