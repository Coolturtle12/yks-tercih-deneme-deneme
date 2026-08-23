/**
 * YKS puan ve sıralama modeli.
 *
 * Katsayılar elle yazılmaz. `scripts/veri-cek.mjs`, YÖK Atlas'ın yayımladığı
 * gerçek (net vektörü, taban puan, OBP, katsayı) kayıtlarından en küçük kareler
 * ile çözer ve `data/model.json` içine yazar. Bu dosya o modeli uygular.
 *
 * Model neyi doğru yapar:
 *  - Net = doğru − yanlış / 4 (bir testin neti negatif olabilir)
 *  - Ham (sınav) puanı = sabit + Σ (net × katsayı), 100–500 arasına kırpılır
 *  - Yerleştirme puanı = ham puan + OBP × katsayı, en çok 560
 *  - Başarı sırası OBP hariç ham puandan; diploma notu sıralamayı değiştirmez
 *  - OBP = diploma notu × 5 (250–500); katsayı 0,12, meslek lisesi ek puanında 0,18
 *
 * Neyi yapamaz: ÖSYM puanı standart puanlar (z-skoru) üzerinden hesaplar ve
 * o yılın sınav istatistiklerine bağlıdır. Bu doğrusal model onun yaklaşığıdır;
 * her puan türü için ölçülmüş hatası MODEL.puanTurleri[...].rmse alanındadır ve
 * arayüzde gösterilir.
 */

import ham from "../../data/model.json" with { type: "json" };

export type PuanTuru = "TYT" | "SAY" | "EA" | "SÖZ" | "DİL";
export type TestGroup = "TYT" | "AYT" | "YDT";

type PuanTuruModeli = {
  sabit: number;
  katsayilar: Record<string, number>;
  n: number;
  rmse: number;
  enBuyukHata: number;
  r2: number;
  /** Katsayılar %80'lik eğitim kümesine oturtulduğunda, ayrılan %20'deki hata. */
  dogrulamaRmse: number;
  dogrulamaN: number;
  kalibrasyonAraligi: [number, number];
  siraEgrisi: [number, number][];
};

type Model = {
  kilavuzYili: number;
  kalibrasyonYili: number;
  obpKatsayisi: number;
  obpEkPuanKatsayisi: number;
  netAlanlari: Record<PuanTuru, string[]>;
  puanTurleri: Record<PuanTuru, PuanTuruModeli>;
  programSayilari: Record<PuanTuru, number>;
  secenekler: {
    universiteler: string[];
    iller: string[];
    gruplar: string[];
    burslar: string[];
    ogretimTurleri: string[];
  };
};

export const MODEL = ham as unknown as Model;

export const KILAVUZ_YILI = MODEL.kilavuzYili;
export const KALIBRASYON_YILI = MODEL.kalibrasyonYili;

/* -------------------------------------------------------------------------- */
/* Sınav yapısı                                                                */
/* -------------------------------------------------------------------------- */

export type Test = {
  /** YÖK Atlas'ın net alan adı — model katsayılarının anahtarı. */
  id: string;
  group: TestGroup;
  label: string;
  short: string;
  count: number;
  note?: string;
};

export const TESTS: Test[] = [
  { id: "tytTrkNet", group: "TYT", label: "Türkçe", short: "TÜR", count: 40 },
  { id: "tytSosNet", group: "TYT", label: "Sosyal Bilimler", short: "SOS", count: 20, note: "Tarih 5 · Coğrafya 5 · Felsefe 5 · Din K. 5" },
  { id: "tytMatNet", group: "TYT", label: "Temel Matematik", short: "MAT", count: 40 },
  { id: "tytFenNet", group: "TYT", label: "Fen Bilimleri", short: "FEN", count: 20, note: "Fizik 7 · Kimya 7 · Biyoloji 6" },

  { id: "aytMatNet", group: "AYT", label: "Matematik", short: "MAT", count: 40 },
  { id: "aytFizNet", group: "AYT", label: "Fizik", short: "FİZ", count: 14 },
  { id: "aytKimNet", group: "AYT", label: "Kimya", short: "KİM", count: 13 },
  { id: "aytBioNet", group: "AYT", label: "Biyoloji", short: "BİY", count: 13 },
  { id: "aytTdeNet", group: "AYT", label: "Türk Dili ve Edebiyatı", short: "EDB", count: 24 },
  { id: "aytTrh1Net", group: "AYT", label: "Tarih-1", short: "TAR1", count: 10 },
  { id: "aytCog1Net", group: "AYT", label: "Coğrafya-1", short: "COĞ1", count: 6 },
  { id: "aytTrh2Net", group: "AYT", label: "Tarih-2", short: "TAR2", count: 11 },
  { id: "aytCog2Net", group: "AYT", label: "Coğrafya-2", short: "COĞ2", count: 11 },
  { id: "aytFelNet", group: "AYT", label: "Felsefe Grubu", short: "FEL", count: 12 },
  { id: "aytDinNet", group: "AYT", label: "Din Kültürü", short: "DİN", count: 6 },

  { id: "ydtYdilNet", group: "YDT", label: "Yabancı Dil", short: "YDT", count: 80 },
];

