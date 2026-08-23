/**
 * Kılavuz üzerinden çıkarılan toplu istatistikler — SADECE SUNUCU.
 *
 * Buradaki üç soru arayüzün "keşif" ekranını besliyor:
 *   sehirDagilimi() — hangi şehirde ne kadar kontenjan var (harita)
 *   ucNoktalar()    — en yüksek ve en düşük puanla kapanan programlar
 *   ozet()          — tek satırlık büyüklük tablosu
 *
 * Hepsi `veri.ts`'in zaten belleğe aldığı program dizisini tarar; sonuçlar
 * (puan türü, düzey) anahtarıyla önbelleğe alınır, çünkü 21,5 bin kaydı her
 * istekte yeniden gruplamanın anlamı yok — veri süreç ömrü boyunca sabit.
 */

import ilKoordinatlari from "../../data/il-koordinat.json" with { type: "json" };
import { tumProgramlar, type Duzey, type Program } from "./veri.ts";
import type { PuanTuru } from "./yks.ts";

/**
 * Türkiye'nin yedi coğrafi bölgesi. KKTC ve "Yurt Dışı" coğrafi bölge değildir;
 * kılavuzda KKTC ve Bosna-Hersek kampüsleri de bulunduğu için, onları haritadan
 * düşürmek yerine kendi etiketleriyle taşıyoruz.
 */
export type Bolge =
  | "Marmara" | "Ege" | "Akdeniz" | "İç Anadolu"
  | "Karadeniz" | "Doğu Anadolu" | "Güneydoğu Anadolu"
  | "KKTC" | "Yurt Dışı";

export type IlKoordinati = { lat: number; lon: number; bolge: Bolge };

/** İl adları `programlar.json`'daki `il` alanıyla birebir aynı yazımdadır. */
export const IL_KOORDINATLARI = ilKoordinatlari as Record<string, IlKoordinati>;

/** Bir ilin uç programı — haritadaki baloncuğun içeriği. */
export type UcProgram = {
  puan: number;
  sira: number | null;
  uni: string;
  bolum: string;
  kod: number;
};

export type SehirIstatistigi = {
  il: string;
  lat: number;
  lon: number;
  bolge: Bolge;
  universiteSayisi: number;
  programSayisi: number;
  kontenjanToplami: number;
  enYuksekTaban: UcProgram | null;
  enDusukTaban: UcProgram | null;
};

/**
 * Haritaya konamayan kayıtlar. İki kaynağı var: kılavuzun şehir bildirmediği
 * yurt dışı kampüsleri (`il: null`) ve — koordinat tablosu güncel kalmazsa —
 * karşılığı olmayan yeni bir il adı. İkisini sessizce yutmak yerine sayıyoruz
 * ki harita toplamı kılavuz toplamıyla tutmadığında nedeni görünsün.
 */
export type Koordinatsiz = { il: string | null; programSayisi: number; kontenjanToplami: number };

export type SehirDagilimi = { sehirler: SehirIstatistigi[]; koordinatsiz: Koordinatsiz[] };

/** Önbellek anahtarı; `undefined` filtreler "hepsi" anlamına gelir. */
const anahtarla = (...parcalar: (string | number | undefined)[]) => parcalar.join("|");

const sehirOnbellegi = new Map<string, SehirDagilimi>();
const ozetOnbellegi = new Map<string, Ozet>();
const ucOnbellegi = new Map<string, UcNoktalar>();

function suzulmus(puanTuru?: PuanTuru, duzey?: Duzey): readonly Program[] {
  const hepsi = tumProgramlar();
  if (!puanTuru && !duzey) return hepsi;
  return hepsi.filter((p) => (!puanTuru || p.puanTuru === puanTuru) && (!duzey || p.duzey === duzey));
}

const ucProgram = (p: Program): UcProgram => ({
  puan: p.tabanPuan!,
  sira: p.tabanSira,
  uni: p.uni,
  bolum: p.bolum,
  kod: p.kod,
});

/**
 * Şehir bazlı yığın: kaç üniversite, kaç program, ne kadar kontenjan, en
 * yüksek ve en düşük puanla kapanan program. Program sayısına göre azalan
 * sıralı — harita etiketlerini büyükten küçüğe çizmek için.
 */
