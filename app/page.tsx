"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Hesaplayici from "./components/Hesaplayici";
import ProgramBulucu from "./components/ProgramBulucu";
import SehirPanosu from "./components/SehirPanosu";
import SonucPanosu from "./components/SonucPanosu";
import ThemeToggle from "./components/ThemeToggle";
import UcNoktalar from "./components/UcNoktalar";
import UniversiteGecmisi from "./components/UniversiteGecmisi";
import { tam } from "./lib/format";
import {
  BOS_CEVAPLAR,
  KALIBRASYON_YILI,
  KILAVUZ_YILI,
  MODEL,
  ORNEK_CEVAPLAR,
  PUAN_TURLERI,
  VARSAYILAN_OBP,
  cevapGuncelle,
  hesapla,
  testById,
  type Answers,
  type ObpGirdisi,
  type PuanTuru,
  type Sonuc,
} from "./lib/yks";

const TOPLAM_PROGRAM = Object.values(MODEL.programSayilari).reduce((a, b) => a + b, 0);
const UNIVERSITE_SAYISI = MODEL.secenekler.universiteler.length;
const IL_SAYISI = MODEL.secenekler.iller.length;

/** Girilen netlerin tarayıcıda saklandığı anahtar. Biçim değişirse artır. */
const KAYIT_ANAHTARI = "rota.giris.v1";

type Kayit = { puanTuru: PuanTuru; answers: Answers; obp: ObpGirdisi };

const BOLUMLER = [
  { id: "hesapla", ad: "Puan Hesapla" },
  { id: "bul", ad: "Tercih Bul" },
  { id: "grafik", ad: "Taban Puan Geçmişi" },
  { id: "sehir", ad: "Şehir Dağılımı" },
  { id: "uc", ad: "Uç Noktalar" },
];

