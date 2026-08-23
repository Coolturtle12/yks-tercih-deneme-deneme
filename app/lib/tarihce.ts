/**
 * Taban puanların yıllara göre seyri — SADECE SUNUCU.
 *
 * `data/tarihce.json`, YÖK Atlas'ın /netler/search ucunun tek çağrıda döndürdüğü
 * üç yıllık kayıttan (bugün 2023-2025) `scripts/veri-cek.mjs` tarafından üretilir.
 * Kılavuz (programlar.json) yalnızca içinde bulunulan yılı bilir; "bu bölümün
 * puanı geçen yıl neydi", "bu üniversite ne zaman zirve yaptı" sorularının tek
 * kaynağı bu dosyadır.
 *
 * `veri.ts` gibi dosya bir kez okunup süreç belleğinde tutulur.
 *
 * Veriyi tazelemek için:  npm run veri
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { anahtar } from "./veri.ts";
import type { PuanTuru } from "./yks.ts";

/** Grafiklerin doğrudan tüketebileceği (yıl, değer) çifti listesi. */
export type YilSerisi = { yil: number; deger: number | null }[];

/**
 * Bir üniversitenin yıl bazlı ortalamaları. `genel` her zaman vardır; puan türü
 * alanları yalnızca o üniversitenin o türde programı varsa bulunur.
 */
type UniversiteKaydi = {
  genel: (number | null)[];
  programSayisi: number[];
  zirveYil: number | null;
  zirveOrtalama: number | null;
} & Partial<Record<PuanTuru, (number | null)[]>>;

type TarihceDosyasi = {
  yillar: number[];
  /** ÖSYM kılavuz kodu → yıl sırasına göre taban puanlar. */
  programlar: Record<string, (number | null)[]>;
  universiteler: Record<string, UniversiteKaydi>;
  turkiye: { genel: (number | null)[] } & Partial<Record<PuanTuru, (number | null)[]>>;
};

/**
 * Üniversite adı aramasının indeksi. Kullanıcı "boğaziçi" yazdığında da,
 * kılavuzun "BOĞAZİÇİ ÜNİVERSİTESİ" yazımı da aynı kaydı bulmalı; eşleştirme
 * `veri.ts`'in `anahtar()` mantığıyla yapılır ki iki katman ayrışmasın.
 */
let onbellek: { dosya: TarihceDosyasi; uniIndeksi: Map<string, string> } | null = null;

function veri() {
  if (!onbellek) {
    const yol = join(process.cwd(), "data", "tarihce.json");
    const dosya = JSON.parse(readFileSync(yol, "utf8")) as TarihceDosyasi;
    const uniIndeksi = new Map<string, string>();
    for (const ad of Object.keys(dosya.universiteler)) uniIndeksi.set(anahtar(ad), ad);
    onbellek = { dosya, uniIndeksi };
  }
  return onbellek;
}

/** Tarihçenin kapsadığı yıllar, artan sırada. */
export function yillar(): number[] {
  return veri().dosya.yillar;
}

/** Ülke geneli ortalama — grafikte üniversitenin karşısına konan çizgi. */
export function turkiyeOrtalamalari(puanTuru?: PuanTuru): (number | null)[] {
  const { turkiye } = veri().dosya;
  return (puanTuru && turkiye[puanTuru]) ?? turkiye.genel;
}

/** Bir diziyi grafiklerin beklediği (yıl, değer) biçimine çevirir. */
export function yilSerisi(degerler: (number | null)[], yilListesi = yillar()): YilSerisi {
  return yilListesi.map((yil, i) => ({ yil, deger: degerler[i] ?? null }));
}

/**
 * Bir dizinin en yüksek değerini ve o değerin yılını bulur.
 * Boş yıllar aday değildir: veri yokluğu "en yüksek" olamaz.
 */
function zirve(degerler: (number | null)[], yilListesi: number[]) {
  let zirveYil: number | null = null;
  let zirveDeger: number | null = null;
  degerler.forEach((deger, i) => {
    if (deger !== null && (zirveDeger === null || deger > zirveDeger)) {
      zirveDeger = deger;
      zirveYil = yilListesi[i];
    }
  });
  return { zirveYil, zirveDeger } as { zirveYil: number | null; zirveDeger: number | null };
}

export type ProgramTarihcesi = {
  yillar: number[];
  puanlar: (number | null)[];
  zirveYil: number | null;
  /**
   * Son yıl − ilk yıl, yalnızca dolu uçlar arasında. Negatif değer taban puanın
   * gerilediğini gösterir. Tek yıl verisi olan programda null.
   */
  degisim: number | null;
};

/**
 * Bir programın üç yıllık taban puan seyri. Kılavuz kodu tarihçede yoksa
 * (yeni açılan ya da hiç dolmamış program) null döner.
 */