const TEST_BY_ID = new Map(TESTS.map((test) => [test.id, test]));

export const PUAN_TURLERI: { id: PuanTuru; kod: string; ad: string; alan: string }[] = [
  { id: "TYT", kod: "TYT", ad: "Temel Yeterlilik", alan: "Ön lisans programları" },
  { id: "SAY", kod: "SAY", ad: "Sayısal", alan: "Tıp, mühendislik, fen bilimleri" },
  { id: "EA", kod: "EA", ad: "Eşit Ağırlık", alan: "Hukuk, işletme, psikoloji" },
  { id: "SÖZ", kod: "SÖZ", ad: "Sözel", alan: "Edebiyat, tarih, iletişim, ilahiyat" },
  { id: "DİL", kod: "DİL", ad: "Yabancı Dil", alan: "Mütercim-tercümanlık, dil öğretmenlikleri" },
];

/** ÖSYM'nin yayımladığı yerleştirme barajları (sınav puanı üzerinden). */
export const LISANS_BARAJI = 180;
export const ONLISANS_BARAJI = 150;
export const MAKS_YERLESTIRME = 560;

export const OBP_KATSAYISI = MODEL.obpKatsayisi;
export const OBP_EK_PUAN_KATSAYISI = MODEL.obpEkPuanKatsayisi;

/** Bir puan türünün hesabına giren testler, cevap kâğıdındaki sırayla. */
export function testsFor(puanTuru: PuanTuru): Test[] {
  const alanlar = new Set(MODEL.netAlanlari[puanTuru]);
  return TESTS.filter((test) => alanlar.has(test.id));
}

export function testById(id: string): Test | undefined {
  return TEST_BY_ID.get(id);
}

export function isPuanTuru(value: unknown): value is PuanTuru {
  return typeof value === "string" && value in MODEL.netAlanlari;
}

/* -------------------------------------------------------------------------- */
/* Cevaplar                                                                    */
/* -------------------------------------------------------------------------- */

export type TestAnswer = { dogru: number; yanlis: number };
export type Answers = Record<string, TestAnswer>;

export const BOS_CEVAPLAR: Answers = Object.fromEntries(
  TESTS.map((test) => [test.id, { dogru: 0, yanlis: 0 }]),
);

/** Gerçekçi bir deneme sonucu — "örnek doldur" düğmesi için. */
export const ORNEK_CEVAPLAR: Answers = {
  tytTrkNet: { dogru: 32, yanlis: 5 },
  tytSosNet: { dogru: 15, yanlis: 3 },
  tytMatNet: { dogru: 24, yanlis: 4 },
  tytFenNet: { dogru: 13, yanlis: 4 },
  aytMatNet: { dogru: 21, yanlis: 6 },
  aytFizNet: { dogru: 8, yanlis: 3 },
  aytKimNet: { dogru: 9, yanlis: 2 },
  aytBioNet: { dogru: 10, yanlis: 2 },
  aytTdeNet: { dogru: 17, yanlis: 4 },
  aytTrh1Net: { dogru: 7, yanlis: 2 },
  aytCog1Net: { dogru: 4, yanlis: 1 },
  aytTrh2Net: { dogru: 6, yanlis: 3 },
  aytCog2Net: { dogru: 7, yanlis: 2 },
  aytFelNet: { dogru: 8, yanlis: 2 },
  aytDinNet: { dogru: 4, yanlis: 1 },
  ydtYdilNet: { dogru: 48, yanlis: 12 },
};

