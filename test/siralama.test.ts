/**
 * Başarı sırası ile arama — gerçek `data/programlar.json` üzerinde.
 *
 * Sıra modunun puan modundan iki farkı var ve ikisi de burada sınanıyor:
 * risk oransal eşiklerle hesaplanır, ve aday hem puan hem sıra verdiğinde
 * risk SIRADAN gelir.
 *
 * Proje kökünden çalıştırılmalıdır; veri dosyası process.cwd() üzerinden okunur.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { ara, filtreCoz } from "../app/lib/veri.ts";

/** `veri.ts`'teki eşiklerin aynısı; testin bağımsız kopyası. */
const GUVENLI = 0.9;
const SINIR = 1.15;

test("sıra verilince risk taban SIRA üzerinden hesaplanır", () => {
  const sira = 50_000;
  const sonuc = ara({ puanTuru: "SAY", basariSirasi: sira, sayfaBoyu: 200 });

  for (const p of sonuc.programlar) {
    if (p.tabanSira === null) {
      assert.equal(p.risk, "bilinmiyor", `${p.kod}: taban sırası yoksa risk bilinmez`);
      assert.equal(p.siraFarki, null);
      continue;
    }

    assert.equal(p.siraFarki, p.tabanSira - sira, `${p.kod}: siraFarki = taban − aday`);
    const beklenen =
      sira <= p.tabanSira * GUVENLI ? "guvenli" : sira <= p.tabanSira * SINIR ? "sinirda" : "zor";
    assert.equal(p.risk, beklenen, `${p.kod}: taban ${p.tabanSira}, aday ${sira}`);
  }
});

test("risk sınırları tam eşik değerlerinde doğru tarafa düşer", () => {
  // Gerçek bir programı seçip adayın sırasını eşiklere göre kurguluyoruz.
  const ornek = ara({ puanTuru: "SAY", siralama: "sira-asc", sayfaBoyu: 200 }).programlar
    .find((p) => p.tabanSira !== null && p.tabanSira > 1000);
  assert.ok(ornek, "taban sırası olan bir program bulunmalı");

  const taban = ornek!.tabanSira!;
  const kod = ornek!.kod;
  const riskiniAl = (sira: number) => {
    const bulunan = ara({ puanTuru: "SAY", basariSirasi: sira, sayfaBoyu: 200, siralama: "sira-asc" })
      .programlar.find((p) => p.kod === kod);
    assert.ok(bulunan, `program ${kod} sonuçta olmalı`);
    return bulunan!.risk;
  };

  // Eşikler kapsayıcıdır: tam sınırdaki aday iyi tarafta kalır.
  assert.equal(riskiniAl(Math.floor(taban * GUVENLI)), "guvenli", "t×0,90'da güvenli");
  assert.equal(riskiniAl(Math.floor(taban * GUVENLI) + 1), "sinirda", "eşiğin bir üstü sınırda");
  assert.equal(riskiniAl(Math.floor(taban * SINIR)), "sinirda", "t×1,15'te hâlâ sınırda");
  assert.equal(riskiniAl(Math.ceil(taban * SINIR) + 1), "zor", "üst eşiğin üstü zor");
});

test("hem puan hem sıra verilirse risk sıradan gelir, puan farkı yine hesaplanır", () => {
  /*
   * Kurgu: puanı çok yüksek (her şey "güvenli" görünürdü), sırası çok kötü.
   * Sıra kazanıyorsa risk "zor"a düşmeli.
   */
  const temel = { puanTuru: "SAY" as const, sayfaBoyu: 200, siralama: "taban-desc" as const };
  const puan = 560;
  // YKS'ye giren aday sayısından da büyük: hiçbir programın tabanı bunu geçemez.
  const kotuSira = 10_000_000;

  const sadecePuan = ara({ ...temel, yerlestirmePuani: puan });
  const ikisi = ara({ ...temel, yerlestirmePuani: puan, basariSirasi: kotuSira });

  assert.ok(sadecePuan.sayaclar.guvenli > 0, "yalnız puanla güvenli programlar olmalı");
  assert.equal(ikisi.sayaclar.guvenli, 0, "sıra kötüyken hiçbir program güvenli olmamalı");

  const tabanliOlan = ikisi.programlar.find((p) => p.tabanSira !== null && p.tabanPuan !== null);
  assert.ok(tabanliOlan, "hem tabanı hem sırası olan program bulunmalı");
  assert.equal(tabanliOlan!.risk, "zor");
  assert.notEqual(tabanliOlan!.puanFarki, null, "puan farkı yine de dolu kalmalı");
  assert.equal(tabanliOlan!.siraFarki, tabanliOlan!.tabanSira! - kotuSira);
});

