"use client";

import { useEffect, useState } from "react";

import { puan as fmtPuan, tam } from "../lib/format";
import type { Program } from "../lib/veri";
import type { PuanTuru } from "../lib/yks";

type UcSonucu = {
  enYuksek?: Program[];
  enDusuk?: Program[];
  /** Kontenjanı dolmadığı için taban puanı hiç yayımlanmayan programlar. */
  dolmayan?: Program[];
};

type Props = {
  puanTuru: PuanTuru;
  limit?: number;
};

export default function UcNoktalar({ puanTuru, limit = 12 }: Props) {
  const [veri, setVeri] = useState<UcSonucu | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    const kontrol = new AbortController();

    fetch(`/api/istatistik?tur=uc&puanTuru=${encodeURIComponent(puanTuru)}&limit=${limit}`, {
      signal: kontrol.signal,
    })
      .then((yanit) => {
        if (!yanit.ok) throw new Error(`HTTP ${yanit.status}`);
        return yanit.json() as Promise<UcSonucu>;
      })
      .then((json) => { setVeri(json); setHata(null); })
      .catch((sebep) => {
        if (sebep.name === "AbortError") return;
        setHata("Uç noktalar yüklenemedi.");
      });

    return () => kontrol.abort();
  }, [puanTuru, limit]);

  if (hata) {
    return (
      <div className="bos-durum">
        <strong>{hata}</strong>
        <p>Bağlantını kontrol edip sayfayı yenile.</p>
      </div>
    );
  }

  return (
    <div className="grid-2">
      <Liste
        baslik="En yüksek puanla kapananlar"
        aciklama={`${puanTuru} türünde kontenjanını en yüksek taban puanla dolduran programlar. Listenin başı, o yıl girilmesi en zor olan yerdir.`}
        ikon="↑"
        ikonSinif="yuksek"
        programlar={veri?.enYuksek ?? []}
      />
      <Liste
        baslik="En düşük puanla kapananlar"
        aciklama={`Kontenjanı DOLAN ama en düşük taban puanla kapanan programlar. Hiç dolmayanlar bu listeye girmez — onların taban puanı yayımlanmaz.`}
        ikon="↓"
        ikonSinif="dusuk"
        programlar={veri?.enDusuk ?? []}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Liste({
  baslik, aciklama, ikon, ikonSinif, programlar,
}: {
  baslik: string;
  aciklama: string;
  ikon: string;
  ikonSinif: "yuksek" | "dusuk";
  programlar: Program[];
}) {
  return (
    <article className="card uc-kart">
      <div className="card-head">
        <span className={`uc-ikon ${ikonSinif}`} aria-hidden="true">{ikon}</span>
        <h3>{baslik}</h3>
      </div>
      <div className="card-body">
        <p className="ozet-satir">{aciklama}</p>

        {programlar.length === 0 ? (
          <p className="ozet-satir">Yükleniyor…</p>
        ) : (
          <div className="uc-liste">
            {programlar.map((program, i) => (
              <div className="uc-satir" key={program.kod}>
                <span className="uc-no">{i + 1}</span>
                <span className="uc-ad">
                  <a
                    href={`https://yokatlas.yok.gov.tr/detay/${program.kod}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {program.bolum}
                  </a>
                  <span>
                    {program.uni}
                    {program.il ? ` · ${program.il}` : ""}
                  </span>
                </span>
                <span className="uc-puan">
                  <b>{program.tabanPuan === null ? "—" : fmtPuan(program.tabanPuan)}</b>
                  <span>
                    {program.tabanSira === null ? "sıra yok" : `${tam(program.tabanSira)}. sıra`}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
