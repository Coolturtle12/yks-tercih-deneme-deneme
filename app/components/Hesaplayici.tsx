"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { net as fmtNet } from "../lib/format";
import {
  TESTS,
  normalizeAnswer,
  netOf,
  type Answers,
  type ObpGirdisi,
  type Test,
  type TestGroup,
} from "../lib/yks";

type Alan = "dogru" | "yanlis";

type Props = {
  answers: Answers;
  obp: ObpGirdisi;
  onChange: (testId: string, alan: Alan, deger: string) => void;
  onObpChange: (girdi: ObpGirdisi) => void;
  onTemizle: () => void;
  onOrnek: () => void;
  /** Altın CTA — sonucu değil, tercih bölümünü açar. */
  onTercihlereGit: () => void;
  /** Hesabın fiilen kullandığı diploma notu (50–100 arasına kırpılmış hâli). */
  etkinDiplomaNotu: number;
  obpKatkisi: number;
};

const OTURUMLAR: { id: TestGroup; ad: string; not: string }[] = [
  { id: "TYT", ad: "TYT", not: "Temel Yeterlilik Testi — 120 soru" },
  { id: "AYT", ad: "AYT", not: "Alan Yeterlilik Testleri — 160 soru" },
  { id: "YDT", ad: "YDT", not: "Yabancı Dil Testi — 80 soru" },
];

/* -------------------------------------------------------------------------- */
/* Rakam kutusu                                                                */
/* -------------------------------------------------------------------------- */

type KutuProps = {
  deger: number;
  /** Bu alana girilebilecek en büyük değer: soru sayısı eksi karşı alan. */
  enCok: number;
  etiket: string;
  onDegisti: (deger: string) => void;
  onKirpildi: (istenen: number, uygulanan: number) => void;
  kaydet: (el: HTMLInputElement | null) => void;
  onTus: (olay: React.KeyboardEvent<HTMLInputElement>) => void;
};

/**
 * `type="number"` bilerek kullanılmıyor. O tipte imleç konumu okunamaz, fare
 * tekerleği odaklı kutunun değerini sessizce değiştirir, geçersiz metin değeri
 * boşa düşürür ve ok tuşları artırma/azaltmaya bağlı olduğu için satırlar arası
 * gezinmeye kullanılamaz. Metin kutusu + rakam klavyesi bunların hepsini
 * ortadan kaldırır.
 *
 * Kırpma senkron yapılır: kutunun soru sayısını aşan bir değer göstermesi
 * yapısal olarak imkânsızdır, React'in yeniden render etmesini beklemez.
 */
function Kutu({ deger, enCok, etiket, onDegisti, onKirpildi, kaydet, onTus }: KutuProps) {
  const kutuRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const kutu = kutuRef.current;
    if (!kutu) return;
    const beklenen = String(deger);
    if (kutu.value === beklenen) return;
    // Kullanıcı alanı silip yeniden yazabilsin diye odaktaki boş kutuya dokunma.
    if (kutu === document.activeElement && kutu.value === "") return;
    kutu.value = beklenen;
  });

  return (
    <input
      ref={(el) => {
        kutuRef.current = el;
        kaydet(el);
      }}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      maxLength={3}
      defaultValue={deger}
      aria-label={etiket}
      onKeyDown={onTus}
      onFocus={(olay) => olay.target.select()}
      onBlur={(olay) => { olay.target.value = String(deger); }}
      onChange={(olay) => {
        const kutu = olay.currentTarget;
        const rakamlar = kutu.value.replace(/\D/g, "");

        if (rakamlar === "") {
          if (kutu.value !== "") kutu.value = "";
          onDegisti("");
          return;
        }

        const istenen = Number(rakamlar);
        const uygulanan = Math.min(enCok, istenen);
        if (String(uygulanan) !== kutu.value) kutu.value = String(uygulanan);
        if (uygulanan !== istenen) onKirpildi(istenen, uygulanan);
        onDegisti(String(uygulanan));
      }}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Diploma notu kutusu                                                         */
/* -------------------------------------------------------------------------- */

/** Ondalığı Türkçe ayırıcıyla yaz: 85 → "85", 85.5 → "85,5". */
const bicimle = (deger: number) => String(deger).replace(".", ",");

/**
 * Üst sınır (100) yazarken anında uygulanır; alt sınır (50) ise odak kaybında,
 * çünkü "85" yazmak için önce "8" yazmak gerekir ve 8 anında 50'ye çekilseydi
 * sayıyı yazmak imkânsız olurdu.
 */
function NotKutusu({ etkinDeger, onDegisti }: { etkinDeger: number; onDegisti: (deger: number) => void }) {
  const kutuRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const kutu = kutuRef.current;
    if (!kutu || kutu === document.activeElement) return;
    const beklenen = bicimle(etkinDeger);
    if (kutu.value !== beklenen) kutu.value = beklenen;
  });

  return (
    <input
      ref={kutuRef}
      id="diploma-notu"
      type="text"
      inputMode="decimal"
      autoComplete="off"
      maxLength={6}
      defaultValue={bicimle(etkinDeger)}
      onFocus={(olay) => olay.target.select()}
      onBlur={(olay) => { olay.currentTarget.value = bicimle(etkinDeger); }}
      onChange={(olay) => {
        const kutu = olay.currentTarget;

        // Rakamlar ve yalnızca ilk ondalık ayırıcı; virgül de nokta da kabul.
        const ham = kutu.value.replace(/[^\d.,]/g, "");
        const ayirici = ham.search(/[.,]/);
        const temiz = ayirici === -1
          ? ham
          : ham.slice(0, ayirici + 1) + ham.slice(ayirici + 1).replace(/[.,]/g, "");

        const sayi = Number(temiz.replace(",", "."));
        const gosterilecek = Number.isFinite(sayi) && sayi > 100 ? "100" : temiz;

        if (gosterilecek !== kutu.value) kutu.value = gosterilecek;
        onDegisti(Number(gosterilecek.replace(",", ".")) || 0);
      }}
    />
  );
}

