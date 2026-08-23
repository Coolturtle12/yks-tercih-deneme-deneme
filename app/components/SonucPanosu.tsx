"use client";

import { net as fmtNet, puan as fmtPuan, tam } from "../lib/format";
import {
  KALIBRASYON_YILI,
  PUAN_TURLERI,
  TESTS,
  netOf,
  normalizeAnswer,
  type Answers,
  type PuanTuru,
  type Sonuc,
  type TestGroup,
} from "../lib/yks";

type Props = {
  sonuclar: Record<PuanTuru, Sonuc>;
  puanTuru: PuanTuru;
  onPuanTuruChange: (tur: PuanTuru) => void;
  answers: Answers;
};

const KART_ADI: Record<PuanTuru, string> = {
  TYT: "TYT Yerleştirme Puanı",
  SAY: "Sayısal Yerleştirme Puanı",
  EA: "Eşit Ağırlık Yerleştirme Puanı",
  SÖZ: "Sözel Yerleştirme Puanı",
  DİL: "Dil Yerleştirme Puanı",
};

/** Bir oturumun tüm testlerinin net toplamı — puan türünden bağımsız. */
function oturumNeti(answers: Answers, grup: TestGroup): number {
  const toplam = TESTS.filter((t) => t.group === grup).reduce((s, test) => {
    const { dogru, yanlis } = normalizeAnswer(test, answers[test.id]);
    return s + netOf(dogru, yanlis);
  }, 0);
  return Math.round(toplam * 100) / 100;
}

export default function SonucPanosu({ sonuclar, puanTuru, onPuanTuruChange, answers }: Props) {
  const secili = sonuclar[puanTuru];
  /*
   * Düzen her zaman "1 geniş + 4 küçük": geniş kart seçili puan türüdür, kalan
   * dördü kılavuz sırasını korur. Küçük bir karta basmak onu yukarı taşır, yani
   * seçim hem görsel hem de aramanın hangi puanla yapılacağını belirleyen tek
   * karardır.
   */
  const digerleri = PUAN_TURLERI.filter((t) => t.id !== puanTuru);

  const tytNet = oturumNeti(answers, "TYT");
  const aytNet = oturumNeti(answers, "AYT");
  const ydtNet = oturumNeti(answers, "YDT");

  return (
    <article className="card">
      <div className="card-head">
        <h2>Tahmini Puanların</h2>
        <p>
          Beş puan türü aynı cevap kâğıdından hesaplanır. Bir karta dokunduğunda o puan
          türü seçilir; aşağıdaki program araması da o puana göre çalışır.
        </p>
      </div>

      <div className="card-body">
        <div className="sonuc-grid">
          <button
            type="button"
            className="puan-kart genis secili"
            aria-pressed={true}
            onClick={() => onPuanTuruChange(puanTuru)}
          >
            <span className="rozet">Seçili</span>
            <span className="etiket">{KART_ADI[puanTuru]}</span>
            <span className="deger">{fmtPuan(secili.yerlestirmePuani)}</span>
            <span className="alt">
              Ham: {fmtPuan(secili.hamPuan)} · OBP: +{fmtPuan(secili.obpKatkisi)}
            </span>
          </button>

          {digerleri.map((tur) => {
            const s = sonuclar[tur.id];
            return (
              <button
                key={tur.id}
                type="button"
                className="puan-kart"
                aria-pressed={false}
                title={`${tur.ad} — ${tur.alan}`}
                onClick={() => onPuanTuruChange(tur.id)}
              >
                <span className="etiket">{KART_ADI[tur.id]}</span>
                <span className="deger">{fmtPuan(s.yerlestirmePuani)}</span>
                <span className="alt">Ham: {fmtPuan(s.hamPuan)}</span>
              </button>
            );
          })}
        </div>

        {/* --- Başarı sırası ------------------------------------------------- */}
        <div className="sira-blok">
          <span className="rakam">{tam(secili.siralama)}</span>
          <span className="aciklama">
            <b>Tahmini {secili.puanTuru} başarı sıran</b>
            Modelin ±{fmtPuan(secili.rmse)} puanlık ölçülmüş sapması bu sırayı{" "}
            {tam(secili.siralamaAraligi[0])} – {tam(secili.siralamaAraligi[1])} aralığına
            yayıyor. Sıralama sınav puanından okunur; diploma notu onu değiştirmez.
          </span>
        </div>

        <p style={{ marginTop: "var(--s-3)" }}>
          <span className={`baraj ${secili.barajGecti ? "gecti" : "kaldi"}`}>
            {secili.barajGecti
              ? `Baraj geçildi (${secili.barajEsigi})`
              : `Baraj altında — en az ${secili.barajEsigi} ham puan gerekiyor`}
          </span>
        </p>

        {/* --- Küçük sayaçlar ------------------------------------------------ */}
        <div className="mini-grid">
          <div className="mini">
            <span>OBP</span>
            <b>{fmtPuan(secili.obp)}</b>
          </div>
          <div className="mini">
            <span>TYT Toplam Net</span>
            <b>{fmtNet(tytNet)}</b>
          </div>
          <div className="mini">
            <span>AYT Toplam Net</span>
            <b>{fmtNet(aytNet)}</b>
          </div>
          <div className="mini">
            <span>YDT Net</span>
            <b>{fmtNet(ydtNet)}</b>
          </div>
        </div>

        {secili.aralikDisinda && (
          <p className="uyari-kutu">
            Ham puanın, modelin {KALIBRASYON_YILI} verisinde gözlem gördüğü aralığın dışında.
            Bu bölgede tahmin belirgin şekilde zayıflar.
          </p>
        )}

        {/* --- Puan türü dökümü ---------------------------------------------- */}
        {/* OBP katkısı beş satırda da aynı olduğu için sütun değil, üstteki
            "OBP" kutusunda tek bir sayı olarak duruyor. */}
        <div className="tablo-sarmal" style={{ marginTop: "var(--s-4)" }}>
          <table className="veri">
            <caption className="sr-only">Puan türlerine göre ham puan, yerleştirme puanı ve başarı sırası</caption>
            <thead>
              <tr>
                <th scope="col">Puan Türü</th>
                <th scope="col" className="num">Ham Puan</th>
                <th scope="col" className="num">Yerleştirme Puanı</th>
                <th scope="col" className="num">Başarı Sırası</th>
              </tr>
            </thead>
            <tbody>
              {PUAN_TURLERI.map((tur) => {
                const s = sonuclar[tur.id];
                return (
                  <tr key={tur.id}>
                    <th scope="row">
                      <b>{tur.kod}</b>
                      <span className="program-uni">{tur.ad}</span>
                    </th>
                    <td className="num">{fmtPuan(s.hamPuan)}</td>
                    <td className="num">
                      <b>{fmtPuan(s.yerlestirmePuani)}</b>
                    </td>
                    <td className="num">
                      {s.barajGecti ? tam(s.siralama) : <span className="yok">baraj altı</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </article>
  );
}