test("yalnız puan verilirse eski davranış hiç değişmez", () => {
  const puan = 400;
  const sonuc = ara({ puanTuru: "SAY", yerlestirmePuani: puan, sayfaBoyu: 200 });

  for (const p of sonuc.programlar) {
    assert.equal(p.siraFarki, null, "sıra verilmediyse sıra farkı da yok");
    if (p.tabanPuan === null) {
      assert.equal(p.risk, "bilinmiyor");
      continue;
    }
    const beklenen = p.puanFarki! >= 6 ? "guvenli" : p.puanFarki! >= -6 ? "sinirda" : "zor";
    assert.equal(p.risk, beklenen);
  }
});

test("sıra sıralamaları küçükten büyüğe ve tersine düzenler", () => {
  const artan = ara({ puanTuru: "EA", siralama: "sira-asc", sayfaBoyu: 100 }).programlar
    .filter((p) => p.tabanSira !== null);
  assert.ok(artan.length > 1, "sıralanacak program bulunmalı");
  for (let i = 1; i < artan.length; i += 1) {
    assert.ok(artan[i].tabanSira! >= artan[i - 1].tabanSira!);
  }

  const azalan = ara({ puanTuru: "EA", siralama: "sira-desc", sayfaBoyu: 100 }).programlar
    .filter((p) => p.tabanSira !== null);
  for (let i = 1; i < azalan.length; i += 1) {
    assert.ok(azalan[i].tabanSira! <= azalan[i - 1].tabanSira!);
  }
});

test("taban sırası olmayan programlar sıra sıralamalarında sona düşer", () => {
  const programlar = ara({ puanTuru: "TYT", siralama: "sira-asc", sayfaBoyu: 200 }).programlar;
  const ilkBos = programlar.findIndex((p) => p.tabanSira === null);
  if (ilkBos !== -1) {
    assert.ok(programlar.slice(ilkBos).every((p) => p.tabanSira === null));
  }
});

test("sıra modunda yakınlık sıralaması sıraya göre yakınlaşır", () => {
  const sira = 120_000;
  const programlar = ara({
    puanTuru: "SAY", basariSirasi: sira, siralama: "yakinlik", sayfaBoyu: 50,
  }).programlar.filter((p) => p.siraFarki !== null);

  assert.ok(programlar.length > 1);
  for (let i = 1; i < programlar.length; i += 1) {
    assert.ok(Math.abs(programlar[i].siraFarki!) >= Math.abs(programlar[i - 1].siraFarki!));
  }
});

test("ulaşılabilir filtresi sıra modunda da çalışır", () => {
  const sira = 200_000;
  const temel = { puanTuru: "SAY" as const, basariSirasi: sira, sayfaBoyu: 200 };
  const hepsi = ara(temel);
  const ulasilabilir = ara({ ...temel, sadeceUlasilabilir: true });

  assert.ok(ulasilabilir.toplam < hepsi.toplam);
  assert.ok(ulasilabilir.programlar.every((p) => p.risk === "guvenli" || p.risk === "sinirda"));
  assert.ok(ulasilabilir.programlar.every((p) => sira <= p.tabanSira! * SINIR));
});

test("filtreCoz sıra parametresini çözer ve boş bırakılınca sıra moduna geçmez", () => {
  assert.equal(filtreCoz(new URLSearchParams("sira=45000")).basariSirasi, 45_000);
  assert.equal(filtreCoz(new URLSearchParams("sira=abc")).basariSirasi, undefined);

  // Eksik alan 0 sayılırsa sıra modu her istekte kendiliğinden açılırdı.
  const bos = filtreCoz(new URLSearchParams("puanTuru=SAY"));
  assert.equal(bos.basariSirasi, undefined);
  assert.equal(bos.yerlestirmePuani, undefined);

  assert.equal(filtreCoz(new URLSearchParams("siralama=sira-asc")).siralama, "sira-asc");
  assert.equal(filtreCoz(new URLSearchParams("siralama=sira-desc")).siralama, "sira-desc");
  assert.equal(filtreCoz(new URLSearchParams("siralama=olmayan")).siralama, undefined);
});