export function sehirDagilimi(puanTuru?: PuanTuru, duzey?: Duzey): SehirDagilimi {
  const anahtar = anahtarla(puanTuru, duzey);
  const hazir = sehirOnbellegi.get(anahtar);
  if (hazir) return hazir;

  type Yigin = {
    universiteler: Set<string>;
    programSayisi: number;
    kontenjanToplami: number;
    enYuksek: Program | null;
    enDusuk: Program | null;
  };
  const yiginlar = new Map<string, Yigin>();
  const disarida = new Map<string, Koordinatsiz>();

  for (const p of suzulmus(puanTuru, duzey)) {
    if (p.il === null || !IL_KOORDINATLARI[p.il]) {
      // Map anahtarı null olamaz; boş dize "şehir bildirilmemiş"i temsil eder.
      const ad = p.il ?? "";
      let kayit = disarida.get(ad);
      if (!kayit) disarida.set(ad, (kayit = { il: p.il, programSayisi: 0, kontenjanToplami: 0 }));
      kayit.programSayisi += 1;
      kayit.kontenjanToplami += p.kontenjan;
      continue;
    }

    let yigin = yiginlar.get(p.il);
    if (!yigin) {
      yiginlar.set(p.il, (yigin = {
        universiteler: new Set(),
        programSayisi: 0,
        kontenjanToplami: 0,
        enYuksek: null,
        enDusuk: null,
      }));
    }
    yigin.universiteler.add(p.uni);
    yigin.programSayisi += 1;
    yigin.kontenjanToplami += p.kontenjan;

    // Dolmayan programın taban puanı yok; uç hesabına giremez.
    if (p.tabanPuan === null) continue;
    if (yigin.enYuksek === null || p.tabanPuan > yigin.enYuksek.tabanPuan!) yigin.enYuksek = p;
    if (yigin.enDusuk === null || p.tabanPuan < yigin.enDusuk.tabanPuan!) yigin.enDusuk = p;
  }

  const sehirler: SehirIstatistigi[] = [...yiginlar].map(([il, y]) => ({
    il,
    ...IL_KOORDINATLARI[il],
    universiteSayisi: y.universiteler.size,
    programSayisi: y.programSayisi,
    kontenjanToplami: y.kontenjanToplami,
    enYuksekTaban: y.enYuksek ? ucProgram(y.enYuksek) : null,
    enDusukTaban: y.enDusuk ? ucProgram(y.enDusuk) : null,
  }));
  sehirler.sort((a, b) => b.programSayisi - a.programSayisi || a.il.localeCompare(b.il, "tr"));

  const sonuc: SehirDagilimi = {
    sehirler,
    koordinatsiz: [...disarida.values()].sort((a, b) => b.programSayisi - a.programSayisi),
  };
  sehirOnbellegi.set(anahtar, sonuc);
  return sonuc;
}

export type UcNoktalar = {
  /** En yüksek puanla kapanan programlar, azalan. */
  enYuksek: Program[];
  /** En düşük puanla kapanan programlar, artan — dolmayanlar hariç. */
  enDusuk: Program[];
  /**
   * Kontenjanı dolmadığı için taban puanı yayımlanmayan programlar.
   * "En düşük puan" listesine karışırlarsa yanlış okunurdu: bunlar puanı düşük
   * programlar değil, puanı OLMAYAN programlardır.
   */
  dolmayan: Program[];
};

export function ucNoktalar(puanTuru: PuanTuru, duzey?: Duzey, limit = 20): UcNoktalar {
  const anahtar = anahtarla(puanTuru, duzey, limit);
  const hazir = ucOnbellegi.get(anahtar);
  if (hazir) return hazir;

  const kapsam = suzulmus(puanTuru, duzey);
  const dolmus = kapsam.filter((p) => p.tabanPuan !== null);
  const artan = [...dolmus].sort((a, b) => a.tabanPuan! - b.tabanPuan!);
  const kesme = Math.max(1, limit);

  const sonuc: UcNoktalar = {
    enYuksek: artan.slice(-kesme).reverse(),
    enDusuk: artan.slice(0, kesme),
    dolmayan: kapsam.filter((p) => p.tabanPuan === null).slice(0, kesme),
  };
  ucOnbellegi.set(anahtar, sonuc);
  return sonuc;
}

export type Ozet = {
  toplamProgram: number;
  toplamKontenjan: number;
  universiteSayisi: number;
  ilSayisi: number;
  /** Devlet üniversitelerindeki PROGRAM sayısı (üniversite sayısı değil). */
  devlet: number;
  /** Vakıf üniversitelerindeki PROGRAM sayısı. */
  vakif: number;
  /** Taban puanı yayımlanmış programların ortalaması; hiç yoksa null. */
  ortalamaTaban: number | null;
};

export function ozet(puanTuru?: PuanTuru): Ozet {
  const anahtar = anahtarla(puanTuru);
  const hazir = ozetOnbellegi.get(anahtar);
  if (hazir) return hazir;

  const kapsam = suzulmus(puanTuru);
  const universiteler = new Set<string>();
  const iller = new Set<string>();
  let toplamKontenjan = 0;
  let devlet = 0;
  let vakif = 0;
  let tabanToplami = 0;
  let tabanAdedi = 0;

  for (const p of kapsam) {
    universiteler.add(p.uni);
    if (p.il !== null) iller.add(p.il);
    toplamKontenjan += p.kontenjan;
    if (p.uniTur === "DEVLET") devlet += 1;
    else if (p.uniTur === "VAKIF") vakif += 1;
    if (p.tabanPuan !== null) {
      tabanToplami += p.tabanPuan;
      tabanAdedi += 1;
    }
  }

  const sonuc: Ozet = {
    toplamProgram: kapsam.length,
    toplamKontenjan,
    universiteSayisi: universiteler.size,
    ilSayisi: iller.size,
    devlet,
    vakif,
    ortalamaTaban: tabanAdedi ? Math.round((tabanToplami / tabanAdedi) * 100) / 100 : null,
  };
  ozetOnbellegi.set(anahtar, sonuc);
  return sonuc;
}