function sayi(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function yuvarla(value: number, basamak = 1): number {
  const carpan = 10 ** basamak;
  return Math.round(value * carpan) / carpan;
}

/** Doğru + yanlış toplamı soru sayısını aşamaz; boş kalandan türetilir. */
export function normalizeAnswer(test: Test, answer: TestAnswer | undefined) {
  const dogru = Math.min(test.count, sayi(answer?.dogru));
  const yanlis = Math.min(test.count - dogru, sayi(answer?.yanlis));
  return { dogru, yanlis, bos: test.count - dogru - yanlis };
}

/**
 * Net = doğru − yanlış/4. Sonuç negatif olabilir ve olmalıdır: YÖK Atlas'ın
 * yayımladığı gerçek net dökümlerinin %6,7'si negatif (en düşüğü −8,75). Değeri
 * sıfıra kırpmak, çok yanlış yapan bir testi boş bırakılmış gibi göstererek
 * tahmini puanı şişiriyordu — üstelik model de negatifleri içeren veriye
 * oturtulduğu için kırpma modelle tutarsızdı.
 */
export function netOf(dogru: number, yanlis: number): number {
  return dogru - yanlis / 4;
}

/**
 * Bir testin doğru ya da yanlış sayısını günceller.
 *
 * Kural: doğru + yanlış hiçbir zaman testin soru sayısını aşamaz ve KARŞI ALAN
 * korunur. 40 soruluk teste 32 doğru girilmişken yanlışa 44 yazan biri 8 alır;
 * doğrusu 32'de kalır. Karşı alanı geri çekmek denendi ve kötüydü: "44" yazmak
 * için basılan ara tuş, 32 doğruyu geri dönülmez biçimde siliyordu.
 *
 * Kırpılan değerin kutuda da anında görünmesi gerekir; bunu NetSheet'teki
 * SayiKutusu üstleniyor.
 */
export function cevapGuncelle(
  answers: Answers,
  test: Test,
  alan: "dogru" | "yanlis",
  hamDeger: string | number,
): Answers {
  const mevcut = normalizeAnswer(test, answers[test.id]);
  const diger = alan === "dogru" ? mevcut.yanlis : mevcut.dogru;
  const yazilan = Math.max(0, Math.min(test.count - diger, sayi(hamDeger === "" ? 0 : hamDeger)));

  const guncel: TestAnswer = alan === "dogru"
    ? { dogru: yazilan, yanlis: diger }
    : { dogru: diger, yanlis: yazilan };

  return { ...answers, [test.id]: guncel };
}


/* -------------------------------------------------------------------------- */
/* Başarı sırası                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Ham puandan başarı sırası. Eğri, kılavuzdaki binlerce programın gerçek
 * (taban puan, taban başarı sırası) çiftinden çıkarıldı; çapalar arası
 * logaritmik ara değer alınır, çünkü sıralama puanla üstel davranır.
 */
function tahminiSira(hamPuan: number, puanTuru: PuanTuru): number {
  const egri = MODEL.puanTurleri[puanTuru].siraEgrisi;
  const ilk = egri[0];
  const son = egri[egri.length - 1];
  if (hamPuan >= ilk[0]) return ilk[1];
  if (hamPuan <= son[0]) return son[1];

  for (let i = 0; i < egri.length - 1; i += 1) {
    const [ustPuan, ustSira] = egri[i];
    const [altPuan, altSira] = egri[i + 1];
    if (hamPuan <= ustPuan && hamPuan >= altPuan) {
      const oran = (ustPuan - hamPuan) / (ustPuan - altPuan);
      const log = Math.log(ustSira) + oran * (Math.log(altSira) - Math.log(ustSira));
      return Math.max(1, Math.round(Math.exp(log)));
    }
  }
  return son[1];
}

/* -------------------------------------------------------------------------- */
/* Hesaplama                                                                   */
/* -------------------------------------------------------------------------- */

export type TestSonucu = {
  test: Test;
  dogru: number;
  yanlis: number;
  bos: number;
  net: number;
  /** Bu testin ham puana katkısı (net × katsayı). */
  katki: number;
};

export type ObpGirdisi = { diplomaNotu: number; ekPuan: boolean };

export const VARSAYILAN_OBP: ObpGirdisi = { diplomaNotu: 85, ekPuan: false };

export type Sonuc = {
  puanTuru: PuanTuru;
  testler: TestSonucu[];
  tytNet: number;
  alanNet: number;
  toplamNet: number;
  hamPuan: number;
  /** Modelin sabit terimi; katkıların üzerine eklenir. Dökümde gösterilir. */
  taban: number;
  obp: number;
  obpKatsayisi: number;
  obpKatkisi: number;
  yerlestirmePuani: number;
  siralama: number;
  /** Modelin ±RMSE'lik puan sapmasının sıralamadaki karşılığı [en iyi, en kötü]. */
  siralamaAraligi: [number, number];
  barajEsigi: number;
  barajGecti: boolean;
  /** Ham puan modelin kalibre edildiği aralığın dışındaysa tahmin zayıflar. */
  aralikDisinda: boolean;
  rmse: number;
};

/**
 * Net vektöründen doğrudan ham puan. Cevap dökümünden bağımsız olduğu için
 * modelin ayrılmış doğrulama kümesiyle sınanmasını da bu giriş noktası sağlar.
 */
export function netlerdenHamPuan(netler: Record<string, number>, puanTuru: PuanTuru): number {
  const pt = MODEL.puanTurleri[puanTuru];
  const toplam = MODEL.netAlanlari[puanTuru].reduce(
    (s, alan) => s + (netler[alan] ?? 0) * (pt.katsayilar[alan] ?? 0),
    pt.sabit,
  );
  return yuvarla(Math.min(500, Math.max(100, toplam)), 1);
}

export function hesapla(
  answers: Answers,
  puanTuru: PuanTuru,
  obpGirdisi: ObpGirdisi = VARSAYILAN_OBP,
): Sonuc {
  const pt = MODEL.puanTurleri[puanTuru];
  const kullanilan = testsFor(puanTuru);

  let tytNet = 0;
  let alanNet = 0;
  const netler: Record<string, number> = {};

  const testler: TestSonucu[] = kullanilan.map((test) => {
    const { dogru, yanlis, bos } = normalizeAnswer(test, answers[test.id]);
    const net = netOf(dogru, yanlis);
    const katki = net * (pt.katsayilar[test.id] ?? 0);

    netler[test.id] = net;
    if (test.group === "TYT") tytNet += net;
    else alanNet += net;

    return { test, dogru, yanlis, bos, net: yuvarla(net, 2), katki: yuvarla(katki, 2) };
  });

  const hamPuan = netlerdenHamPuan(netler, puanTuru);

  const diplomaNotu = Math.min(100, Math.max(50, obpGirdisi.diplomaNotu || 50));
  const obp = yuvarla(diplomaNotu * 5, 1);
  const obpKatsayisi = obpGirdisi.ekPuan ? OBP_EK_PUAN_KATSAYISI : OBP_KATSAYISI;
  const obpKatkisi = yuvarla(obp * obpKatsayisi, 1);
  const yerlestirmePuani = yuvarla(Math.min(MAKS_YERLESTIRME, hamPuan + obpKatkisi), 1);

  const barajEsigi = puanTuru === "TYT" ? ONLISANS_BARAJI : LISANS_BARAJI;
  const [altSinir, ustSinir] = pt.kalibrasyonAraligi;

  return {
    puanTuru,
    testler,
    tytNet: yuvarla(tytNet, 2),
    alanNet: yuvarla(alanNet, 2),
    toplamNet: yuvarla(tytNet + alanNet, 2),
    hamPuan,
    taban: yuvarla(pt.sabit, 1),
    obp,
    obpKatsayisi,
    obpKatkisi,
    yerlestirmePuani,
    siralama: tahminiSira(hamPuan, puanTuru),
    siralamaAraligi: [
      tahminiSira(Math.min(500, hamPuan + pt.rmse), puanTuru),
      tahminiSira(Math.max(100, hamPuan - pt.rmse), puanTuru),
    ],
    barajEsigi,
    barajGecti: hamPuan >= barajEsigi,
    aralikDisinda: hamPuan < altSinir || hamPuan > ustSinir,
    rmse: pt.rmse,
  };
}
