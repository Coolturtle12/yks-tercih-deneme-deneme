/**
 * Program verisine erişim — SADECE SUNUCU.
 *
 * `data/programlar.json` (YÖK Atlas tercih kılavuzunun tamamı, ~21,5 bin kayıt)
 * ilk istekte bir kez okunur ve süreç belleğinde kalır. Veriyi okuyan tek yer
 * burasıdır; bir gün Postgres'e taşınırsa değişecek dosya da yalnızca budur.
 *
 * Veriyi tazelemek için:  node scripts/veri-cek.mjs
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isPuanTuru, type PuanTuru } from "./yks.ts";

export type Duzey = "lisans" | "onlisans";
export type UniTuru = "DEVLET" | "VAKIF" | "KKTC" | "YURTDIŞI";

export type Program = {
  /** ÖSYM kılavuz (program) kodu. */
  kod: number;
  uni: string;
  uniTur: UniTuru;
  bolum: string;
  grup: string;
  /** Yurt dışı kampüslerde kılavuz şehir bildirmez. */
  il: string | null;
  puanTuru: PuanTuru;
  duzey: Duzey;
  ogretim: string;
  sure: number;
  burs: string | null;
  kontenjan: number;
  /** Kontenjanı dolmayan programlarda taban puan/sıra yayımlanmaz. */
  tabanPuan: number | null;
  tabanSira: number | null;
  ucret: number | null;
};

export type Risk = "guvenli" | "sinirda" | "zor" | "bilinmiyor";

export type ProgramSonucu = Program & {
  risk: Risk;
  puanFarki: number | null;
  /**
   * Programın taban sırası − adayın başarı sırası. Küçük sıra daha iyi olduğu
   * için POZİTİF değer adayın tabanın önünde olduğunu, yani sırasının
   * yettiğini gösterir. Aday sıra vermediyse veya program dolmadıysa null.
   */
  siraFarki: number | null;
  /** Bursluluk düşüldükten sonra öğrencinin fiilen ödeyeceği yıllık ücret. */
  odenecekUcret: number | null;
};

/**
 * Kılavuzdaki `ucret`, bursluluktan bağımsız tam liste fiyatıdır: aynı bölümün
 * Burslu, %50 İndirimli ve Ücretli kontenjanları hep aynı sayıyı taşır. Ham
 * hâliyle göstermek "Burslu · 990.000 TL" gibi yanlış bir bilgi üretir, bu
 * yüzden burada bursluluk oranı düşülür.
 */
function odenecekUcretHesapla(ucret: number | null, burs: string | null): number | null {
  if (ucret === null || ucret <= 0) return null;
  if (burs === "Burslu") return 0;
  if (burs === "%50 İndirimli") return Math.round(ucret * 0.5);
  if (burs === "%25 İndirimli") return Math.round(ucret * 0.75);
  return ucret;
}

/**
 * Türkçe'ye duyarlı, büyük-küçük harf farkını yok sayan arama anahtarı.
 * Dışa açık, çünkü `tarihce.ts` de üniversite adını aynı kuralla eşleştirmek
 * zorunda: iki ayrı normalize mantığı, "Boğaziçi" burada bulunup orada
 * bulunmadığında sessizce ayrışırdı.
 */
export function anahtar(metin: string | null | undefined): string {
  if (!metin) return "";
  return metin.toLocaleLowerCase("tr").replace(/[İIıi]/g, "i").replace(/\s+/g, " ").trim();
}

/**
 * Programın metin alanlarının normalize hâli. Kılavuz verisi şehir ve
 * üniversite adlarını BÜYÜK HARF tutuyor; kullanıcı "Ankara" yazdığında da
 * eşleşmesi gerektiği için karşılaştırma bu indeks üzerinden yapılır. Dosya
 * bir kez okunduğu için indeks de bir kez kurulur.
 */
type Indeks = { uni: string; bolum: string; grup: string; il: string; burs: string; ogretim: string; hepsi: string };

let onbellek: { programlar: Program[]; indeks: Indeks[] } | null = null;

function veri(): { programlar: Program[]; indeks: Indeks[] } {
  if (!onbellek) {
    const yol = join(process.cwd(), "data", "programlar.json");
    const programlar = JSON.parse(readFileSync(yol, "utf8")) as Program[];
    const indeks = programlar.map((p) => {
      const uni = anahtar(p.uni);
      const bolum = anahtar(p.bolum);
      const grup = anahtar(p.grup);
      return {
        uni, bolum, grup,
        il: anahtar(p.il),
        burs: anahtar(p.burs ?? ""),
        ogretim: anahtar(p.ogretim),
        hepsi: `${uni} ${bolum} ${grup}`,
      };
    });
    onbellek = { programlar, indeks };
  }
  return onbellek;
}

