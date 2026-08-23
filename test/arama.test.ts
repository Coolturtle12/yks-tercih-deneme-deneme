/**
 * Program arama katmanının testleri — gerçek `data/programlar.json` üzerinde.
 *
 * Proje kökünden çalıştırılmalıdır; veri dosyası process.cwd() üzerinden okunur.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { ara, filtreCoz } from "../app/lib/veri.ts";
import { MODEL } from "../app/lib/yks.ts";

test("filtresiz arama, kılavuzun tamamını görür", () => {
  const sonuc = ara({ sayfaBoyu: 1 });
  const beklenen = Object.values(MODEL.programSayilari).reduce((a, b) => a + b, 0);

  assert.equal(sonuc.toplam, beklenen);
  assert.equal(sonuc.programlar.length, 1, "sayfa boyu sonuç sayısını sınırlar");
});

test("puan türü filtresi, model.json'daki program sayılarıyla tutar", () => {
  for (const [puanTuru, adet] of Object.entries(MODEL.programSayilari)) {
    const sonuc = ara({ puanTuru: puanTuru as never, sayfaBoyu: 1 });
    assert.equal(sonuc.toplam, adet, `${puanTuru} sayısı uyuşmuyor`);
  }
});

test("risk etiketi, adayın puanı ile taban puan farkından gelir", () => {
  const puan = 400;
  const sonuc = ara({ puanTuru: "SAY", yerlestirmePuani: puan, sayfaBoyu: 200 });

  for (const program of sonuc.programlar) {
    if (program.tabanPuan === null) {
      assert.equal(program.risk, "bilinmiyor");
      assert.equal(program.puanFarki, null);
      continue;
    }

    assert.equal(program.puanFarki, Math.round((puan - program.tabanPuan) * 10) / 10);
    const beklenen = program.puanFarki! >= 6 ? "guvenli" : program.puanFarki! >= -6 ? "sinirda" : "zor";
    assert.equal(program.risk, beklenen);
  }
});

test("puan verilmezse hiçbir programa risk atanmaz", () => {
  const sonuc = ara({ puanTuru: "EA", sayfaBoyu: 50 });

  assert.equal(sonuc.sayaclar.guvenli, 0);
  assert.equal(sonuc.sayaclar.zor, 0);
  assert.ok(sonuc.programlar.every((p) => p.risk === "bilinmiyor"));
});

test("ulaşılabilir filtresi, puanın yetmediği programları eler", () => {
  const puan = 350;
  const hepsi = ara({ puanTuru: "SAY", yerlestirmePuani: puan, sayfaBoyu: 200 });
  const ulasilabilir = ara({
    puanTuru: "SAY", yerlestirmePuani: puan, sadeceUlasilabilir: true, sayfaBoyu: 200,
  });

  assert.ok(ulasilabilir.toplam < hepsi.toplam);
  assert.ok(ulasilabilir.programlar.every((p) => p.risk === "guvenli" || p.risk === "sinirda"));
  assert.ok(ulasilabilir.programlar.every((p) => p.tabanPuan! <= puan + 6));
});

test("serbest metin araması Türkçe büyük/küçük harf farkını yok sayar", () => {
  const kucuk = ara({ q: "boğaziçi", sayfaBoyu: 1 });
  const buyuk = ara({ q: "BOĞAZİÇİ", sayfaBoyu: 1 });

  assert.ok(kucuk.toplam > 0, "arama sonuç döndürmeli");
  assert.equal(kucuk.toplam, buyuk.toplam);
});

test("sıralamalar istenen düzeni üretir", () => {
  const azalan = ara({ puanTuru: "SAY", siralama: "taban-desc", sayfaBoyu: 50 }).programlar
    .filter((p) => p.tabanPuan !== null);
  for (let i = 1; i < azalan.length; i += 1) {
    assert.ok(azalan[i].tabanPuan! <= azalan[i - 1].tabanPuan!);
  }

  const yakin = ara({
    puanTuru: "SAY", yerlestirmePuani: 420, siralama: "yakinlik", sayfaBoyu: 50,
  }).programlar.filter((p) => p.puanFarki !== null);
  for (let i = 1; i < yakin.length; i += 1) {
    assert.ok(Math.abs(yakin[i].puanFarki!) >= Math.abs(yakin[i - 1].puanFarki!));
  }
});

test("taban puanı olmayan programlar listenin sonuna düşer", () => {
  const programlar = ara({ puanTuru: "TYT", siralama: "taban-desc", sayfaBoyu: 200 }).programlar;
  const ilkBos = programlar.findIndex((p) => p.tabanPuan === null);

  if (ilkBos !== -1) {
    assert.ok(programlar.slice(ilkBos).every((p) => p.tabanPuan === null));
  }
});

test("sayfalama çakışmaz ve boşluk bırakmaz", () => {
  const filtre = { puanTuru: "EA" as const, siralama: "taban-desc" as const, sayfaBoyu: 20 };
  const birinci = ara({ ...filtre, sayfa: 1 });
  const ikinci = ara({ ...filtre, sayfa: 2 });

  assert.equal(birinci.programlar.length, 20);
  assert.equal(birinci.toplam, ikinci.toplam, "toplam sayfaya göre değişmemeli");

  const kodlar = new Set(birinci.programlar.map((p) => p.kod));
  assert.ok(ikinci.programlar.every((p) => !kodlar.has(p.kod)), "sayfalar örtüşmemeli");
});

test("filtreCoz bozuk değerleri sessizce atar", () => {
  const cozulen = filtreCoz(new URLSearchParams("puanTuru=OLMAYAN&duzey=xyz&puan=abc&sayfa=3"));

  assert.equal(cozulen.puanTuru, undefined);
  assert.equal(cozulen.duzey, undefined);
  assert.equal(cozulen.yerlestirmePuani, undefined);
  assert.equal(cozulen.sayfa, 3);
});

test("filtreCoz virgülle ayrılmış çoklu değerleri açar", () => {
  const cozulen = filtreCoz(new URLSearchParams("il=ANKARA,İZMİR&uniTur=DEVLET&q=%20tıp%20"));

  assert.deepEqual(cozulen.il, ["ANKARA", "İZMİR"]);
  assert.deepEqual(cozulen.uniTur, ["DEVLET"]);
  assert.equal(cozulen.q, "tıp", "boşluklar kırpılır");
});

test("ödenecek ücret bursluluk oranına göre düşülür", () => {
  const sonuc = ara({ sayfaBoyu: 200, q: "koç üniversitesi" });
  const ucretliler = sonuc.programlar.filter((p) => p.ucret);
  assert.ok(ucretliler.length > 0, "ücretli program bulunmalı");

  for (const p of ucretliler) {
    if (p.burs === "Burslu") {
      assert.equal(p.odenecekUcret, 0, `${p.bolum}: burslu öğrenci ücret ödemez`);
    } else if (p.burs === "%50 İndirimli") {
      assert.equal(p.odenecekUcret, Math.round(p.ucret! * 0.5));
    } else if (p.burs === "%25 İndirimli") {
      assert.equal(p.odenecekUcret, Math.round(p.ucret! * 0.75));
    } else {
      assert.equal(p.odenecekUcret, p.ucret);
    }
    assert.ok(p.odenecekUcret! <= p.ucret!, "ödenecek tutar liste fiyatını aşamaz");
  }
});

test("ücreti olmayan programlarda ödenecek tutar da yoktur", () => {
  const devlet = ara({ uniTur: ["DEVLET"], sayfaBoyu: 200 }).programlar;
  assert.ok(devlet.every((p) => p.ucret || p.odenecekUcret === null));
});

test("metin filtreleri büyük/küçük harf ve kısmi yazımı kabul eder", () => {
  // Kılavuz şehirleri BÜYÜK HARF tutuyor; kullanıcı "Ankara" yazar.
  const buyuk = ara({ puanTuru: "SAY", il: ["ANKARA"], sayfaBoyu: 1 });
  assert.ok(buyuk.toplam > 0);
  for (const yazim of ["Ankara", "ankara", "aNkArA"]) {
    assert.equal(ara({ puanTuru: "SAY", il: [yazim], sayfaBoyu: 1 }).toplam, buyuk.toplam, yazim);
  }

  // Bölüm kutusuna kısmi yazan biri de sonuç görmeli.
  const kismi = ara({ puanTuru: "SAY", grup: ["bilgisayar"], sayfaBoyu: 1 });
  const tam = ara({ puanTuru: "SAY", grup: ["Bilgisayar Mühendisliği"], sayfaBoyu: 1 });
  assert.ok(tam.toplam > 0, "tam ad sonuç vermeli");
  assert.ok(kismi.toplam >= tam.toplam, "kısmi yazım en az tam ad kadar sonuç vermeli");

  // Üniversite adında da aynı kural.
  assert.ok(ara({ uni: ["boğaziçi"], sayfaBoyu: 1 }).toplam > 0);
});

test("risk sayaçları risk ve ulaşılabilirlik filtrelerinden etkilenmez", () => {
  const temel = { puanTuru: "SAY" as const, yerlestirmePuani: 404.2, sayfaBoyu: 1 };
  const hepsi = ara(temel).sayaclar;

  assert.ok(hepsi.zor > 0, "zor programlar sayılmalı");

  // Varsayılan açık olan "puanımın yettikleri" sayaçları bozmamalı.
  assert.deepEqual(ara({ ...temel, sadeceUlasilabilir: true }).sayaclar, hepsi);

  // Bir riske tıklamak diğerlerinin sayısını sıfırlamamalı.
  assert.deepEqual(ara({ ...temel, risk: ["guvenli"] }).sayaclar, hepsi);
  assert.deepEqual(ara({ ...temel, risk: ["zor"] }).sayaclar, hepsi);
});

test("açıkça risk seçmek ulaşılabilirlik kısıtını geçersiz kılar", () => {
  const filtre = {
    puanTuru: "SAY" as const, yerlestirmePuani: 404.2,
    sadeceUlasilabilir: true, risk: ["zor" as const], sayfaBoyu: 50,
  };
  const sonuc = ara(filtre);

  assert.ok(sonuc.toplam > 0, "'Zor' seçilince sonuç gelmeli");
  assert.ok(sonuc.programlar.every((p) => p.risk === "zor"));
});

test("şehri olmayan yurt dışı programları arama katmanını çökertmez", () => {
  const yurtDisi = ara({ uniTur: ["YURTDIŞI"], sayfaBoyu: 200 });

  assert.ok(yurtDisi.toplam > 0, "yurt dışı program bulunmalı");
  assert.ok(yurtDisi.programlar.some((p) => p.il === null), "şehirsiz kayıt olmalı");
  // Şehir filtresi bu kayıtları elemeli, ama hata vermemeli.
  assert.equal(ara({ uniTur: ["YURTDIŞI"], il: ["ankara"], sayfaBoyu: 1 }).toplam, 0);
});