export default function Home() {
  const [puanTuru, setPuanTuru] = useState<PuanTuru>("SAY");
  const [answers, setAnswers] = useState<Answers>(ORNEK_CEVAPLAR);
  const [obp, setObp] = useState<ObpGirdisi>(VARSAYILAN_OBP);

  /*
   * Girilen veriyi tarayıcıda sakla. Okuma bağlanmadan (mount) sonra yapılır;
   * sunucu render'ı ile aynı çıktıyı üretmek zorunda olduğumuz için ilk render
   * her zaman varsayılanla başlar, kayıt varsa hemen üzerine yazılır.
   */
  /* eslint-disable react-hooks/set-state-in-effect --
     Kuralın engellemek istediği şey, her render'da state'i yeniden eşitleyen
     zincirleme efektler. Buradaki okuma bağlanma anında bir kez çalışır ve
     sunucu render'ıyla uyuşmazlık çıkarmamak için ilk render'dan sonraya
     bırakılmak zorundadır; localStorage sunucuda yoktur. */
  useEffect(() => {
    try {
      const ham = localStorage.getItem(KAYIT_ANAHTARI);
      if (!ham) return;
      const kayit = JSON.parse(ham) as Partial<Kayit>;
      if (kayit.puanTuru && kayit.puanTuru in MODEL.netAlanlari) setPuanTuru(kayit.puanTuru);
      if (kayit.answers && typeof kayit.answers === "object") setAnswers(kayit.answers);
      if (kayit.obp && typeof kayit.obp.diplomaNotu === "number") setObp(kayit.obp);
    } catch {
      // Bozuk ya da erişilemeyen depolama, aracın çalışmasını engellememeli.
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    try {
      localStorage.setItem(KAYIT_ANAHTARI, JSON.stringify({ puanTuru, answers, obp }));
    } catch {
      // Kota dolu ya da gizli sekme; sessizce geç.
    }
  }, [puanTuru, answers, obp]);

  /*
   * Beş puan türünün tamamı aynı cevap kâğıdından hesaplanır — referans sitedeki
   * gibi. Kullanıcının seçtiği tür yalnızca hangi puanın "seçili kart" olacağını
   * ve program aramasının hangi puanla yapılacağını belirler; hesaplama zaten
   * hepsi için yapılmış olur.
   */
  const sonuclar = useMemo(() => {
    const cikti = {} as Record<PuanTuru, Sonuc>;
    for (const tur of PUAN_TURLERI) cikti[tur.id] = hesapla(answers, tur.id, obp);
    return cikti;
  }, [answers, obp]);

  const sonuc = sonuclar[puanTuru];

  const guncelle = useCallback((testId: string, alan: "dogru" | "yanlis", deger: string) => {
    const test = testById(testId);
    if (!test) return;
    setAnswers((mevcut) => cevapGuncelle(mevcut, test, alan, deger));
  }, []);

  const tercihlereGit = useCallback(() => {
    document.getElementById("bul")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <>
      {/* --- Üst bant -------------------------------------------------------- */}
      <header className="topbar">
        <div className="topbar-in">
          <a className="brand" href="#hesapla">
            <span className="brand-mark" aria-hidden="true">R</span>
            <span className="brand-text">
              <b>Rota</b>
              <span>YKS {KILAVUZ_YILI}</span>
            </span>
          </a>

          <nav className="topnav" aria-label="Bölümler">
            {BOLUMLER.map((b) => (
              <a key={b.id} href={`#${b.id}`}>{b.ad}</a>
            ))}
          </nav>

          <ThemeToggle />
        </div>
      </header>

      {/* --- Sayfa başlığı bandı ---------------------------------------------- */}
      <div className="pagehead">
        <div className="pagehead-in">
          <div>
            <p className="breadcrumb">
              Anasayfa <span aria-hidden="true">/</span> <b>YKS Puan ve Tercih Hesaplama</b>
            </p>
            <h1>
              Puanını hesapla, <em>sıralamanın</em> nereye yettiğini gör.
            </h1>
            <p className="pagehead-lede">
              Netlerini bir kez gir; beş puan türünün tamamını, tahmini başarı sıranı ve{" "}
              {KILAVUZ_YILI} kılavuzundaki {tam(TOPLAM_PROGRAM)} programın hangilerine
              ulaşabildiğini tek sayfada gör. Üç yıllık taban puan geçmişi, şehir dağılımı
              ve uç noktalar da aynı veriden.
            </p>
          </div>

          <dl className="pagehead-stats">
            <div className="pagehead-stat">
              <b>{tam(TOPLAM_PROGRAM)}</b>
              <span>Program</span>
            </div>
            <div className="pagehead-stat">
              <b>{tam(UNIVERSITE_SAYISI)}</b>
              <span>Üniversite</span>
            </div>
            <div className="pagehead-stat">
              <b>{tam(IL_SAYISI)}</b>
              <span>Şehir</span>
            </div>
          </dl>
        </div>
      </div>

      <main className="shell">
        {/* --- 1. Hesaplama --------------------------------------------------- */}
        <section id="hesapla">
          <div className="section-head">
            <span className="section-tag">Adım 1</span>
            <h2>Puan hesaplama</h2>
            <p>Doğru − yanlış ⁄ 4 ile net, netlerden ham puan, ham puana OBP eklenerek yerleştirme puanı.</p>
          </div>

          <div className="grid-calc">
            <Hesaplayici
              answers={answers}
              obp={obp}
              onChange={guncelle}
              onObpChange={setObp}
              onTemizle={() => setAnswers(BOS_CEVAPLAR)}
              onOrnek={() => setAnswers(ORNEK_CEVAPLAR)}
              onTercihlereGit={tercihlereGit}
              etkinDiplomaNotu={sonuc.obp / 5}
              obpKatkisi={sonuc.obpKatkisi}
            />
            <SonucPanosu
              sonuclar={sonuclar}
              puanTuru={puanTuru}
              onPuanTuruChange={setPuanTuru}
              answers={answers}
            />
          </div>
        </section>

        {/* --- 2. Tercih bulucu ------------------------------------------------ */}
        <section id="bul">
          <div className="section-head">
            <span className="section-tag">Adım 2</span>
            <h2>Tercih bulucu</h2>
            <p>
              Puanınla ya da doğrudan başarı sıranla ara: &quot;{tam(1000)}. sıradayım, nereye
              girerim?&quot;
            </p>
          </div>

          <ProgramBulucu
            puanTuru={puanTuru}
            yerlestirmePuani={sonuc.yerlestirmePuani}
            tahminiSira={sonuc.siralama}
            barajGecti={sonuc.barajGecti}
            barajEsigi={sonuc.barajEsigi}
          />
        </section>

        {/* --- 3. Taban puan geçmişi ------------------------------------------- */}
        <section id="grafik">
          <div className="section-head">
            <span className="section-tag">Grafik</span>
            <h2>Taban puan geçmişi</h2>
            <p>
              Üniversitelerin yıllara göre taban puan ortalaması ve en yüksek ortalamayı
              aldıkları yıl.
            </p>
          </div>

          <div className="card">
            <div className="card-body">
              <UniversiteGecmisi puanTuru={puanTuru} />
            </div>
          </div>
        </section>

        {/* --- 4. Şehir dağılımı ------------------------------------------------ */}
        <section id="sehir">
          <div className="section-head">
            <span className="section-tag">Harita</span>
            <h2>Üniversiteler nerede?</h2>
            <p>
              Hangi şehirde kaç üniversite ve kaç program var; o şehrin en yüksek ve en düşük
              tabanlı programı hangisi.
            </p>
          </div>

          <div className="card">
            <div className="card-body">
              <SehirPanosu puanTuru={puanTuru} />
            </div>
          </div>
        </section>

        {/* --- 5. Uç noktalar ---------------------------------------------------- */}
        <section id="uc">
          <div className="section-head">
            <span className="section-tag">Uç noktalar</span>
            <h2>En yüksek ve en düşük kapananlar</h2>
            <p>{puanTuru} türünde kılavuzun iki ucu — ayrı listeler hâlinde.</p>
          </div>

          <UcNoktalar puanTuru={puanTuru} />
        </section>

        {/* --- Yöntem ------------------------------------------------------------ */}
        <section id="yontem">
          <div className="section-head">
            <span className="section-tag">Yöntem</span>
            <h2>Hesap nasıl yapılıyor?</h2>
          </div>

          <dl className="yontem-liste">
            <div>
              <dt>Katsayılar veriden çıkarıldı, elle yazılmadı</dt>
              <dd>
                ÖSYM puanları standart puanlar (z-skoru) üzerinden hesaplar ve net → puan için
                açık bir formül yayımlamaz. Bu yüzden model, YÖK Atlas&apos;ın{" "}
                {KALIBRASYON_YILI} yılı için yayımladığı gerçek kayıtlardan — her programın
                taban adayının net dökümü, taban puanı ve OBP&apos;si — en küçük kareler ile
                çözüldü. <code>ham puan = taban puan − OBP × katsayı</code> eşitliği hedef
                değişken olarak kullanıldı.
              </dd>
            </div>
            <div>
              <dt>Modelin ölçülmüş hatası</dt>
              <dd>
                Seçili {puanTuru} modeli <b>{tam(MODEL.puanTurleri[puanTuru].n)}</b> gerçek
                kayıt üzerinde çözüldü: ortalama sapma (RMSE){" "}
                <b>{MODEL.puanTurleri[puanTuru].rmse.toLocaleString("tr-TR")} puan</b>, R²{" "}
                <b>{MODEL.puanTurleri[puanTuru].r2.toLocaleString("tr-TR")}</b>. Model{" "}
                {MODEL.puanTurleri[puanTuru].kalibrasyonAraligi[0].toLocaleString("tr-TR")}–
                {MODEL.puanTurleri[puanTuru].kalibrasyonAraligi[1].toLocaleString("tr-TR")} ham
                puan aralığında gözlem gördü; dışına çıkıldığında tahmin ekstrapolasyondur ve
                arayüz bunu uyarır.
              </dd>
            </div>
            <div>
              <dt>Başarı sırası</dt>
              <dd>
                Kılavuzdaki her programın gerçek (taban puan, taban başarı sırası) çiftinden
                çıkarılmış bir eğriden okunur. Taban puan OBP dahil olduğu için, o programın
                taban adayının OBP katkısı bir önceki yılın kayıtlarından düşülerek eğri sınav
                puanı birimine çevrildi. Bu yüzden diploma notunu değiştirdiğinde yerleştirme
                puanın değişir, sıralaman değişmez — ÖSYM de sırayı sınav puanından açıklar.
              </dd>
            </div>
            <div>
              <dt>Üç yıllık geçmiş</dt>
              <dd>
                Grafikteki taban puan ortalamaları, YÖK Atlas&apos;ın yayımladığı{" "}
                {KALIBRASYON_YILI - 2}, {KALIBRASYON_YILI - 1} ve {KALIBRASYON_YILI}{" "}
                yerleştirme kayıtlarından geliyor — tahmin değil, gerçekleşmiş taban puanlar.
                Bir üniversitenin &quot;zirve yılı&quot;, o üç yıl içinde programlarının taban
                puan ortalamasının en yüksek olduğu yıldır. Program kadrosu yıldan yıla
                değiştiği için ortalama, aynı programların değil o yılki programların
                ortalamasıdır.
              </dd>
            </div>
            <div>
              <dt>Program verisi</dt>
              <dd>
                {KILAVUZ_YILI} YKS tercih kılavuzunun tamamı: {tam(TOPLAM_PROGRAM)} program,
                doğrudan YÖK Atlas&apos;tan çekildi. Kontenjanı dolmayan programlarda taban
                yayımlanmadığı için &quot;dolmadı&quot; olarak işaretlenir — bu yüzden &quot;en
                düşük puanla kapananlar&quot; listesine girmezler. Vakıf üniversitelerinde
                gösterilen ücret, bursluluk oranı düşüldükten sonra fiilen ödenecek tutardır.
              </dd>
            </div>
            <div>
              <dt>Bu bir tahmindir</dt>
              <dd>
                İki ayrı yıl bir arada kullanılıyor: katsayılar {KALIBRASYON_YILI} sınav
                istatistiklerinden geliyor, taban puanlar ise {KILAVUZ_YILI} yerleştirmesinden.
                Soru güçlüğü ve aday dağılımı yıldan yıla değiştiği için tahmin edilen puan
                sapabilir, taban puanlar da önümüzdeki yerleştirmede kayar. Kesin bilgi için
                ÖSYM kılavuzuna bak.
              </dd>
            </div>
          </dl>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-in">
          <span>Rota · bağımsız bir hesaplama aracı, ÖSYM ile ilişkisi yoktur.</span>
          <span>
            Veri kaynağı:{" "}
            <a href="https://yokatlas.yok.gov.tr/" target="_blank" rel="noopener noreferrer">
              YÖK Atlas
            </a>
            {" · "}
            <a href="https://www.osym.gov.tr/" target="_blank" rel="noopener noreferrer">
              ÖSYM
            </a>
          </span>
        </div>
      </footer>
    </>
  );
}