/**
 * Kılavuzun tamamı, salt okunur. Tüm kayıtları tarayan katmanlar (istatistik.ts)
 * için; dosya başındaki "programlar.json'ı okuyan tek yer burasıdır" kuralını
 * bozmadan aynı önbelleğe ortak olurlar.
 */
export function tumProgramlar(): readonly Program[] {
  return veri().programlar;
}

export type Filtre = {
  puanTuru?: PuanTuru;
  /** Üniversite ve bölüm adında geçen serbest metin. */
  q?: string;
  il?: string[];
  uni?: string[];
  grup?: string[];
  burs?: string[];
  ogretim?: string[];
  uniTur?: UniTuru[];
  duzey?: Duzey;
  /** Doldurulursa her programa bu puana göre risk etiketi hesaplanır. */
  yerlestirmePuani?: number;
  /**
   * Adayın YKS başarı sırası. Doldurulursa risk taban PUAN yerine taban
   * SIRA üzerinden hesaplanır — bkz. `riskHesapla`.
   */
  basariSirasi?: number;
  /** Yalnızca adayın puanının yettiği ya da sınırda olduğu programlar. */
  sadeceUlasilabilir?: boolean;
  risk?: Risk[];
  siralama?: "taban-desc" | "taban-asc" | "yakinlik" | "kontenjan-desc" | "sira-asc" | "sira-desc";
  sayfa?: number;
  sayfaBoyu?: number;
};

/** Taban puana bu kadar puan fark, güvenli/sınırda ayrımının eşiği. */
const SINIR_ESIGI = 6;

/*
 * Sıra tabanlı riskin eşikleri, taban sıranın çarpanı olarak.
 *
 * Neden oran, neden sabit bir pay değil: 480 bininci sırada 10 bin sıra fark
 * gürültüdür, 500'üncü sırada felakettir. Payın sıranın büyüklüğüyle ölçeklenmesi
 * gerekir.
 *
 * Neden 0,90 ve 1,15: aday geçen yılın tablosuna bakarak bu yılın tercihini
 * yapıyor, ama bir programın taban sırası yerleştirme yılları arasında kayıyor
 * (data/tarihce.json'daki üç yıllık seri bunu doğrudan gösteriyor — kontenjan
 * değişiyor, yeni programlar açılıyor, sınavın zorluğu oynuyor). Yani "geçen
 * yılın tabanı" bu yılın tabanı değil, onun gürültülü bir tahmini:
 *  - %10 daha iyi sırada olan aday (s ≤ t × 0,90) bu kaymayı soğurur → güvenli.
 *  - %15 daha kötüye kadar olan aday (s ≤ t × 1,15) taban kendi lehine kayarsa
 *    hâlâ yerleşebilir → sınırda.
 * Üst pay alt paydan geniş tutuldu: tercih listesinde bir programı gereksiz
 * yere "zor" diye elemenin bedeli, gereksiz yere "sınırda" göstermekten yüksek.
 */
const SIRA_GUVENLI_ORANI = 0.9;
const SIRA_SINIR_ORANI = 1.15;

/**
 * Bir programın risk etiketi.
 *
 * Aday hem puan hem sıra verdiyse SIRA kazanır: sıra alanını doldurmak bilinçli
 * bir tercihtir (kullanıcı ÖSYM'nin yayımladığı kendi başarı sırasını biliyor
 * demektir) ve sıra puandan daha kararlı bir ölçüdür — puan, o yılın sınav
 * zorluğuna ve OBP katkısına bağlıdır, sıra ise doğrudan adayın kaçıncı olduğunu
 * söyler. Yine de puan verilmişse `puanFarki` hesaplanmaya devam eder; arayüz
 * risk sıradan gelirken bile puan farkını gösterebilsin.
 */
