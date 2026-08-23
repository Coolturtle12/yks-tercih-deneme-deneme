/**
 * Toplu istatistiklerin testleri — gerçek `data/programlar.json` üzerinde.
 *
 * Buradaki asıl soru "sayı doğru mu" değil, "sayı KAYBOLUYOR mu": bir harita
 * ya da özet tablosu, kılavuzdaki her programı ya bir şehre ya da açıkça
 * "koordinatsız" kutusuna koymalı. Sessizce düşen kayıt, arayüzde fark
 * edilmesi en zor hatadır.
 *
 * Proje kökünden çalıştırılmalıdır; veri dosyası process.cwd() üzerinden okunur.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { IL_KOORDINATLARI, ozet, sehirDagilimi, ucNoktalar } from "../app/lib/istatistik.ts";
import { tumProgramlar } from "../app/lib/veri.ts";
import { MODEL, PUAN_TURLERI } from "../app/lib/yks.ts";

const BOLGELER = new Set([
  "Marmara", "Ege", "Akdeniz", "İç Anadolu",
  "Karadeniz", "Doğu Anadolu", "Güneydoğu Anadolu",
  "KKTC", "Yurt Dışı",
]);

test("şehir dağılımı kılavuzdaki her programı ve her kontenjanı taşır", () => {
  const hepsi = tumProgramlar();
  const { sehirler, koordinatsiz } = sehirDagilimi();

  const topla = <T,>(dizi: readonly T[], al: (x: T) => number) => dizi.reduce((s, x) => s + al(x), 0);

  assert.equal(
    topla(sehirler, (s) => s.programSayisi) + topla(koordinatsiz, (k) => k.programSayisi),
    hepsi.length,
    "şehirler + koordinatsızlar = kılavuzun tamamı",
  );
  assert.equal(
    topla(sehirler, (s) => s.kontenjanToplami) + topla(koordinatsiz, (k) => k.kontenjanToplami),
    topla(hepsi, (p) => p.kontenjan),
    "kontenjan toplamı da korunmalı",
  );

  // Liste program sayısına göre azalan olmalı — harita etiketleri buna dayanıyor.
  for (let i = 1; i < sehirler.length; i += 1) {
    assert.ok(sehirler[i].programSayisi <= sehirler[i - 1].programSayisi);
  }
});

test("programlar.json'daki her il adının koordinatı var", () => {
  const iller = [...new Set(tumProgramlar().map((p) => p.il))].filter((il) => il !== null);
  const eksik = iller.filter((il) => !IL_KOORDINATLARI[il!]);
  assert.deepEqual(eksik, [], "koordinat tablosu kılavuzdaki illeri karşılamalı");

  for (const [il, k] of Object.entries(IL_KOORDINATLARI)) {
    assert.ok(BOLGELER.has(k.bolge), `${il}: tanınmayan bölge ${k.bolge}`);
    // Türkiye ve komşuluğu; kaba bir kutu bile ondalık/işaret hatasını yakalar.
    assert.ok(k.lat > 35 && k.lat < 45, `${il}: enlem aralık dışı (${k.lat})`);
    assert.ok(k.lon > 18 && k.lon < 45, `${il}: boylam aralık dışı (${k.lon})`);
  }
});

test("koordinatsız kutusuna yalnızca şehri bildirilmemiş programlar düşer", () => {
  const { koordinatsiz } = sehirDagilimi();
  const sehirsiz = tumProgramlar().filter((p) => p.il === null);

  assert.ok(koordinatsiz.every((k) => k.il === null), "adı olan hiçbir il koordinatsız kalmamalı");
  assert.equal(
    koordinatsiz.reduce((s, k) => s + k.programSayisi, 0),
    sehirsiz.length,
    "yurt dışı kampüsler kılavuzda şehir bildirmiyor",
  );
});

test("bir şehrin uç programları gerçekten o şehrin uçları", () => {
  const { sehirler } = sehirDagilimi("SAY");
  const hepsi = tumProgramlar();

  for (const sehir of sehirler.slice(0, 10)) {
    const oSehir = hepsi.filter((p) => p.il === sehir.il && p.puanTuru === "SAY" && p.tabanPuan !== null);
    if (!oSehir.length) {
      assert.equal(sehir.enYuksekTaban, null);
      continue;
    }
    const puanlar = oSehir.map((p) => p.tabanPuan!);
    assert.equal(sehir.enYuksekTaban!.puan, Math.max(...puanlar), `${sehir.il}: en yüksek`);
    assert.equal(sehir.enDusukTaban!.puan, Math.min(...puanlar), `${sehir.il}: en düşük`);
    assert.ok(oSehir.some((p) => p.kod === sehir.enYuksekTaban!.kod), "kod gerçek bir programı göstermeli");
  }
});

test("şehir dağılımı puan türüne ve düzeye göre süzülür", () => {
  const hepsi = sehirDagilimi();
  const say = sehirDagilimi("SAY");
  const onlisans = sehirDagilimi(undefined, "onlisans");

  const toplam = (d: ReturnType<typeof sehirDagilimi>) =>
    d.sehirler.reduce((s, x) => s + x.programSayisi, 0)
    + d.koordinatsiz.reduce((s, x) => s + x.programSayisi, 0);

  assert.equal(toplam(say), MODEL.programSayilari.SAY);
  assert.ok(toplam(onlisans) > 0 && toplam(onlisans) < toplam(hepsi));
});

test("uç noktalar sırasıyla en yüksek ve en düşük tabanları verir", () => {
  const { enYuksek, enDusuk, dolmayan } = ucNoktalar("SAY", undefined, 15);
  const dolmus = tumProgramlar()
    .filter((p) => p.puanTuru === "SAY" && p.tabanPuan !== null)
    .map((p) => p.tabanPuan!)
    .sort((a, b) => a - b);

  assert.equal(enYuksek.length, 15);
  assert.equal(enDusuk.length, 15);

  assert.equal(enYuksek[0].tabanPuan, dolmus[dolmus.length - 1], "listenin başı kılavuzun tepesi");
  assert.equal(enDusuk[0].tabanPuan, dolmus[0], "listenin başı kılavuzun dibi");

  for (let i = 1; i < enYuksek.length; i += 1) {
    assert.ok(enYuksek[i].tabanPuan! <= enYuksek[i - 1].tabanPuan!, "en yüksek listesi azalan");
    assert.ok(enDusuk[i].tabanPuan! >= enDusuk[i - 1].tabanPuan!, "en düşük listesi artan");
  }

  // Dolmayanlar "puanı düşük" değil "puanı olmayan" programlar; karışmamalılar.
  assert.ok(enDusuk.every((p) => p.tabanPuan !== null));
  assert.ok(dolmayan.every((p) => p.tabanPuan === null && p.tabanSira === null));
  assert.ok(dolmayan.length <= 15);
});

test("özet, kılavuzun kendi toplamlarıyla tutar", () => {
  const hepsi = tumProgramlar();
  const o = ozet();

  assert.equal(o.toplamProgram, hepsi.length);
  assert.equal(o.toplamKontenjan, hepsi.reduce((s, p) => s + p.kontenjan, 0));
  assert.equal(o.universiteSayisi, new Set(hepsi.map((p) => p.uni)).size);
  assert.equal(o.ilSayisi, new Set(hepsi.filter((p) => p.il).map((p) => p.il)).size);
  assert.equal(o.devlet, hepsi.filter((p) => p.uniTur === "DEVLET").length);
  assert.equal(o.vakif, hepsi.filter((p) => p.uniTur === "VAKIF").length);

  // Ortalama taban, kılavuzdaki puan aralığının içinde kalmalı.
  assert.ok(o.ortalamaTaban! > 100 && o.ortalamaTaban! < 560);

  // Puan türü kırılımları model.json'daki sayılarla aynı olmalı.
  for (const { id } of PUAN_TURLERI) {
    assert.equal(ozet(id).toplamProgram, MODEL.programSayilari[id], `${id} program sayısı`);
  }
});

test("istatistikler önbellekten aynı nesneyi döndürür", () => {
  // Aynı sonucu ikinci kez hesaplamak 21,5 bin kaydı yeniden taramak demek.
  assert.equal(sehirDagilimi("EA"), sehirDagilimi("EA"));
  assert.equal(ozet("EA"), ozet("EA"));
  assert.equal(ucNoktalar("EA"), ucNoktalar("EA"));
  assert.notEqual(ozet("EA"), ozet("SÖZ"));
});
