/**
 * Taban puan tarihçesinin testleri — gerçek `data/tarihce.json` üzerinde.
 *
 * Tarihçenin tek işi doğru yıla doğru sayıyı bağlamak; bir kayma (dizinin
 * yanlış ucundan okumak, boş yılı 0 saymak) grafikte "bu üniversite 2023'te
 * zirve yaptı" gibi tamamen yanlış ama makul görünen bir cümle üretir. Testler
 * bu yüzden hizalamaya odaklanıyor.
 *
 * Proje kökünden çalıştırılmalıdır; veri dosyası process.cwd() üzerinden okunur.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  programTarihcesi,
  turkiyeOrtalamalari,
  universiteTarihcesi,
  yilSerisi,
  yillar,
  zirveyeGoreUniversiteler,
} from "../app/lib/tarihce.ts";

test("tarihçe üç yılı artan sırada kapsar", () => {
  const y = yillar();
  assert.ok(y.length >= 2, "karşılaştırma için en az iki yıl gerekli");
  for (let i = 1; i < y.length; i += 1) assert.ok(y[i] > y[i - 1], "yıllar artan olmalı");
});

test("bilinen bir programın serisi YÖK Atlas'ın verdiği tabanlarla aynı", () => {
  // İstanbul Medipol · Tıp (İngilizce) (Burslu) — üç yılda da dolmuş bir program.
  const t = programTarihcesi(203110477);
  assert.ok(t, "program tarihçede bulunmalı");

  assert.deepEqual(t!.yillar, [2023, 2024, 2025]);
  assert.deepEqual(t!.puanlar, [555.36, 554.92, 551.13]);
  assert.equal(t!.zirveYil, 2023, "en yüksek taban ilk yıldaydı");
  assert.equal(t!.degisim, Math.round((551.13 - 555.36) * 100) / 100);
  assert.ok(t!.degisim! < 0, "taban gerilemiş");
});

test("olmayan kılavuz kodu null döner", () => {
  assert.equal(programTarihcesi(1), null);
});

test("programın zirve yılı serideki maksimumu gösterir", () => {
  // Rastgele değil, "en yüksek ortalamalı" üniversitelerin programları gibi
  // ilginç uçlar da dahil olsun diye geniş bir örnek taranıyor.
  const kodlar = [203110477, 203910699, 101110784, 111610864];
  for (const kod of kodlar) {
    const t = programTarihcesi(kod);
    if (!t) continue;

    const dolu = t.puanlar.filter((p) => p !== null) as number[];
    assert.equal(
      t.puanlar[t.yillar.indexOf(t.zirveYil!)],
      Math.max(...dolu),
      `${kod}: zirve yılı en yüksek puanı göstermeli`,
    );
  }
});

test("üniversite tarihçesinde zirve yılı ortalamaların maksimumudur", () => {
  for (const kayit of zirveyeGoreUniversiteler(undefined, 40)) {
    const t = universiteTarihcesi(kayit.uni);
    assert.ok(t, `${kayit.uni} bulunmalı`);

    const dolu = t!.ortalamalar.filter((o) => o !== null) as number[];
    assert.equal(t!.zirveOrtalama, Math.max(...dolu), `${kayit.uni}: zirve ortalaması`);
    assert.equal(
      t!.ortalamalar[t!.yillar.indexOf(t!.zirveYil!)],
      t!.zirveOrtalama,
      `${kayit.uni}: zirve yılı ile ortalama aynı hücreyi göstermeli`,
    );
    assert.equal(t!.programSayilari.length, t!.yillar.length);
    assert.equal(t!.turkiyeOrtalamalari.length, t!.yillar.length);
  }
});

test("üniversite adı Türkçe büyük/küçük harf farkını yok sayar", () => {
  const kanonik = universiteTarihcesi("BOĞAZİÇİ ÜNİVERSİTESİ (İSTANBUL)");
  assert.ok(kanonik, "kılavuz yazımıyla bulunmalı");

  for (const yazim of ["boğaziçi üniversitesi (istanbul)", "Boğaziçi Üniversitesi (İstanbul)"]) {
    const t = universiteTarihcesi(yazim);
    assert.ok(t, `${yazim} bulunmalı`);
    assert.equal(t!.uni, kanonik!.uni, "hepsi aynı kanonik ada çözülmeli");
    assert.deepEqual(t!.ortalamalar, kanonik!.ortalamalar);
  }

  assert.equal(universiteTarihcesi("olmayan üniversite"), null);
});

test("puan türü verilince seri ve zirve o tür için yeniden hesaplanır", () => {
  const genel = universiteTarihcesi("BOĞAZİÇİ ÜNİVERSİTESİ (İSTANBUL)");
  const say = universiteTarihcesi("BOĞAZİÇİ ÜNİVERSİTESİ (İSTANBUL)", "SAY");
  assert.ok(genel && say);

  assert.notDeepEqual(say!.ortalamalar, genel!.ortalamalar, "tür süzgeci seriyi değiştirmeli");
  const dolu = say!.ortalamalar.filter((o) => o !== null) as number[];
  assert.equal(say!.zirveOrtalama, Math.max(...dolu), "zirve genelden değil SAY serisinden");
  assert.deepEqual(say!.turkiyeOrtalamalari, turkiyeOrtalamalari("SAY"));
});

test("zirveye göre liste azalan ve istenen uzunlukta", () => {
  const liste = zirveyeGoreUniversiteler(undefined, 10);
  assert.equal(liste.length, 10);
  // Sıralama son yılın ortalamasına göre; zirve ayrı bir bilgi olarak taşınır.
  for (let i = 1; i < liste.length; i += 1) {
    assert.ok(liste[i].ortalama! <= liste[i - 1].ortalama!);
  }
  assert.ok(liste.every((k) => k.zirveYil !== null && yillar().includes(k.zirveYil!)));
  assert.ok(liste.every((k) => k.zirveOrtalama !== null && k.zirveOrtalama >= k.ortalama!));
  assert.ok(liste.every((k) => k.ortalama !== null && k.programSayisi > 0));

  // Puan türü süzgeci listeyi değiştirmeli; o türde programı olmayan düşer.
  const dil = zirveyeGoreUniversiteler("DİL", 10);
  assert.ok(dil.length > 0);
  assert.notDeepEqual(dil.map((k) => k.uni), liste.map((k) => k.uni));
});

test("Türkiye ortalaması her yıl için dolu ve makul aralıkta", () => {
  for (const puanTuru of [undefined, "SAY", "EA", "SÖZ", "DİL", "TYT"] as const) {
    const seri = turkiyeOrtalamalari(puanTuru);
    assert.equal(seri.length, yillar().length, `${puanTuru ?? "genel"}: yıl sayısı`);
    assert.ok(seri.every((o) => o !== null && o > 100 && o < 560), `${puanTuru ?? "genel"}: aralık`);
  }
});

test("yilSerisi diziyi grafiklerin beklediği çiftlere çevirir", () => {
  const seri = yilSerisi(turkiyeOrtalamalari());
  assert.deepEqual(seri.map((n) => n.yil), yillar());
  assert.ok(seri.every((n) => typeof n.deger === "number"));

  // Kısa dizi verilirse eksik yıllar null olur, kaybolmaz.
  assert.deepEqual(
    yilSerisi([1], [2023, 2024]),
    [{ yil: 2023, deger: 1 }, { yil: 2024, deger: null }],
  );
});