function riskHesapla(program: Program, yerlestirmePuani?: number, basariSirasi?: number) {
  const puanFarki =
    yerlestirmePuani === undefined || program.tabanPuan === null
      ? null
      : Math.round((yerlestirmePuani - program.tabanPuan) * 10) / 10;

  // Küçük sıra daha iyi; pozitif fark = aday tabanın önünde.
  const siraFarki =
    basariSirasi === undefined || program.tabanSira === null
      ? null
      : program.tabanSira - basariSirasi;

  if (basariSirasi !== undefined) {
    if (program.tabanSira === null) return { risk: "bilinmiyor" as Risk, puanFarki, siraFarki };
    const risk: Risk =
      basariSirasi <= program.tabanSira * SIRA_GUVENLI_ORANI
        ? "guvenli"
        : basariSirasi <= program.tabanSira * SIRA_SINIR_ORANI
          ? "sinirda"
          : "zor";
    return { risk, puanFarki, siraFarki };
  }

  if (puanFarki === null) return { risk: "bilinmiyor" as Risk, puanFarki, siraFarki };
  const risk: Risk = puanFarki >= SINIR_ESIGI ? "guvenli" : puanFarki >= -SINIR_ESIGI ? "sinirda" : "zor";
  return { risk, puanFarki, siraFarki };
}

export type AramaSonucu = {
  toplam: number;
  sayfa: number;
  sayfaBoyu: number;
  sayaclar: Record<Risk, number>;
  programlar: ProgramSonucu[];
};

export function ara(filtre: Filtre): AramaSonucu {
  const {
    puanTuru, q, il, uni, grup, burs, ogretim, uniTur, duzey,
    yerlestirmePuani, basariSirasi, sadeceUlasilabilir, risk,
    siralama = "taban-desc", sayfa = 1, sayfaBoyu = 50,
  } = filtre;

  const aranan = q ? anahtar(q) : null;
  /*
   * Metin filtreleri tam eşleşme değil, normalize edilmiş içerme ile çalışır:
   * kılavuz "ANKARA" yazıyor, kullanıcı "Ankara" yazıyor; bölüm kutusuna
   * "bilgisayar" yazan biri "Bilgisayar Mühendisliği"ni bulabilmeli.
   */
  const metin = (dizi: string[] | undefined) =>
    dizi && dizi.length ? dizi.map(anahtar).filter(Boolean) : null;
  const ilAra = metin(il);
  const uniAra = metin(uni);
  const grupAra = metin(grup);
  const bursAra = metin(burs);
  const ogretimAra = metin(ogretim);

  const kume = <T,>(dizi: T[] | undefined) => (dizi && dizi.length ? new Set(dizi) : null);
  const uniTurKume = kume(uniTur);
  const riskKume = kume(risk);

  const herhangi = (adaylar: string[] | null, deger: string) =>
    !adaylar || adaylar.some((a) => deger.includes(a));

  /*
   * Sayaçlar risk ve "ulaşılabilir" filtrelerinden ÖNCE toplanır. Aksi hâlde
   * varsayılan açık olan "puanımın yettikleri" yüzünden Zor çipi hep 0 gösterir
   * ve bir riske tıklandığında diğer çiplerin sayısı sıfırlanırdı.
   */
  const sayaclar: Record<Risk, number> = { guvenli: 0, sinirda: 0, zor: 0, bilinmiyor: 0 };
  const eslesen: ProgramSonucu[] = [];

  // Bir risk açıkça seçildiyse "ulaşılabilir" kısıtı geçersizdir: "Zor"a basan
  // kişi zaten puanının yetmediklerini görmek istiyordur.
  const ulasilabilirUygula = sadeceUlasilabilir && !riskKume;

  const { programlar, indeks } = veri();
  for (let i = 0; i < programlar.length; i += 1) {
    const program = programlar[i];
    const n = indeks[i];

    if (puanTuru && program.puanTuru !== puanTuru) continue;
    if (duzey && program.duzey !== duzey) continue;
    if (uniTurKume && !uniTurKume.has(program.uniTur)) continue;
    if (!herhangi(ilAra, n.il)) continue;
    if (!herhangi(uniAra, n.uni)) continue;
    if (!herhangi(grupAra, n.grup)) continue;
    if (!herhangi(bursAra, n.burs)) continue;
    if (!herhangi(ogretimAra, n.ogretim)) continue;
    if (aranan && !n.hepsi.includes(aranan)) continue;

    const { risk: programRiski, puanFarki, siraFarki } = riskHesapla(program, yerlestirmePuani, basariSirasi);
    sayaclar[programRiski] += 1;

    if (ulasilabilirUygula && (programRiski === "zor" || programRiski === "bilinmiyor")) continue;
    if (riskKume && !riskKume.has(programRiski)) continue;

    eslesen.push({
      ...program,
      risk: programRiski,
      puanFarki,
      siraFarki,
      odenecekUcret: odenecekUcretHesapla(program.ucret, program.burs),
    });
  }

  // Taban puanı/sırası olmayan (dolmamış) programlar her sıralamada sona düşer.
  const sonaAt = (a: ProgramSonucu, b: ProgramSonucu) =>
    Number(a.tabanPuan === null) - Number(b.tabanPuan === null);
  const sonaAtSira = (a: ProgramSonucu, b: ProgramSonucu) =>
    Number(a.tabanSira === null) - Number(b.tabanSira === null);

  // "Yakınlık" hangi ölçüye yakınlık? Aday sıra moduna geçtiyse sıraya.
  const siraModu = basariSirasi !== undefined;

  const siralayicilar: Record<string, (a: ProgramSonucu, b: ProgramSonucu) => number> = {
    "taban-desc": (a, b) => sonaAt(a, b) || (b.tabanPuan ?? 0) - (a.tabanPuan ?? 0),
    "taban-asc": (a, b) => sonaAt(a, b) || (a.tabanPuan ?? 0) - (b.tabanPuan ?? 0),
    // Küçük sıra = daha seçici program; "sira-asc" en seçiciyi başa alır.
    "sira-asc": (a, b) => sonaAtSira(a, b) || (a.tabanSira ?? 0) - (b.tabanSira ?? 0),
    "sira-desc": (a, b) => sonaAtSira(a, b) || (b.tabanSira ?? 0) - (a.tabanSira ?? 0),
    "kontenjan-desc": (a, b) => b.kontenjan - a.kontenjan,
    yakinlik: (a, b) =>
      siraModu
        ? sonaAtSira(a, b) || Math.abs(a.siraFarki ?? 1e12) - Math.abs(b.siraFarki ?? 1e12)
        : sonaAt(a, b) || Math.abs(a.puanFarki ?? 1e9) - Math.abs(b.puanFarki ?? 1e9),
  };

  eslesen.sort(siralayicilar[siralama] ?? siralayicilar["taban-desc"]);

  const boyut = Math.min(200, Math.max(1, sayfaBoyu));
  const sayfaNo = Math.max(1, sayfa);
  const baslangic = (sayfaNo - 1) * boyut;

  return {
    toplam: eslesen.length,
    sayfa: sayfaNo,
    sayfaBoyu: boyut,
    sayaclar,
    programlar: eslesen.slice(baslangic, baslangic + boyut),
  };
}

