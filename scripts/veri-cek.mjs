/**
 * YÖK Atlas'tan gerçek veriyi çeker ve uygulamanın kullandığı dosyaları üretir:
 *
 *   data/programlar.json  — tercih kılavuzundaki tüm programlar, taban puan/sıra dahil
 *   data/model.json       — net → puan katsayıları ve puan → başarı sırası eğrisi
 *   data/dogrulama.json   — eğitime girmeyen kayıtlardan örnekler (testler kullanır)
 *   data/tarihce.json     — program ve üniversite taban puanlarının yıllara göre seyri
 *
 * Katsayılar uydurulmaz: YÖK Atlas'ın yayımladığı gerçek (net vektörü, taban puan,
 * OBP, katsayı) kayıtlarından en küçük kareler ile çözülür. Üretilen model.json
 * her puan türü için ölçülmüş hatayı (RMSE, R², n) da taşır; arayüz bunu gösterir.
 *
 * Çalıştırma:  npm run veri
 */

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const API = "https://yokatlas.yok.gov.tr/api";
const KOK = join(dirname(fileURLToPath(import.meta.url)), "..");
const VERI = join(KOK, "data");

/** Bir puan türünün hesabına giren net alanları — YÖK Atlas'ın alan adlarıyla. */
const NET_ALANLARI = {
  SAY: ["tytTrkNet", "tytSosNet", "tytMatNet", "tytFenNet", "aytMatNet", "aytFizNet", "aytKimNet", "aytBioNet"],
  EA: ["tytTrkNet", "tytSosNet", "tytMatNet", "tytFenNet", "aytMatNet", "aytTdeNet", "aytTrh1Net", "aytCog1Net"],
  SÖZ: ["tytTrkNet", "tytSosNet", "tytMatNet", "tytFenNet", "aytTdeNet", "aytTrh1Net", "aytCog1Net", "aytTrh2Net", "aytCog2Net", "aytFelNet", "aytDinNet"],
  DİL: ["tytTrkNet", "tytSosNet", "tytMatNet", "tytFenNet", "ydtYdilNet"],
  TYT: ["tytTrkNet", "tytSosNet", "tytMatNet", "tytFenNet"],
};

/**
 * OBP katsayıları — net kayıtlarındaki `katsayi` alanından doğrulandı:
 * tüm adaylar için 0,12; meslek lisesi mezununun kendi alanındaki önlisans
 * programlarında 0,18 (ek puan). 2022'de kaldırılan "yerleşen adayın katsayısı
 * yarılanır" kuralı verinin hiçbir yerinde geçmiyor.
 */
const OBP_KATSAYISI = 0.12;
const OBP_EK_PUAN_KATSAYISI = 0.18;

const yuvarla = (v, b) => Math.round(v * 10 ** b) / 10 ** b;

/**
 * YÖK Atlas'ın /netler/search ucu tek istekte ~30 MB döndürüyor ve bağlantı
 * zaman zaman gövdenin ortasında kopuyor (undici: "terminated"). Bu yüzden:
 *  - gövde önce metin olarak sonuna kadar okunur, JSON.parse'ı biz yaparız
 *    (böylece yarım kalan gövde "geçersiz JSON" değil, kopmuş bağlantı olarak
 *    kendi hatasıyla görünür),
 *  - kopan istek artan beklemeyle birkaç kez tekrarlanır.
 * Kalıcı istemci hataları (4xx) tekrarlanmaz; onlar yeniden denemekle düzelmez.
 */
async function getir(yol, govde, denemeHakki = 4) {
  for (let deneme = 1; ; deneme += 1) {
    try {
      const cevap = await fetch(API + yol, {
        method: govde ? "POST" : "GET",
        headers: govde ? { "Content-Type": "application/json" } : undefined,
        body: govde ? JSON.stringify(govde) : undefined,
      });
      if (!cevap.ok) {
        const hata = new Error(`${yol} → HTTP ${cevap.status}`);
        hata.kalici = cevap.status >= 400 && cevap.status < 500;
        throw hata;
      }
      return JSON.parse(await cevap.text());
    } catch (hata) {
      if (hata.kalici || deneme >= denemeHakki) throw hata;
      const bekleme = 1000 * deneme;
      console.warn(`  ${yol} koptu (${hata.message}) — ${bekleme} ms sonra ${deneme + 1}. deneme`);
      await new Promise((devam) => setTimeout(devam, bekleme));
    }
  }
}

/* -------------------------------------------------------------------------- */
/* En küçük kareler                                                            */
/* -------------------------------------------------------------------------- */

