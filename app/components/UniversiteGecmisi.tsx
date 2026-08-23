"use client";

import { useEffect, useMemo, useState } from "react";

import TabanGrafik, { type Seri } from "./TabanGrafik";
import { puan as fmtPuan, tam } from "../lib/format";
import { MODEL, type PuanTuru } from "../lib/yks";

type ListeSatiri = {
  uni: string;
  ortalama: number | null;
  zirveYil: number | null;
  programSayisi?: number;
};

type Gecmis = {
  uni: string;
  yillar: number[];
  ortalamalar: (number | null)[];
  programSayilari: (number | null)[];
  zirveYil: number | null;
  zirveOrtalama: number | null;
  turkiyeOrtalamalari: (number | null)[];
};

type Props = { puanTuru: PuanTuru };

/** Sunucu yanıtı düz dizi de olabilir, sarmalanmış da; ikisini de kabul et. */
function listeCikar(json: unknown): ListeSatiri[] {
  if (Array.isArray(json)) return json as ListeSatiri[];
  if (json && typeof json === "object") {
    for (const alan of ["universiteler", "liste", "sonuclar"] as const) {
      const deger = (json as Record<string, unknown>)[alan];
      if (Array.isArray(deger)) return deger as ListeSatiri[];
    }
  }
  return [];
}

/** Türkçe'ye duyarlı, büyük-küçük harf farkını yok sayan arama anahtarı. */
const anahtar = (metin: string) =>
  metin.toLocaleLowerCase("tr").replace(/[İIıi]/g, "i").trim();