/**
 * Sorgu dizesini filtreye çevirir. Bilinmeyen ya da bozuk değerler sessizce
 * atılır; arama her zaman bir sonuç döndürmelidir.
 */
export function filtreCoz(params: URLSearchParams): Filtre {
  const cok = (ad: string) => {
    const deger = params.getAll(ad).flatMap((v) => v.split(",")).filter(Boolean);
    return deger.length ? deger : undefined;
  };
  const sayi = (ad: string) => {
    /*
     * Boş alan önce elenir: `params.get()` yoksa null döner ve Number(null) 0'dır.
     * Ham hâliyle "puan verilmedi" ile "puan 0" ayırt edilemezdi — ve `sira` için
     * bunun bedeli ağır: sıra modu her istekte kendiliğinden açılır, puan tabanlı
     * risk hesabı hiç çalışmazdı.
     */
    const ham = params.get(ad)?.trim();
    if (!ham) return undefined;
    const v = Number(ham);
    return Number.isFinite(v) ? v : undefined;
  };

  const puanTuru = params.get("puanTuru");
  const duzey = params.get("duzey");
  const siralama = params.get("siralama");

  return {
    puanTuru: isPuanTuru(puanTuru) ? puanTuru : undefined,
    q: params.get("q")?.trim() || undefined,
    il: cok("il"),
    uni: cok("uni"),
    grup: cok("grup"),
    burs: cok("burs"),
    ogretim: cok("ogretim"),
    uniTur: cok("uniTur") as UniTuru[] | undefined,
    duzey: duzey === "lisans" || duzey === "onlisans" ? duzey : undefined,
    yerlestirmePuani: sayi("puan"),
    basariSirasi: sayi("sira"),
    sadeceUlasilabilir: params.get("ulasilabilir") === "1",
    risk: cok("risk") as Risk[] | undefined,
    siralama: (["taban-desc", "taban-asc", "yakinlik", "kontenjan-desc", "sira-asc", "sira-desc"] as const)
      .find((s) => s === siralama),
    sayfa: sayi("sayfa"),
    sayfaBoyu: sayi("boyut"),
  };
}
