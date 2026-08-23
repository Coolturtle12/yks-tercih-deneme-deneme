"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import ProgramTablosu from "./ProgramTablosu";
import { tam } from "../lib/format";
import { MODEL, type PuanTuru } from "../lib/yks";
import type { AramaSonucu, Duzey, Risk, UniTuru } from "../lib/veri";

/** Arama neyle yapılıyor: yerleştirme puanıyla mı, başarı sırasıyla mı. */
export type BulmaModu = "puan" | "sira";

type Props = {
  puanTuru: PuanTuru;
  yerlestirmePuani: number;
  /** Hesaplayıcının ürettiği tahmini başarı sırası — "sıramı kullan" bunu doldurur. */
  tahminiSira: number;
  barajGecti: boolean;
  barajEsigi: number;
};

type Siralama = "yakinlik" | "taban-desc" | "taban-asc" | "sira-asc" | "kontenjan-desc";

const RISKLER: { id: Risk; ad: string }[] = [
  { id: "guvenli", ad: "Güvenli" },
  { id: "sinirda", ad: "Sınırda" },
  { id: "zor", ad: "Zor" },
];

const UNI_TURLERI: { id: UniTuru; ad: string }[] = [
  { id: "DEVLET", ad: "Devlet" },
  { id: "VAKIF", ad: "Vakıf" },
  { id: "KKTC", ad: "KKTC" },
  { id: "YURTDIŞI", ad: "Yurt dışı" },
];

const DUZEYLER: { id: Duzey; ad: string }[] = [
  { id: "lisans", ad: "Lisans" },
  { id: "onlisans", ad: "Ön lisans" },
];

const SIRALAMALAR: Record<BulmaModu, { id: Siralama; ad: string }[]> = {
  puan: [
    { id: "yakinlik", ad: "Puana yakınlık" },
    { id: "taban-desc", ad: "Taban puanı ↓" },
    { id: "taban-asc", ad: "Taban puanı ↑" },
    { id: "kontenjan-desc", ad: "Kontenjan ↓" },
  ],
  sira: [
    { id: "yakinlik", ad: "Sıraya yakınlık" },
    { id: "sira-asc", ad: "Taban sırası ↑" },
    { id: "taban-desc", ad: "Taban puanı ↓" },
    { id: "kontenjan-desc", ad: "Kontenjan ↓" },
  ],
};

/** "1000. sıradayım" kutusunun tek dokunuşluk hazır değerleri. */
const HIZLI_SIRALAR = [1_000, 5_000, 10_000, 50_000, 100_000, 250_000];

const SAYFA_BOYU = 25;

/** Bir değeri, hızlı ardışık değişikliklerde yalnızca durulunca yayar. */
function useGecikmeli<T>(deger: T, ms: number): T {
  const [gecikmis, setGecikmis] = useState(deger);
  useEffect(() => {
    const zamanlayici = setTimeout(() => setGecikmis(deger), ms);
    return () => clearTimeout(zamanlayici);
  }, [deger, ms]);
  return gecikmis;
}

