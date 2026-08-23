"use client";

import { useEffect, useMemo, useState } from "react";

import SehirHarita, { type SehirNoktasi } from "./SehirHarita";
import { puan as fmtPuan, tam } from "../lib/format";
import type { PuanTuru } from "../lib/yks";

/** Bir ildeki uç program — en yüksek ya da en düşük tabanlı. */
type UcProgram = {
  kod: number;
  uni: string;
  bolum: string;
  puan: number;
  sira: number | null;
};

type Sehir = SehirNoktasi & {
  enYuksekTaban: UcProgram | null;
  enDusukTaban: UcProgram | null;
};

type Props = { puanTuru: PuanTuru };

type Olcu = "program" | "universite" | "kontenjan";

const OLCULER: { id: Olcu; ad: string }[] = [
  { id: "program", ad: "Program sayısı" },
  { id: "universite", ad: "Üniversite sayısı" },
  { id: "kontenjan", ad: "Kontenjan" },
];

/**
 * Sunucu yanıtını diziye indirger. Uç, listeyi düz dizi olarak da sarmalanmış
 * olarak da döndürebilir; arayüz bunun hangisi olduğuna bağlı olmamalı.
 */
function listeCikar(json: unknown): Sehir[] {
  if (Array.isArray(json)) return json as Sehir[];
  if (json && typeof json === "object") {
    for (const alan of ["sehirler", "iller", "dagilim"] as const) {
      const deger = (json as Record<string, unknown>)[alan];
      if (Array.isArray(deger)) return deger as Sehir[];
    }
  }
  return [];
}

export default function SehirPanosu({ puanTuru }: Props) {
  const [sehirler, setSehirler] = useState<Sehir[]>([]);
  const [secili, setSecili] = useState<string | null>(null);
  const [olcu, setOlcu] = useState<Olcu>("program");
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    const kontrol = new AbortController();

    fetch(`/api/istatistik?tur=sehir&puanTuru=${encodeURIComponent(puanTuru)}`, {
      signal: kontrol.signal,
    })
      .then((yanit) => {
        if (!yanit.ok) throw new Error(`HTTP ${yanit.status}`);
        return yanit.json();
      })
      .then((json) => {
        setSehirler(listeCikar(json).filter((s) => s.lat && s.lon));
        setHata(null);
      })
      .catch((sebep) => {
        if (sebep.name === "AbortError") return;
        setHata("Şehir dağılımı yüklenemedi.");
      });

    return () => kontrol.abort();
  }, [puanTuru]);

  const seciliSehir = useMemo(
    () => sehirler.find((s) => s.il === secili) ?? null,
    [sehirler, secili],
  );

  const toplam = useMemo(
    () => ({
      il: sehirler.length,
      uni: sehirler.reduce((s, n) => s + n.universiteSayisi, 0),
      program: sehirler.reduce((s, n) => s + n.programSayisi, 0),
    }),
    [sehirler],
  );

  const olcuDegeri = (s: Sehir) =>
    olcu === "universite" ? s.universiteSayisi
      : olcu === "kontenjan" ? s.kontenjanToplami
        : s.programSayisi;

  const siraliListe = useMemo(
    () => [...sehirler].sort((a, b) => olcuDegeri(b) - olcuDegeri(a)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sehirler, olcu],
  );

  if (hata) {
    return (
      <div className="bos-durum">
        <strong>{hata}</strong>
        <p>Bağlantını kontrol edip sayfayı yenile.</p>
      </div>
    );
  }

  return (
    <>
      <div className="cipler">
        {OLCULER.map((o) => (
          <button
            key={o.id}
            type="button"
            className="chip-btn"
            aria-pressed={olcu === o.id}
            onClick={() => setOlcu(o.id)}
          >
            {o.ad}
          </button>
        ))}
        {secili && (
          <button type="button" className="ghost-btn" onClick={() => setSecili(null)}>
            {secili} seçimini kaldır
          </button>
        )}
        <span className="ozet-satir" style={{ margin: 0, marginInlineStart: "auto" }}>
          <b>{tam(toplam.il)}</b> ilde <b>{tam(toplam.uni)}</b> üniversite,{" "}
          <b>{tam(toplam.program)}</b> {puanTuru} programı
        </span>
      </div>

      <div className="harita-duzen">
        <SehirHarita iller={sehirler} secili={secili} onSec={setSecili} olcu={olcu} />

        <div>
          <div className="il-liste">
            {siraliListe.map((sehir) => (
              <button
                key={sehir.il}
                type="button"
                className="il-satir"
                aria-pressed={sehir.il === secili}
                onClick={() => setSecili(sehir.il === secili ? null : sehir.il)}
              >
                <span>
                  <span className="il-ad">{sehir.il}</span>
                  <span className="il-alt">
                    {sehir.bolge} · {tam(sehir.universiteSayisi)} üniversite
                  </span>
                </span>
                <span className="il-sayi">{tam(olcuDegeri(sehir))}</span>
              </button>
            ))}
          </div>

          {seciliSehir && (
            <div className="il-detay">
              <h4>{seciliSehir.il}</h4>
              <dl>
                <dt>Bölge</dt>
                <dd>{seciliSehir.bolge}</dd>
                <dt>Üniversite</dt>
                <dd>{tam(seciliSehir.universiteSayisi)}</dd>
                <dt>Program</dt>
                <dd>{tam(seciliSehir.programSayisi)} ({puanTuru})</dd>
                <dt>Kontenjan</dt>
                <dd>{tam(seciliSehir.kontenjanToplami)}</dd>

                <dt>En yüksek taban</dt>
                <dd>
                  {seciliSehir.enYuksekTaban ? (
                    <>
                      <a
                        href={`https://yokatlas.yok.gov.tr/detay/${seciliSehir.enYuksekTaban.kod}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {seciliSehir.enYuksekTaban.bolum}
                      </a>
                      {" — "}{seciliSehir.enYuksekTaban.uni}
                      {" · "}
                      <b className="num">{fmtPuan(seciliSehir.enYuksekTaban.puan)}</b>
                    </>
                  ) : (
                    <span className="yok">yayımlanmadı</span>
                  )}
                </dd>

                <dt>En düşük taban</dt>
                <dd>
                  {seciliSehir.enDusukTaban ? (
                    <>
                      <a
                        href={`https://yokatlas.yok.gov.tr/detay/${seciliSehir.enDusukTaban.kod}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {seciliSehir.enDusukTaban.bolum}
                      </a>
                      {" — "}{seciliSehir.enDusukTaban.uni}
                      {" · "}
                      <b className="num">{fmtPuan(seciliSehir.enDusukTaban.puan)}</b>
                      {seciliSehir.enDusukTaban.sira !== null && (
                        <> ({tam(seciliSehir.enDusukTaban.sira)}. sıra)</>
                      )}
                    </>
                  ) : (
                    <span className="yok">yayımlanmadı</span>
                  )}
                </dd>
              </dl>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