export default function UniversiteGecmisi({ puanTuru }: Props) {
  const [liste, setListe] = useState<ListeSatiri[]>([]);
  const [secili, setSecili] = useState<string | null>(null);
  const [gecmis, setGecmis] = useState<Gecmis | null>(null);
  const [ara, setAra] = useState("");
  const [hata, setHata] = useState<string | null>(null);

  /* --- Üniversite listesi -------------------------------------------------- */
  useEffect(() => {
    const kontrol = new AbortController();

    fetch(`/api/tarihce?puanTuru=${encodeURIComponent(puanTuru)}&limit=60`, {
      signal: kontrol.signal,
    })
      .then((yanit) => {
        if (!yanit.ok) throw new Error(`HTTP ${yanit.status}`);
        return yanit.json();
      })
      .then((json) => {
        const satirlar = listeCikar(json);
        setListe(satirlar);
        setHata(null);
        // Seçim yoksa listenin başındakini aç: grafik hiçbir zaman boş durmasın.
        setSecili((mevcut) => mevcut ?? satirlar[0]?.uni ?? null);
      })
      .catch((sebep) => {
        if (sebep.name === "AbortError") return;
        setHata("Üniversite listesi yüklenemedi.");
      });

    return () => kontrol.abort();
  }, [puanTuru]);

  /* --- Seçili üniversitenin serisi ---------------------------------------- */
  useEffect(() => {
    if (!secili) return;
    const kontrol = new AbortController();

    fetch(
      `/api/tarihce?uni=${encodeURIComponent(secili)}&puanTuru=${encodeURIComponent(puanTuru)}`,
      { signal: kontrol.signal },
    )
      .then((yanit) => {
        if (!yanit.ok) throw new Error(`HTTP ${yanit.status}`);
        return yanit.json() as Promise<Gecmis>;
      })
      .then((json) => { setGecmis(json); setHata(null); })
      .catch((sebep) => {
        if (sebep.name === "AbortError") return;
        setHata("Geçmiş veri yüklenemedi.");
      });

    return () => kontrol.abort();
  }, [secili, puanTuru]);

  const suzulmus = useMemo(() => {
    if (!ara.trim()) return liste;
    const a = anahtar(ara);
    return liste.filter((s) => anahtar(s.uni).includes(a));
  }, [liste, ara]);

  const seriler: Seri[] = useMemo(() => {
    if (!gecmis) return [];
    const cikti: Seri[] = [
      { ad: kisalt(gecmis.uni), degerler: gecmis.ortalamalar },
    ];
    if (gecmis.turkiyeOrtalamalari?.some((v) => v !== null)) {
      cikti.push({
        ad: `Türkiye ortalaması (${puanTuru})`,
        degerler: gecmis.turkiyeOrtalamalari,
        referans: true,
      });
    }
    return cikti;
  }, [gecmis, puanTuru]);

  if (hata && liste.length === 0) {
    return (
      <div className="bos-durum">
        <strong>{hata}</strong>
        <p>Bağlantını kontrol edip sayfayı yenile.</p>
      </div>
    );
  }

  const degisim =
    gecmis && gecmis.ortalamalar.length > 1
      ? sonFark(gecmis.ortalamalar)
      : null;

  return (
    <div className="grafik-duzen">
      <div className="grafik-yan">
        <label className="alan">
          <span className="label">Üniversite ara</span>
          <input
            type="search"
            value={ara}
            placeholder="Örn. Boğaziçi"
            onChange={(olay) => setAra(olay.target.value)}
          />
        </label>

        <div className="grafik-liste">
          {suzulmus.length === 0 ? (
            <p className="ozet-satir" style={{ padding: "var(--s-4)" }}>
              Eşleşen üniversite yok.
            </p>
          ) : (
            suzulmus.map((satir) => (
              <button
                key={satir.uni}
                type="button"
                aria-pressed={satir.uni === secili}
                onClick={() => setSecili(satir.uni)}
                title={satir.uni}
              >
                <span className="ad">{kisalt(satir.uni)}</span>
                <span className="deger">
                  {satir.ortalama === null ? "—" : fmtPuan(satir.ortalama)}
                </span>
              </button>
            ))
          )}
        </div>

        <p className="ozet-satir" style={{ margin: 0 }}>
          Liste, {MODEL.kilavuzYili} yılı {puanTuru} ortalamasına göre sıralı. Bir üniversiteye
          dokun; grafiği onun üç yıllık ortalaması olarak çizilir.
        </p>
      </div>

      <div>
        {gecmis ? (
          <>
            <div className="mod-satir">
              <h3 style={{ fontSize: "var(--fs-600)", margin: 0 }}>{gecmis.uni}</h3>
              {gecmis.zirveYil !== null && (
                <span className="zirve-rozet">
                  Zirve: <b>{gecmis.zirveYil}</b>
                  {gecmis.zirveOrtalama !== null && <> · <b>{fmtPuan(gecmis.zirveOrtalama)}</b></>}
                </span>
              )}
              {degisim !== null && (
                <span className={`durum ${degisim >= 0 ? "guvenli" : "zor"}`}>
                  <i aria-hidden="true" />
                  {degisim >= 0 ? "+" : "−"}
                  {fmtPuan(Math.abs(degisim))} puan ({gecmis.yillar[0]} →{" "}
                  {gecmis.yillar[gecmis.yillar.length - 1]})
                </span>
              )}
            </div>

            <TabanGrafik
              yillar={gecmis.yillar}
              seriler={seriler}
              zirveYil={gecmis.zirveYil}
              birim={`${puanTuru} taban puanı ortalaması`}
            />

            <p className="ozet-satir" style={{ marginTop: "var(--s-3)" }}>
              Altın halka ve kesikli dikey çizgi, bu üniversitenin{" "}
              <b>en yüksek ortalamayı aldığı yılı</b> gösterir. Ortalama, o yıl {puanTuru}{" "}
              türünde taban puanı yayımlanmış tüm programlarının ortalamasıdır
              {gecmis.programSayilari?.length ? (
                <> ({gecmis.programSayilari.map((n, i) =>
                  `${gecmis.yillar[i]}: ${n === null ? "—" : tam(n)}`).join(" · ")} program)</>
              ) : null}
              .
            </p>
          </>
        ) : (
          <div className="bos-durum">
            <strong>Yükleniyor…</strong>
            <p>Seçili üniversitenin üç yıllık taban puan ortalaması hazırlanıyor.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** Kılavuz adları "(İSTANBUL)" gibi ekler taşıyor; dar listede yer kaplıyor. */
function kisalt(ad: string): string {
  return ad.replace(/\s*\([^)]*\)\s*$/, "").trim() || ad;
}

/** İlk ve son dolu değerin farkı. */
function sonFark(degerler: (number | null)[]): number | null {
  const dolu = degerler.map((v, i) => ({ v, i })).filter((n): n is { v: number; i: number } => n.v !== null);
  if (dolu.length < 2) return null;
  return Math.round((dolu[dolu.length - 1].v - dolu[0].v) * 10) / 10;
}
