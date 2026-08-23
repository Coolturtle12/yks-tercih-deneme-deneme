/**
 * Puan modelinin testleri.
 *
 * En önemlisi ilk blok: model, YÖK Atlas'ın gerçek kayıtlarına karşı sınanır.
 * `data/dogrulama.json`, `scripts/veri-cek.mjs` içindeki %80/%20 bölmesinde
 * ayrılan kümeden alınmış örneklerdir — yani katsayılar bu kayıtların
 * çoğunluğuna değil, kardeşlerine bakılarak çözüldü.
 *
 * Not: yayımlanan katsayılar en sonunda tüm veriye oturtulur, dolayısıyla bu
 * dosyadaki ölçüm yansız bir genelleme tahmini DEĞİLDİR; amacı, modelde bir
 * gerileme olduğunda testin kırmızıya dönmesidir. Yansız sayı, model.json
 * içindeki `dogrulamaRmse` alanıdır.
 *
 * Çalıştırma:  npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import dogrulama from "../data/dogrulama.json" with { type: "json" };
import {
  BOS_CEVAPLAR,
  LISANS_BARAJI,
  MODEL,
  ORNEK_CEVAPLAR,
  PUAN_TURLERI,
  TESTS,
  cevapGuncelle,
  hesapla,
  netOf,
  netlerdenHamPuan,
  normalizeAnswer,
  testById,
  testsFor,
  type PuanTuru,
} from "../app/lib/yks.ts";

type DogrulamaKaydi = { puanTuru: PuanTuru; beklenen: number; netler: Record<string, number> };
const kayitlar = dogrulama as unknown as DogrulamaKaydi[];

test("model, ayrılmış gerçek kayıtları kendi ölçülen hatası içinde tahmin eder", () => {
  const puanTurleri = [...new Set(kayitlar.map((k) => k.puanTuru))];
  assert.ok(puanTurleri.length >= 4, "doğrulama kümesi puan türlerini kapsamalı");

  for (const puanTuru of puanTurleri) {
    const kume = kayitlar.filter((k) => k.puanTuru === puanTuru);
    const kareToplam = kume.reduce(
      (s, k) => s + (netlerdenHamPuan(k.netler, puanTuru) - k.beklenen) ** 2,
      0,
    );
    const rmse = Math.sqrt(kareToplam / kume.length);
    const tavan = MODEL.puanTurleri[puanTuru].dogrulamaRmse * 1.5 + 1;

    assert.ok(
      rmse <= tavan,
      `${puanTuru}: örneklem RMSE ${rmse.toFixed(2)} > tavan ${tavan.toFixed(2)}`,
    );
  }
});

test("her puan türü, kendi net alanlarının tümü için katsayı taşır", () => {
  for (const { id } of PUAN_TURLERI) {
    const alanlar = MODEL.netAlanlari[id];
    const katsayilar = MODEL.puanTurleri[id].katsayilar;

    for (const alan of alanlar) {
      assert.ok(Number.isFinite(katsayilar[alan]), `${id}/${alan} katsayısı yok`);
      assert.ok(katsayilar[alan] > 0, `${id}/${alan} katsayısı pozitif olmalı`);
      assert.ok(testById(alan), `${id}/${alan} için test tanımı yok`);
    }
    assert.equal(testsFor(id).length, alanlar.length);
  }
});

test("net = doğru − yanlış/4 ve negatif olabilir", () => {
  assert.equal(netOf(20, 4), 19);
  assert.equal(netOf(40, 0), 40);
  // Gerçek YÖK Atlas verisinde net dökümlerinin %6,7'si negatif.
  assert.equal(netOf(0, 40), -10);
  assert.equal(netOf(0, 19), -4.75);
});

test("çok yanlış yapılan test, boş bırakılmış testten daha düşük puan verir", () => {
  const turkce = testById("tytTrkNet")!;
  const bos = hesapla(BOS_CEVAPLAR, "TYT");
  const cokYanlis = hesapla(
    cevapGuncelle(BOS_CEVAPLAR, turkce, "yanlis", "40"),
    "TYT",
  );

  assert.ok(
    cokYanlis.hamPuan < bos.hamPuan || bos.hamPuan === 100,
    `40 yanlış (${cokYanlis.hamPuan}) boş kâğıttan (${bos.hamPuan}) düşük olmalı`,
  );
  assert.equal(cokYanlis.toplamNet, -10);
});

test("doğru ile yanlış toplamı testin soru sayısını aşamaz", () => {
  const turkce = testById("tytTrkNet")!;

  assert.deepEqual(normalizeAnswer(turkce, { dogru: 30, yanlis: 8 }), { dogru: 30, yanlis: 8, bos: 2 });
  assert.deepEqual(normalizeAnswer(turkce, { dogru: 35, yanlis: 20 }), { dogru: 35, yanlis: 5, bos: 0 });
  assert.deepEqual(normalizeAnswer(turkce, { dogru: 99, yanlis: 0 }), { dogru: 40, yanlis: 0, bos: 0 });
  assert.deepEqual(normalizeAnswer(turkce, undefined), { dogru: 0, yanlis: 0, bos: 40 });
  assert.deepEqual(normalizeAnswer(turkce, { dogru: -5, yanlis: 3 }), { dogru: 0, yanlis: 3, bos: 37 });
});

test("sıralama eğrisi monotondur: puan arttıkça sıra küçülür", () => {
  for (const { id } of PUAN_TURLERI) {
    const egri = MODEL.puanTurleri[id].siraEgrisi;
    assert.ok(egri.length >= 10, `${id} eğrisi çok kısa`);

    for (let i = 1; i < egri.length; i += 1) {
      assert.ok(egri[i][0] < egri[i - 1][0], `${id}: puan çapaları azalan sırada olmalı`);
      assert.ok(egri[i][1] > egri[i - 1][1], `${id}: puan düşerken sıra artmalı`);
    }
  }
});

test("daha yüksek net, daha iyi (küçük) bir sıralama verir", () => {
  const dusuk = hesapla(BOS_CEVAPLAR, "SAY");
  const yuksek = hesapla(ORNEK_CEVAPLAR, "SAY");

  assert.ok(yuksek.hamPuan > dusuk.hamPuan);
  assert.ok(yuksek.siralama < dusuk.siralama);
});

test("diploma notu yerleştirme puanını değiştirir, sıralamayı değiştirmez", () => {
  const dusukObp = hesapla(ORNEK_CEVAPLAR, "SAY", { diplomaNotu: 55, ekPuan: false });
  const yuksekObp = hesapla(ORNEK_CEVAPLAR, "SAY", { diplomaNotu: 98, ekPuan: false });

  assert.ok(yuksekObp.yerlestirmePuani > dusukObp.yerlestirmePuani);
  assert.equal(yuksekObp.hamPuan, dusukObp.hamPuan);
  assert.equal(yuksekObp.siralama, dusukObp.siralama, "başarı sırası sınav puanından gelir");
});

test("meslek lisesi ek puanı OBP katsayısını 0,18'e çıkarır", () => {
  const normal = hesapla(ORNEK_CEVAPLAR, "TYT", { diplomaNotu: 80, ekPuan: false });
  const ekPuanli = hesapla(ORNEK_CEVAPLAR, "TYT", { diplomaNotu: 80, ekPuan: true });

  assert.equal(normal.obpKatsayisi, 0.12);
  assert.equal(ekPuanli.obpKatsayisi, 0.18);
  assert.equal(ekPuanli.obp, 400);
  assert.ok(ekPuanli.obpKatkisi > normal.obpKatkisi);
});

test("puanlar tanımlı sınırların dışına çıkmaz", () => {
  const tumuDogru: Record<string, { dogru: number; yanlis: number }> = Object.fromEntries(
    TESTS.map((t) => [t.id, { dogru: t.count, yanlis: 0 }]),
  );

  for (const { id } of PUAN_TURLERI) {
    const enIyi = hesapla(tumuDogru, id, { diplomaNotu: 100, ekPuan: true });
    const enKotu = hesapla(BOS_CEVAPLAR, id, { diplomaNotu: 50, ekPuan: false });

    assert.ok(enIyi.hamPuan <= 500, `${id} ham puan 500'ü aşamaz`);
    assert.ok(enIyi.yerlestirmePuani <= 560, `${id} yerleştirme puanı 560'ı aşamaz`);
    assert.ok(enKotu.hamPuan >= 100, `${id} ham puan 100'ün altına inemez`);
    assert.ok(enIyi.siralama >= 1);
  }
});

test("boş cevap kâğıdı barajı geçmez", () => {
  const bos = hesapla(BOS_CEVAPLAR, "SAY");

  assert.equal(bos.barajGecti, false);
  assert.equal(bos.barajEsigi, LISANS_BARAJI);
});

test("modelin gördüğü aralığın dışına çıkan puan işaretlenir", () => {
  const tumuDogru: Record<string, { dogru: number; yanlis: number }> = Object.fromEntries(
    TESTS.map((t) => [t.id, { dogru: t.count, yanlis: 0 }]),
  );

  // Tam net, kılavuzdaki hiçbir programın taban adayının ulaşmadığı bir puandır.
  assert.equal(hesapla(tumuDogru, "SAY").aralikDisinda, true);

  // Kalibrasyon aralığının ortasındaki bir sonuç ise uyarı üretmemeli.
  const [alt, ust] = MODEL.puanTurleri.SAY.kalibrasyonAraligi;
  const ortadaki = hesapla(ORNEK_CEVAPLAR, "SAY");
  assert.ok(ortadaki.hamPuan > alt && ortadaki.hamPuan < ust);
  assert.equal(ortadaki.aralikDisinda, false);
});

test("hesaba yalnızca puan türünün kendi testleri girer", () => {
  const sadeceEdebiyat = { aytTdeNet: { dogru: 24, yanlis: 0 } };

  // Edebiyat SAY'a girmez, SÖZ'e girer.
  assert.equal(hesapla(sadeceEdebiyat, "SAY").hamPuan, hesapla({}, "SAY").hamPuan);
  assert.ok(hesapla(sadeceEdebiyat, "SÖZ").hamPuan > hesapla({}, "SÖZ").hamPuan);
});

test("kırpma karşı alanı korur, veri silmez", () => {
  const turkce = testById("tytTrkNet")!;
  const baslangic = { tytTrkNet: { dogru: 32, yanlis: 5 } };

  // Yanlışa 44444 yazmak doğruyu silmez; yanlış kalan yere (8) kırpılır.
  assert.deepEqual(cevapGuncelle(baslangic, turkce, "yanlis", "44444").tytTrkNet,
    { dogru: 32, yanlis: 8 });

  // Doğruya 100 yazmak yanlışı silmez.
  assert.deepEqual(cevapGuncelle(baslangic, turkce, "dogru", "100").tytTrkNet,
    { dogru: 35, yanlis: 5 });

  // Toplam sığıyorsa hiçbir şey kırpılmaz.
  assert.deepEqual(cevapGuncelle(baslangic, turkce, "dogru", "20").tytTrkNet,
    { dogru: 20, yanlis: 5 });
});

test("ardışık tuş vuruşları karşı alanı aşındırmaz", () => {
  const turkce = testById("tytTrkNet")!;
  let durum: Record<string, { dogru: number; yanlis: number }> = { tytTrkNet: { dogru: 32, yanlis: 5 } };

  // Kullanıcı yanlış kutusuna "44444" yazarken her tuşta bir güncelleme olur.
  for (const ara of ["4", "44", "444", "4444", "44444"]) {
    durum = cevapGuncelle(durum, turkce, "yanlis", ara) as typeof durum;
    assert.equal(durum.tytTrkNet.dogru, 32, `"${ara}" yazılırken doğru değişmemeli`);
  }
  assert.deepEqual(durum.tytTrkNet, { dogru: 32, yanlis: 8 });
});

test("kırpılmış cevapta doğru + yanlış + boş her zaman soru sayısını verir", () => {
  for (const test of TESTS) {
    for (const deger of ["99999", "0", "7", "-40", "abc", ""]) {
      for (const alan of ["dogru", "yanlis"] as const) {
        const sonuc = cevapGuncelle({}, test, alan, deger);
        const { dogru, yanlis, bos } = normalizeAnswer(test, sonuc[test.id]);

        assert.ok(dogru >= 0 && yanlis >= 0 && bos >= 0, `${test.id}/${alan}/${deger} negatif`);
        assert.equal(dogru + yanlis + bos, test.count, `${test.id}/${alan}/${deger} toplamı bozuk`);
      }
    }
  }
});

test("bozuk bir kayıt yeni girdiyi negatife çekmez", () => {
  const turkce = testById("tytTrkNet")!;
  // Eski bir taslakta kalmış, soru sayısını aşan bir değer.
  const bozuk = { tytTrkNet: { dogru: 0, yanlis: 99999 } };

  // Yanlış önce 40'a kırpılır; kalan yer olmadığı için doğru 0'da kalır.
  assert.deepEqual(cevapGuncelle(bozuk, turkce, "dogru", "10").tytTrkNet, { dogru: 0, yanlis: 40 });
});

test("sayı olmayan ya da boş girdi sıfır sayılır, diğer alanı bozmaz", () => {
  const turkce = testById("tytTrkNet")!;
  const baslangic = { tytTrkNet: { dogru: 20, yanlis: 8 } };

  for (const bozuk of ["", "abc", "-7"]) {
    assert.deepEqual(cevapGuncelle(baslangic, turkce, "dogru", bozuk).tytTrkNet, { dogru: 0, yanlis: 8 });
  }
});

test("cevapGuncelle diğer testlere dokunmaz", () => {
  const turkce = testById("tytTrkNet")!;
  const baslangic = { tytTrkNet: { dogru: 1, yanlis: 1 }, tytMatNet: { dogru: 24, yanlis: 4 } };

  const sonuc = cevapGuncelle(baslangic, turkce, "dogru", "30");
  assert.deepEqual(sonuc.tytMatNet, { dogru: 24, yanlis: 4 });
  assert.notEqual(sonuc, baslangic, "yeni bir nesne döndürmeli");
});

test("sıralama aralığı gerçek sıralamayı içine alır ve doğru yönlüdür", () => {
  for (const { id } of PUAN_TURLERI) {
    const sonuc = hesapla(ORNEK_CEVAPLAR, id);
    const [enIyi, enKotu] = sonuc.siralamaAraligi;

    assert.ok(enIyi <= sonuc.siralama, `${id}: aralık alt ucu sıralamadan büyük`);
    assert.ok(enKotu >= sonuc.siralama, `${id}: aralık üst ucu sıralamadan küçük`);
    assert.ok(enIyi >= 1);
  }
});