export function programTarihcesi(kod: number): ProgramTarihcesi | null {
  const { dosya } = veri();
  const puanlar = dosya.programlar[String(kod)];
  if (!puanlar) return null;

  const dolu = puanlar.map((p, i) => [p, i] as const).filter(([p]) => p !== null);
  // Değişim uçlardan okunur; aradaki boş yıl seriyi kesmez, yalnızca seyrekleştirir.
  const degisim =
    dolu.length >= 2
      ? Math.round((dolu[dolu.length - 1][0]! - dolu[0][0]!) * 100) / 100
      : null;

  return {
    yillar: dosya.yillar,
    puanlar,
    zirveYil: zirve(puanlar, dosya.yillar).zirveYil,
    degisim,
  };
}

export type UniversiteTarihcesi = {
  /** Dosyadaki kanonik yazım — kullanıcının yazdığı değil. */
  uni: string;
  yillar: number[];
  ortalamalar: (number | null)[];
  /**
   * O yıl taban puanı yayımlanmış program sayısı. `puanTuru` süzülse bile bu
   * sayı üniversitenin TAMAMINI kapsar — grafiğin altındaki "kaç programdan"
   * notu için; türe göre kırılım tarihçe dosyasında tutulmuyor.
   */
  programSayilari: number[];
  zirveYil: number | null;
  zirveOrtalama: number | null;
  turkiyeOrtalamalari: (number | null)[];
};

/**
 * Bir üniversitenin ortalama taban puan seyri.
 *
 * `puanTuru` verilirse hem seri hem zirve O TÜR için yeniden hesaplanır:
 * dosyadaki hazır `zirveYil` genel ortalamanındır ve bir üniversitenin SAY
 * zirvesi ile genel zirvesi farklı yıllara düşebilir. Aday hiç programı olmayan
 * bir tür sorarsa null döner — boş grafik çizmek yerine "veri yok" demek daha
 * dürüst.
 */
export function universiteTarihcesi(uniAdi: string, puanTuru?: PuanTuru): UniversiteTarihcesi | null {
  const { dosya, uniIndeksi } = veri();
  const kanonik = uniIndeksi.get(anahtar(uniAdi));
  if (!kanonik) return null;

  const kayit = dosya.universiteler[kanonik];
  const ortalamalar = puanTuru ? kayit[puanTuru] : kayit.genel;
  if (!ortalamalar) return null;

  const { zirveYil, zirveDeger } = puanTuru
    ? zirve(ortalamalar, dosya.yillar)
    : { zirveYil: kayit.zirveYil, zirveDeger: kayit.zirveOrtalama };

  return {
    uni: kanonik,
    yillar: dosya.yillar,
    ortalamalar,
    programSayilari: kayit.programSayisi,
    zirveYil,
    zirveOrtalama: zirveDeger,
    turkiyeOrtalamalari: turkiyeOrtalamalari(puanTuru),
  };
}

export type ZirveKaydi = {
  uni: string;
  /** Serideki son dolu yılın ortalaması; liste buna göre sıralıdır. */
  ortalama: number | null;
  zirveYil: number | null;
  zirveOrtalama: number | null;
  /** Son dolu yılın program sayısı — "kaç programın ortalaması" bilgisi. */
  programSayisi: number;
};

/**
 * Grafik seçicisinin listesi: ortalaması en yüksek üniversiteler, her birinin
 * zirve yılıyla.
 *
 * Sıralama SON yılın ortalamasına göredir, zirveye göre değil: seçici "bugün
 * en yüksek olanlar" listesidir; zirve yılı ise seçilen üniversitenin grafiğinde
 * işaretlenecek ek bilgi. Zirveye göre sıralamak, on yıl önce tepe yapıp bugün
 * gerilemiş kurumları listenin başına taşırdı.
 *
 * `puanTuru` verilirse o türde programı olmayan üniversiteler listeye girmez.
 */
export function zirveyeGoreUniversiteler(puanTuru?: PuanTuru, limit = 25): ZirveKaydi[] {
  const { dosya } = veri();
  const kayitlar: ZirveKaydi[] = [];

  for (const [uni, kayit] of Object.entries(dosya.universiteler)) {
    const seri = puanTuru ? kayit[puanTuru] : kayit.genel;
    if (!seri) continue;

    const { zirveYil, zirveDeger } = puanTuru
      ? zirve(seri, dosya.yillar)
      : { zirveYil: kayit.zirveYil, zirveDeger: kayit.zirveOrtalama };
    if (zirveDeger === null) continue;

    // Son dolu yıl; serinin sonu boş olabilir (o yıl hiçbir programı dolmamış).
    let sonIndeks = -1;
    seri.forEach((deger, i) => {
      if (deger !== null) sonIndeks = i;
    });

    kayitlar.push({
      uni,
      ortalama: sonIndeks === -1 ? null : seri[sonIndeks],
      zirveYil,
      zirveOrtalama: zirveDeger,
      programSayisi: sonIndeks === -1 ? 0 : kayit.programSayisi[sonIndeks],
    });
  }

  kayitlar.sort((a, b) => (b.ortalama ?? 0) - (a.ortalama ?? 0));
  return kayitlar.slice(0, Math.max(1, limit));
}