export default function ProgramBulucu({
  puanTuru, yerlestirmePuani, tahminiSira, barajGecti, barajEsigi,
}: Props) {
  const [mod, setMod] = useState<BulmaModu>("puan");
  const [sira, setSira] = useState<number>(10_000);
  const [q, setQ] = useState("");
  const [grup, setGrup] = useState("");
  const [uni, setUni] = useState("");
  const [il, setIl] = useState("");
  const [uniTur, setUniTur] = useState<UniTuru[]>([]);
  const [duzey, setDuzey] = useState<Duzey | "">("");
  const [risk, setRisk] = useState<Risk[]>([]);
  const [sadeceUlasilabilir, setSadeceUlasilabilir] = useState(true);
  const [siralama, setSiralama] = useState<Siralama>("yakinlik");
  const [sayfa, setSayfa] = useState(1);

  /*
   * Her filtre değişikliği listeyi baştan alır: kullanıcı 7. sayfadayken bölüm
   * değiştirdiğinde boş sayfa görmemeli.
   */
  const filtreli = useCallback(
    <T,>(setter: (deger: T) => void) => (deger: T) => {
      setter(deger);
      setSayfa(1);
    },
    [],
  );

  /*
   * Sonuç, kendisini üreten sorgu ile birlikte saklanır. Böylece "yükleniyor",
   * ayrı bir bayrak yerine "eldeki sonuç güncel sorguya ait değil" olarak
   * türetilir; durum hiçbir zaman gerçekle ayrışamaz.
   */
  const [cevap, setCevap] = useState<{
    sorgu: string;
    sonuc: AramaSonucu | null;
    hata: string | null;
  }>({ sorgu: "", sonuc: null, hata: null });

  const gecikmeliQ = useGecikmeli(q, 250);
  const gecikmeliPuan = useGecikmeli(yerlestirmePuani, 250);
  const gecikmeliSira = useGecikmeli(sira, 300);

  const sorgu = useMemo(() => {
    const p = new URLSearchParams();
    p.set("puanTuru", puanTuru);
    // Sıra modunda puan da gönderilir: tabloda "puan farkı" sütunu boş kalmasın.
    p.set("puan", String(gecikmeliPuan));
    if (mod === "sira") p.set("sira", String(gecikmeliSira));
    p.set("siralama", siralama);
    p.set("sayfa", String(sayfa));
    p.set("boyut", String(SAYFA_BOYU));
    if (gecikmeliQ) p.set("q", gecikmeliQ);
    if (grup) p.set("grup", grup);
    if (uni) p.set("uni", uni);
    if (il) p.set("il", il);
    if (duzey) p.set("duzey", duzey);
    if (uniTur.length) p.set("uniTur", uniTur.join(","));
    if (risk.length) p.set("risk", risk.join(","));
    if (sadeceUlasilabilir) p.set("ulasilabilir", "1");
    return p.toString();
  }, [
    puanTuru, gecikmeliPuan, mod, gecikmeliSira, siralama, sayfa, gecikmeliQ,
    grup, uni, il, duzey, uniTur, risk, sadeceUlasilabilir,
  ]);

  /*
   * Sıra modunda baraj kapısı uygulanmaz: kullanıcı netlerini hiç girmeden
   * "ben 1000. sıradayım" diyerek gelebilmelidir. Puan modunda ise baraj altı
   * bir puanla tercih yapılamayacağı için liste yerine açıklama gösterilir.
   */
  const kapali = mod === "puan" && !barajGecti;
  const yukleniyor = !kapali && cevap.sorgu !== sorgu;
  const sonuc = cevap.sonuc;
  const hata = cevap.hata;

  useEffect(() => {
    if (kapali) return;
    const kontrol = new AbortController();

    fetch(`/api/programlar?${sorgu}`, { signal: kontrol.signal })
      .then((yanit) => {
        if (!yanit.ok) throw new Error(`HTTP ${yanit.status}`);
        return yanit.json() as Promise<AramaSonucu>;
      })
      .then((veri) => setCevap({ sorgu, sonuc: veri, hata: null }))
      .catch((sebep) => {
        if (sebep.name === "AbortError") return;
        setCevap((onceki) => ({
          sorgu,
          sonuc: onceki.sonuc,
          hata: "Program listesi yüklenemedi. Bağlantını kontrol edip tekrar dene.",
        }));
      });

    return () => kontrol.abort();
  }, [sorgu, kapali]);

  const cevir = <T,>(mevcut: T[], deger: T): T[] =>
    mevcut.includes(deger) ? mevcut.filter((v) => v !== deger) : [...mevcut, deger];

  const temizle = () => {
    setQ(""); setGrup(""); setUni(""); setIl(""); setDuzey("");
    setUniTur([]); setRisk([]); setSadeceUlasilabilir(true); setSayfa(1);
  };

  const filtreVar = Boolean(q || grup || uni || il || duzey || uniTur.length || risk.length);
  const sonSayfa = sonuc ? Math.max(1, Math.ceil(sonuc.toplam / sonuc.sayfaBoyu)) : 1;

  function modDegistir(yeni: BulmaModu) {
    setMod(yeni);
    setSayfa(1);
    // Sıralama seçenekleri moda göre değiştiği için geçersiz kalanı sıfırla.
    if (!SIRALAMALAR[yeni].some((s) => s.id === siralama)) setSiralama("yakinlik");
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>Bu puan — ya da bu sıralama — nereye yetiyor?</h2>
        <p>
          {MODEL.kilavuzYili} tercih kılavuzunun tamamında ara. Program taban değerleri{" "}
          {MODEL.kilavuzYili} yerleştirme sonuçlarıdır; kontenjanı dolmayanlarda taban
          yayımlanmadığı için &quot;dolmadı&quot; yazar.
        </p>
      </div>

      <div className="card-body">
        {/* --- Mod anahtarı ---------------------------------------------------- */}
        <div className="mod-satir">
          <div className="mod-anahtar" role="group" aria-label="Arama modu">
            <button type="button" aria-pressed={mod === "puan"} onClick={() => modDegistir("puan")}>
              Puanımla ara
            </button>
            <button type="button" aria-pressed={mod === "sira"} onClick={() => modDegistir("sira")}>
              Sıralamamla ara
            </button>
          </div>

          {mod === "sira" ? (
            <>
              <div className="sira-giris">
                <label htmlFor="basari-sirasi">{puanTuru} başarı sıram</label>
                <input
                  id="basari-sirasi"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={9}
                  value={sira ? sira.toLocaleString("tr-TR") : ""}
                  onChange={(olay) => {
                    const rakamlar = olay.target.value.replace(/\D/g, "");
                    filtreli(setSira)(rakamlar ? Math.min(3_000_000, Number(rakamlar)) : 0);
                  }}
                />
                <span className="birim">. sıradayım</span>
              </div>

              <div className="sira-hizli">
                {HIZLI_SIRALAR.map((s) => (
                  <button key={s} type="button" onClick={() => filtreli(setSira)(s)}>
                    {tam(s)}
                  </button>
                ))}
                {barajGecti && (
                  <button type="button" onClick={() => filtreli(setSira)(tahminiSira)}>
                    Tahmini sıram ({tam(tahminiSira)})
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="ozet-satir" style={{ margin: 0 }}>
              Yerleştirme puanın <b>{yerlestirmePuani.toLocaleString("tr-TR")}</b> ({puanTuru})
            </p>
          )}
        </div>

        {kapali ? (
          <div className="bos-durum">
            <strong>Önce barajı geçmen gerekiyor.</strong>
            <p>
              Tercih yapabilmek için {puanTuru} ham puanının en az {barajEsigi} olması gerekiyor.
              Netlerini gir; ya da &quot;Sıralamamla ara&quot;ya geçip doğrudan bir başarı sırası
              yazarak {tam(MODEL.programSayilari[puanTuru])} programlık kılavuzu tara.
            </p>
          </div>
        ) : (
          <>
            {/* --- Filtre alanları ------------------------------------------- */}
            <div className="alanlar">
              <label className="alan buyuk">
                <span className="label">Ara</span>
                <input
                  type="search"
                  value={q}
                  placeholder="Üniversite ya da bölüm adı"
                  onChange={(olay) => filtreli(setQ)(olay.target.value)}
                />
              </label>

              <label className="alan">
                <span className="label">Bölüm</span>
                <input
                  list="secenek-gruplar"
                  value={grup}
                  placeholder="Tümü"
                  onChange={(olay) => filtreli(setGrup)(olay.target.value)}
                />
              </label>

              <label className="alan">
                <span className="label">Üniversite</span>
                <input
                  list="secenek-universiteler"
                  value={uni}
                  placeholder="Tümü"
                  onChange={(olay) => filtreli(setUni)(olay.target.value)}
                />
              </label>

              <label className="alan">
                <span className="label">Şehir</span>
                <input
                  list="secenek-iller"
                  value={il}
                  placeholder="Tümü"
                  onChange={(olay) => filtreli(setIl)(olay.target.value)}
                />
              </label>

              <label className="alan">
                <span className="label">Sırala</span>
                <select
                  value={siralama}
                  onChange={(olay) => filtreli(setSiralama)(olay.target.value as Siralama)}
                >
                  {SIRALAMALAR[mod].map((s) => (
                    <option key={s.id} value={s.id}>{s.ad}</option>
                  ))}
                </select>
              </label>
            </div>

            <datalist id="secenek-gruplar">
              {MODEL.secenekler.gruplar.map((g) => <option key={g} value={g} />)}
            </datalist>
            <datalist id="secenek-universiteler">
              {MODEL.secenekler.universiteler.map((u) => <option key={u} value={u} />)}
            </datalist>
            <datalist id="secenek-iller">
              {MODEL.secenekler.iller.map((i) => <option key={i} value={i} />)}
            </datalist>

            {/* --- Çipler ---------------------------------------------------- */}
            <div className="cipler">
              <button
                type="button"
                className="chip-btn"
                aria-pressed={sadeceUlasilabilir}
                onClick={() => filtreli(setSadeceUlasilabilir)(!sadeceUlasilabilir)}
              >
                {mod === "sira" ? "Sıramın yettikleri" : "Puanımın yettikleri"}
              </button>

              <span className="cip-ayrac" aria-hidden="true" />

              {RISKLER.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="chip-btn"
                  aria-pressed={risk.includes(r.id)}
                  onClick={() => filtreli(setRisk)(cevir(risk, r.id))}
                >
                  {r.ad}
                  {sonuc && <span className="sayac">{tam(sonuc.sayaclar[r.id])}</span>}
                </button>
              ))}

              <span className="cip-ayrac" aria-hidden="true" />

              {UNI_TURLERI.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="chip-btn"
                  aria-pressed={uniTur.includes(t.id)}
                  onClick={() => filtreli(setUniTur)(cevir(uniTur, t.id))}
                >
                  {t.ad}
                </button>
              ))}

              <span className="cip-ayrac" aria-hidden="true" />

              {DUZEYLER.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="chip-btn"
                  aria-pressed={duzey === d.id}
                  onClick={() => filtreli(setDuzey)(duzey === d.id ? "" : d.id)}
                >
                  {d.ad}
                </button>
              ))}

              {filtreVar && (
                <button type="button" className="ghost-btn" onClick={temizle}>
                  Filtreleri temizle
                </button>
              )}
            </div>

            <p className="ozet-satir" role="status">
              {hata ? (
                <span className="uyari">{hata}</span>
              ) : sonuc ? (
                <>
                  <b>{tam(sonuc.toplam)}</b> program eşleşti
                  {sonuc.toplam > sonuc.sayfaBoyu && (
                    <> · sayfa {tam(sonuc.sayfa)} / {tam(sonSayfa)}</>
                  )}
                  {mod === "sira" && <> · {tam(sira)}. sıraya göre değerlendirildi</>}
                </>
              ) : (
                "Yükleniyor…"
              )}
            </p>

            <ProgramTablosu
              programlar={sonuc?.programlar ?? []}
              kilavuzYili={MODEL.kilavuzYili}
              yukleniyor={yukleniyor}
              toplam={sonuc?.toplam ?? 0}
              mod={mod}
            />

            {sonuc && sonSayfa > 1 && (
              <nav className="sayfalama" aria-label="Sayfalar">
                <button
                  type="button"
                  className="ghost-btn"
                  disabled={sonuc.sayfa <= 1}
                  onClick={() => setSayfa((s) => Math.max(1, s - 1))}
                >
                  ← Önceki
                </button>
                <span className="sayfa-no">
                  {tam(sonuc.sayfa)} / {tam(sonSayfa)}
                </span>
                <button
                  type="button"
                  className="ghost-btn"
                  disabled={sonuc.sayfa >= sonSayfa}
                  onClick={() => setSayfa((s) => Math.min(sonSayfa, s + 1))}
                >
                  Sonraki →
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