/* -------------------------------------------------------------------------- */

export default function Hesaplayici({
  answers, obp, onChange, onObpChange, onTemizle, onOrnek,
  onTercihlereGit, etkinDiplomaNotu, obpKatkisi,
}: Props) {
  const [oturum, setOturum] = useState<TestGroup>("TYT");

  /*
   * Netler oturum sekmelerine bölünmüş olsa da klavye gezinme sırası TÜM
   * testleri kapsar: kullanıcı sekme değiştirdiğinde odak sırası kopmasın diye
   * dizin cevap kâğıdının tamamı üzerinden kurulur, gizli kutular haritada
   * bulunmadığı için hedef atlanır.
   */
  const kutular = useRef(new Map<string, HTMLInputElement>());
  const sira = useMemo(
    () => TESTS.flatMap((t) => [`${t.id}:dogru`, `${t.id}:yanlis`]),
    [],
  );

  const [uyari, setUyari] = useState("");
  const [parlayan, setParlayan] = useState<string | null>(null);
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (zamanlayici.current) clearTimeout(zamanlayici.current); }, []);

  const kirpildiBildir = useCallback(
    (anahtar: string, etiket: string, istenen: number, uygulanan: number) => {
      setParlayan(anahtar);
      setUyari(`${etiket}: ${istenen} sığmadı, ${uygulanan} olarak yazıldı.`);
      if (zamanlayici.current) clearTimeout(zamanlayici.current);
      zamanlayici.current = setTimeout(() => setParlayan(null), 900);
    },
    [],
  );

  /** Enter / ok tuşlarıyla kutular arası geçiş; 22 alan arasında tab'lamayı bitirir. */
  const tusIsle = useCallback(
    (anahtar: string) => (olay: React.KeyboardEvent<HTMLInputElement>) => {
      const yon =
        olay.key === "ArrowDown" || (olay.key === "Enter" && !olay.shiftKey) ? 1 :
        olay.key === "ArrowUp" || (olay.key === "Enter" && olay.shiftKey) ? -1 : 0;
      if (!yon) return;

      olay.preventDefault();
      const simdi = sira.indexOf(anahtar);
      // Ok tuşları sütunu korur (iki alan ileri), Enter sıradaki kutuya geçer.
      const adim = olay.key === "Enter" ? yon : yon * 2;
      const hedef = kutular.current.get(sira[simdi + adim]);
      hedef?.focus();
    },
    [sira],
  );

  const oturumTestleri = TESTS.filter((t) => t.group === oturum);

  /** Sekme başlıklarında görünen "işaretlenen / toplam" sayacı. */
  const oturumSayaci = (grup: TestGroup) => {
    const testler = TESTS.filter((t) => t.group === grup);
    const isaretli = testler.reduce((s, t) => {
      const { dogru, yanlis } = normalizeAnswer(t, answers[t.id]);
      return s + dogru + yanlis;
    }, 0);
    return { isaretli, toplam: testler.reduce((s, t) => s + t.count, 0) };
  };

  return (
    <article className="card">
      <div className="card-head">
        <h2>Sınav Sonuçlarınız</h2>
        <p>
          TYT, AYT ve YDT sekmelerinden doğru / yanlış sayılarını girin. Diploma notunu yazın;
          netler ve beş puan türünün tamamı anında güncellenir.
        </p>
      </div>

      <div className="card-body">
        {/* --- Diploma notu ------------------------------------------------- */}
        <div className="obp-box">
          <div className="obp-field">
            <label htmlFor="diploma-notu">
              Diploma Notu <span>(50 – 100)</span>
            </label>
            <NotKutusu
              etkinDeger={etkinDiplomaNotu}
              onDegisti={(diplomaNotu) => onObpChange({ ...obp, diplomaNotu })}
            />
          </div>
          <div className="obp-out">
            <span>OBP Katkısı</span>
            <b>{fmtNet(obpKatkisi)}</b>
          </div>
        </div>

        <label
          className="obp-check"
          title="Meslek lisesi mezunuyum ve kendi alanımdaki ön lisans programlarını tercih edeceğim: OBP katsayısı 0,12 yerine 0,18 uygulanır."
        >
          <input
            type="checkbox"
            checked={obp.ekPuan}
            onChange={(olay) => onObpChange({ ...obp, ekPuan: olay.target.checked })}
          />
          Meslek lisesi ek puanı (katsayı 0,18)
        </label>

        {/* --- Oturum sekmeleri --------------------------------------------- */}
        <div className="tabs" role="tablist" aria-label="Sınav oturumu">
          {OTURUMLAR.map((o) => {
            const { isaretli, toplam } = oturumSayaci(o.id);
            return (
              <button
                key={o.id}
                type="button"
                role="tab"
                className="tab"
                aria-selected={oturum === o.id}
                onClick={() => setOturum(o.id)}
              >
                {o.ad}
                <span className="sr-only">
                  {" "}— {isaretli} / {toplam} soru işaretlendi
                </span>
              </button>
            );
          })}
        </div>

        <p className="tab-note">{OTURUMLAR.find((o) => o.id === oturum)?.not}</p>

        <div className="arac-satir">
          <button type="button" className="ghost-btn" onClick={onOrnek}>
            Örnek deneme
          </button>
          <button type="button" className="ghost-btn" onClick={onTemizle}>
            Temizle
          </button>
          <span className="ilerleme">
            <b>{oturumSayaci(oturum).isaretli}</b> / {oturumSayaci(oturum).toplam} soru
          </span>
        </div>

        <p className="sr-only" role="status" aria-live="polite">{uyari}</p>

        {/* --- Ders satırları ------------------------------------------------ */}
        <div className="dersler">
          {oturumTestleri.map((test) => (
            <DersSatiri
              key={test.id}
              test={test}
              answers={answers}
              parlayan={parlayan}
              kutular={kutular}
              onChange={onChange}
              onKirpildi={kirpildiBildir}
              tusIsle={tusIsle}
            />
          ))}
        </div>

        <button type="button" className="cta" onClick={onTercihlereGit}>
          Puanımın yettiği programları göster
        </button>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */

type SatirProps = {
  test: Test;
  answers: Answers;
  parlayan: string | null;
  kutular: React.RefObject<Map<string, HTMLInputElement>>;
  onChange: (testId: string, alan: Alan, deger: string) => void;
  onKirpildi: (anahtar: string, etiket: string, istenen: number, uygulanan: number) => void;
  tusIsle: (anahtar: string) => (olay: React.KeyboardEvent<HTMLInputElement>) => void;
};

function DersSatiri({ test, answers, parlayan, kutular, onChange, onKirpildi, tusIsle }: SatirProps) {
  const { dogru, yanlis } = normalizeAnswer(test, answers[test.id]);
  const net = netOf(dogru, yanlis);
  const dokunulmadi = dogru === 0 && yanlis === 0;

  const kutu = (alan: Alan, deger: number, enCok: number, etiket: string) => {
    const anahtar = `${test.id}:${alan}`;
    return (
      <span className={`dy${parlayan === anahtar ? " kirpildi" : ""}`}>
        <span aria-hidden="true">{alan === "dogru" ? "D:" : "Y:"}</span>
        <Kutu
          deger={deger}
          enCok={enCok}
          etiket={etiket}
          kaydet={(el) => {
            if (el) kutular.current.set(anahtar, el);
            else kutular.current.delete(anahtar);
          }}
          onTus={tusIsle(anahtar)}
          onDegisti={(v) => onChange(test.id, alan, v)}
          onKirpildi={(istenen, uygulanan) => onKirpildi(anahtar, etiket, istenen, uygulanan)}
        />
      </span>
    );
  };

  return (
    <div className="ders-satir">
      <span className="ders-ad">
        <b>{test.label}</b>
        <span>{test.count} soru{test.note ? ` · ${test.note}` : ""}</span>
      </span>

      <span className="ders-giris">
        {kutu("dogru", dogru, test.count - yanlis, `${test.label} doğru sayısı`)}
        {kutu("yanlis", yanlis, test.count - dogru, `${test.label} yanlış sayısı`)}
        <span className={`ders-net${dokunulmadi ? " bos" : ""}`}>
          {fmtNet(net)}
          <small>net</small>
        </span>
      </span>
    </div>
  );
}