/** Kısmi pivotlamalı Gauss eliminasyonu ile A·x = b. */
function coz(A, b) {
  const n = b.length;
  for (let i = 0; i < n; i += 1) {
    let pivot = i;
    for (let r = i + 1; r < n; r += 1) if (Math.abs(A[r][i]) > Math.abs(A[pivot][i])) pivot = r;
    [A[i], A[pivot]] = [A[pivot], A[i]];
    [b[i], b[pivot]] = [b[pivot], b[i]];
    for (let r = i + 1; r < n; r += 1) {
      const f = A[r][i] / A[i][i];
      if (!Number.isFinite(f)) continue;
      for (let c = i; c < n; c += 1) A[r][c] -= f * A[i][c];
      b[r] -= f * b[i];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i -= 1) {
    let s = b[i];
    for (let c = i + 1; c < n; c += 1) s -= A[i][c] * x[c];
    x[i] = s / A[i][i];
  }
  return x;
}

/**
 * Bir puan türü için net → ham puan modelini çözer.
 *
 * Hedef değişken, YÖK Atlas'ın verdiği taban yerleştirme puanından OBP katkısı
 * çıkarılarak elde edilen sınav (ham) puanıdır:  ham = taban − obp × katsayı
 */
function katsayilariCoz(kayitlar, alanlar) {
  const ozellik = (k) => [1, ...alanlar.map((a) => k[a])];
  const m = alanlar.length + 1;
  const A = Array.from({ length: m }, () => new Array(m).fill(0));
  const b = new Array(m).fill(0);

  for (const k of kayitlar) {
    const x = ozellik(k);
    const y = k.tabanPuan - k.obp * k.katsayi;
    for (let i = 0; i < m; i += 1) {
      for (let j = 0; j < m; j += 1) A[i][j] += x[i] * x[j];
      b[i] += x[i] * y;
    }
  }

  const w = coz(A.map((r) => r.slice()), b.slice());

  let kareToplam = 0;
  let enBuyukHata = 0;
  let yToplam = 0;
  let yKareToplam = 0;
  for (const k of kayitlar) {
    const y = k.tabanPuan - k.obp * k.katsayi;
    const tahmin = ozellik(k).reduce((s, v, i) => s + v * w[i], 0);
    const hata = Math.abs(y - tahmin);
    kareToplam += hata * hata;
    if (hata > enBuyukHata) enBuyukHata = hata;
    yToplam += y;
    yKareToplam += y * y;
  }

  const n = kayitlar.length;
  const ortHataKare = kareToplam / n;
  const varyans = yKareToplam / n - (yToplam / n) ** 2;

  // Modelin gözlem gördüğü ham puan aralığı; dışında tahmin ekstrapolasyondur.
  const hamPuanlar = kayitlar.map((k) => k.tabanPuan - k.obp * k.katsayi).sort((a, b) => a - b);

  return {
    sabit: yuvarla(w[0], 4),
    katsayilar: Object.fromEntries(alanlar.map((a, i) => [a, yuvarla(w[i + 1], 4)])),
    n,
    rmse: yuvarla(Math.sqrt(ortHataKare), 3),
    enBuyukHata: yuvarla(enBuyukHata, 2),
    r2: yuvarla(1 - ortHataKare / varyans, 5),
    kalibrasyonAraligi: [
      yuvarla(hamPuanlar[0], 1),
      yuvarla(hamPuanlar[hamPuanlar.length - 1], 1),
    ],
  };
}

/** Bir modelin verilmiş kayıtlar üzerindeki hatası. */
function hataOlc(uyum, kayitlar, alanlar) {
  let kareToplam = 0;
  for (const k of kayitlar) {
    const y = k.tabanPuan - k.obp * k.katsayi;
    const tahmin = uyum.sabit + alanlar.reduce((s, a) => s + k[a] * uyum.katsayilar[a], 0);
    kareToplam += (y - tahmin) ** 2;
  }
  return { rmse: yuvarla(Math.sqrt(kareToplam / kayitlar.length), 3) };
}

/** Tohumlu, tekrarlanabilir karıştırma için basit bir sözde-rastgele üreteç. */
function sahteRastgele(i) {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/* -------------------------------------------------------------------------- */
/* Puan → başarı sırası eğrisi                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Gerçek (ham puan, taban başarı sırası) çiftlerinden monoton bir çapa listesi
 * çıkarır. Kılavuzda binlerce program olduğu için eğri veriden okunur, elle
 * yazılmaz. Aynı kovaya düşen kayıtlar medyanla özetlenir.
 */
function siraEgrisi(ciftler, capaSayisi = 60) {
  const sirali = ciftler.filter(([p, s]) => p > 0 && s > 0).sort((a, b) => b[0] - a[0]);
  if (sirali.length < capaSayisi) return sirali.map(([p, s]) => [yuvarla(p, 2), s]);

  const kovaBoyu = Math.ceil(sirali.length / capaSayisi);
  const capalar = [];
  for (let i = 0; i < sirali.length; i += kovaBoyu) {
    const kova = sirali.slice(i, i + kovaBoyu);
    const puanlar = kova.map(([p]) => p).sort((a, b) => a - b);
    const siralar = kova.map(([, s]) => s).sort((a, b) => a - b);
    capalar.push([
      yuvarla(puanlar[Math.floor(puanlar.length / 2)], 2),
      siralar[Math.floor(siralar.length / 2)],
    ]);
  }

  // Puan azalırken sıra artmalı; veri gürültüsünün eğriyi geri kıvırmasını engelle.
  const monoton = [];
  for (const [puan, sira] of capalar) {
    const onceki = monoton[monoton.length - 1];
    if (onceki && (sira <= onceki[1] || puan >= onceki[0])) continue;
    monoton.push([puan, sira]);
  }
  return monoton;
}

/* -------------------------------------------------------------------------- */
/* Taban puanların yıllara göre seyri                                          */
/* -------------------------------------------------------------------------- */

/**
 * Net kayıtlarında üniversite adı bazı yıllarda fazladan boşlukla geliyor
 * ("HACETTEPE ÜNİVERSİTESİ (ANKARA) "). Budanmazsa aynı kurum iki ayrı
 * üniversite gibi sayılır — ham veride 241, budandığında 230 ad kalıyor.
 */
const adNormalize = (ad) => String(ad ?? "").replace(/\s+/g, " ").trim();

/**
 * /netler/search boş gövdeyle çağrıldığında ÜÇ yılın kaydını birden döner
 * (bugün 2023-2025). Puan modeli yalnızca son yılı kullanır; buradaki iş geri
 * kalan yılları "geçmiş" olarak saklamak: bir programın taban puanı yıllar
 * içinde nereye gitti, bir üniversitenin ortalaması hangi yıl zirve yaptı.
 *
 * Bu tarihçe kılavuzdan (programlar.json) çıkarılamaz — kılavuz yalnızca içinde
 * bulunulan yılı bilir, geçmiş yıllar sadece net kayıtlarında var.
 *
 * Yıl listesi sabit yazılmaz, veriden okunur: YÖK Atlas pencereyi kaydırdığında
 * (2024-2026) betiğin değişmeden çalışması gerekir.
 */
export function tarihceUret(kayitlar) {
  const yillar = [...new Set(kayitlar.map((k) => k.yil))]
    .filter((y) => Number.isFinite(y))
    .sort((a, b) => a - b);
  const yilIndeksi = new Map(yillar.map((y, i) => [y, i]));

  /*
   * Aynı (kılavuz kodu, yıl) çifti veride birebir tekrar edebiliyor (bugün 88
   * kayıt). Tekilleştirilmezse o programlar ortalamaya iki kez girer.
   */
  const tekil = new Map();
  for (const k of kayitlar) {
    if (!(k.tabanPuan > 0) || !yilIndeksi.has(k.yil)) continue;
    tekil.set(`${k.kilavuzKodu}|${k.yil}`, k);
  }

  /*
   * Ortalamalar tek geçişte, alan başına (toplam, adet) biriktirilerek çıkar.
   * "Alan" ya "genel" ya da bir puan türüdür; ikisini aynı kovada tutmak
   * üniversite ve Türkiye toplayıcılarını tek koda indirgiyor.
   */
  const kovaYap = () => new Map();
  const kovayaEkle = (kova, alan, i, puan) => {
    let seri = kova.get(alan);
    if (!seri) {
      seri = { toplam: new Array(yillar.length).fill(0), adet: new Array(yillar.length).fill(0) };
      kova.set(alan, seri);
    }
    seri.toplam[i] += puan;
    seri.adet[i] += 1;
  };
  const kovaCevir = (kova) =>
    Object.fromEntries(
      [...kova].map(([alan, seri]) => [
        alan,
        // Kaydı olmayan yıl 0 değil null: "o yıl ortalama sıfırdı" demek değil.
        seri.toplam.map((t, i) => (seri.adet[i] ? yuvarla(t / seri.adet[i], 2) : null)),
      ]),
    );

  const programlar = {};
  const uniKovalari = new Map();
  const turkiye = kovaYap();

  for (const k of tekil.values()) {
    const i = yilIndeksi.get(k.yil);
    const puan = yuvarla(k.tabanPuan, 2);

    let seri = programlar[k.kilavuzKodu];
    if (!seri) seri = programlar[k.kilavuzKodu] = new Array(yillar.length).fill(null);
    seri[i] = puan;

    kovayaEkle(turkiye, "genel", i, puan);
    if (k.puanTuru) kovayaEkle(turkiye, k.puanTuru, i, puan);

    const uni = adNormalize(k.universiteAdi);
    if (!uni) continue;
    let kova = uniKovalari.get(uni);
    if (!kova) uniKovalari.set(uni, (kova = kovaYap()));
    kovayaEkle(kova, "genel", i, puan);
    if (k.puanTuru) kovayaEkle(kova, k.puanTuru, i, puan);
  }

  const universiteler = {};
  for (const [uni, kova] of uniKovalari) {
    const alanlar = kovaCevir(kova);

    // Zirve yalnızca kaydı olan yıllar arasından seçilir; boş yıl zirve olamaz.
    let zirveYil = null;
    let zirveOrtalama = null;
    alanlar.genel.forEach((deger, i) => {
      if (deger !== null && (zirveOrtalama === null || deger > zirveOrtalama)) {
        zirveOrtalama = deger;
        zirveYil = yillar[i];
      }
    });

    universiteler[uni] = {
      ...alanlar,
      // Ortalamaya giren, yani o yıl taban puanı yayımlanmış program sayısı.
      programSayisi: kova.get("genel").adet.slice(),
      zirveYil,
      zirveOrtalama,
    };
  }

  return { yillar, programlar, universiteler, turkiye: kovaCevir(turkiye) };
}

/* -------------------------------------------------------------------------- */

async function main() {
  console.log("YÖK Atlas'tan veri çekiliyor…");

  const bosFiltre = {
    puanTuru: null, universiteId: [], birimGrupId: [], ilKodu: [], birimTuruId: null,
    universiteTuru: null, bursOraniId: null, ogrenimTuruId: null, kilavuzKodu: null,
    minBasariSirasi: null, maxBasariSirasi: null,
  };

  const [yil, kilavuz, netler] = await Promise.all([
    getir("/parameters/yil"),
    getir("/tercih-kilavuz/search", bosFiltre),
    getir("/netler/search", {}),
  ]);

  console.log(`  kılavuz ${yil}: ${kilavuz.totalElements} program`);
  console.log(`  net kayıtları: ${netler.totalElements}`);

  /* --- Programlar --------------------------------------------------------- */

  const programlar = kilavuz.content
    .filter((p) => p.puanTuru && p.kilavuzKodu)
    .map((p) => ({
      kod: p.kilavuzKodu,
      uni: p.universiteAdi,
      uniTur: p.universiteTuru,
      bolum: p.birimAdi,
      grup: p.birimGrupAdi,
      // Yurt dışı kampüslerde kılavuz şehir bildirmiyor.
      il: p.ilAdi ?? null,
      puanTuru: p.puanTuru,
      duzey: p.birimTuruAdi === "LISANS" ? "lisans" : "onlisans",
      ogretim: p.ogrenimTuruAdi,
      sure: p.ogrenimSuresi,
      burs: p.bursOraniAdi ?? null,
      kontenjan: p.kontenjan ?? 0,
      // Kontenjanı dolmayan programlarda taban puan/sıra yayımlanmaz.
      tabanPuan: p.minPuan > 0 ? yuvarla(p.minPuan, 2) : null,
      tabanSira: p.basariSirasi > 0 ? p.basariSirasi : null,
      ucret: p.ucret ?? null,
    }));

  /* --- Model -------------------------------------------------------------- */

  const sonYil = Math.max(...netler.content.map((k) => k.yil));
  const obpKodBazli = new Map(
    netler.content.filter((k) => k.yil === sonYil && k.obp > 0).map((k) => [k.kilavuzKodu, k.obp]),
  );
  const dogrulamaKumesi = [];
  const model = {
    kilavuzYili: yil,
    kalibrasyonYili: sonYil,
    obpKatsayisi: OBP_KATSAYISI,
    obpEkPuanKatsayisi: OBP_EK_PUAN_KATSAYISI,
    netAlanlari: NET_ALANLARI,
    puanTurleri: {},
  };

  for (const [puanTuru, alanlar] of Object.entries(NET_ALANLARI)) {
    const kayitlar = netler.content.filter(
      (k) => k.yil === sonYil && k.puanTuru === puanTuru && k.tabanPuan > 0
        && alanlar.every((a) => typeof k[a] === "number"),
    );

    /*
     * Katsayılar üretimde tüm kayıtlara oturtulur, ama raporlanan hatanın
     * "kendi verisini ezberlemiş" olmadığını göstermek için ayrıca %80/%20
     * bölünüp ayrılmış kümede ölçülür. Bölme sabit tohumla yapılır ki her
     * çalıştırmada aynı sonuç çıksın.
     */
    const karisik = kayitlar.map((k, i) => [k, sahteRastgele(i)]).sort((a, b) => a[1] - b[1]).map(([k]) => k);
    const sinir = Math.floor(karisik.length * 0.8);
    const egitim = karisik.slice(0, sinir);
    const ayrilan = karisik.slice(sinir);
    const egitimUyumu = katsayilariCoz(egitim, alanlar);
    const dogrulama = hataOlc(egitimUyumu, ayrilan, alanlar);

    const uyum = { ...katsayilariCoz(kayitlar, alanlar), dogrulamaRmse: dogrulama.rmse, dogrulamaN: ayrilan.length };
    dogrulamaKumesi.push(
      ...ayrilan.slice(0, 80).map((k) => ({
        puanTuru,
        beklenen: yuvarla(k.tabanPuan - k.obp * k.katsayi, 2),
        netler: Object.fromEntries(alanlar.map((a) => [a, k[a]])),
      })),
    );

    /*
     * Başarı sırası sınav (ham) puanından açıklanır, kılavuzdaki taban puan ise
     * OBP dahil yerleştirme puanıdır. Eğriyi doğru birimde kurmak için taban
     * puandan o programın taban adayının OBP katkısı düşülür; OBP'yi bir önceki
     * yılın net kayıtları verir (programların ~%93'ü eşleşiyor, gerisi atlanır).
     */
    const ciftler = programlar
      .filter((p) => p.puanTuru === puanTuru && p.tabanPuan && p.tabanSira && obpKodBazli.has(p.kod))
      .map((p) => [p.tabanPuan - obpKodBazli.get(p.kod) * OBP_KATSAYISI, p.tabanSira]);

    model.puanTurleri[puanTuru] = { ...uyum, siraEgrisi: siraEgrisi(ciftler) };
    console.log(
      `  ${puanTuru.padEnd(4)} n=${String(uyum.n).padStart(5)}  RMSE=${uyum.rmse}` +
      `  R²=${uyum.r2}  ayrılan küme RMSE=${uyum.dogrulamaRmse}` +
      `  çapa=${model.puanTurleri[puanTuru].siraEgrisi.length} (${ciftler.length} programdan)`,
    );
  }

  /* --- Filtre seçenekleri ------------------------------------------------- */

  model.programSayilari = Object.fromEntries(
    Object.keys(NET_ALANLARI).map((pt) => [pt, programlar.filter((p) => p.puanTuru === pt).length]),
  );

  const tekil = (alan) =>
    [...new Set(programlar.map((p) => p[alan]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));

  model.secenekler = {
    universiteler: tekil("uni"),
    iller: tekil("il"),
    gruplar: tekil("grup"),
    burslar: tekil("burs"),
    ogretimTurleri: tekil("ogretim"),
  };

  /* --- Tarihçe ------------------------------------------------------------ */

  const tarihce = tarihceUret(netler.content);
  console.log(
    `  tarihçe: ${tarihce.yillar.join("-")} · ` +
    `${Object.keys(tarihce.programlar).length} program, ` +
    `${Object.keys(tarihce.universiteler).length} üniversite`,
  );

  await mkdir(VERI, { recursive: true });
  await writeFile(join(VERI, "programlar.json"), JSON.stringify(programlar));
  // Tarihçe girintisiz yazılır; biçimlendirilmiş hâli dosyayı üçe katlıyor.
  await writeFile(join(VERI, "tarihce.json"), JSON.stringify(tarihce));
  await writeFile(join(VERI, "model.json"), JSON.stringify(model, null, 2));
  await writeFile(join(VERI, "dogrulama.json"), JSON.stringify(dogrulamaKumesi, null, 1));

  console.log(
    `\nyazıldı: data/programlar.json (${programlar.length} program), data/model.json, ` +
    `data/dogrulama.json (${dogrulamaKumesi.length} ayrılmış kayıt), data/tarihce.json`,
  );
}

/*
 * Betik bir modül olarak da içe aktarılabiliyor (tarihceUret'i ağa çıkmadan,
 * elde hazır bir /netler/search yanıtıyla kullanmak için); o durumda main()
 * çalışmamalı, yoksa içe aktarmanın kendisi veri dosyalarını yeniden yazar.
 */
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((hata) => {
    console.error(hata);
    process.exit(1);
  });
}
