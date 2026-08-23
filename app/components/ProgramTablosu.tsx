"use client";

import { fark as fmtFark, farkTam as fmtFarkTam, para, puan as fmtPuan, tam } from "../lib/format";
import type { ProgramSonucu, Risk } from "../lib/veri";
import type { BulmaModu } from "./ProgramBulucu";

const DURUM_ADI: Record<Risk, string> = {
  guvenli: "Güvenli",
  sinirda: "Sınırda",
  zor: "Zor",
  bilinmiyor: "Veri yok",
};

const UNI_TURU_ADI: Record<string, string> = {
  DEVLET: "Devlet",
  VAKIF: "Vakıf",
  KKTC: "KKTC",
  "YURTDIŞI": "Yurt dışı",
};

type Props = {
  programlar: ProgramSonucu[];
  kilavuzYili: number;
  yukleniyor: boolean;
  toplam: number;
  mod: BulmaModu;
};

export default function ProgramTablosu({ programlar, kilavuzYili, yukleniyor, toplam, mod }: Props) {
  if (!yukleniyor && programlar.length === 0) {
    return (
      <div className="bos-durum">
        <strong>Bu filtrelerle program bulunamadı.</strong>
        <p>
          Filtreleri gevşetmeyi dene — örneğin il ya da üniversite kısıtını kaldır, veya
          &quot;{mod === "sira" ? "sıramın" : "puanımın"} yettikleri&quot; seçimini kapat.
        </p>
      </div>
    );
  }

  return (
    <div className={`tablo-sarmal${yukleniyor ? " yukleniyor" : ""}`} aria-busy={yukleniyor}>
      <table className="veri">
        <caption className="sr-only">
          {tam(toplam)} program, {kilavuzYili} tercih kılavuzu taban değerleriyle
        </caption>
        <thead>
          <tr>
            <th scope="col">Program</th>
            <th scope="col">Şehir</th>
            <th scope="col" className="num">Kontenjan</th>
            <th scope="col" className="num">{kilavuzYili} taban puanı</th>
            <th scope="col" className="num">{kilavuzYili} taban sırası</th>
            <th scope="col">Durum</th>
          </tr>
        </thead>
        <tbody>
          {programlar.map((program) => (
            <tr key={program.kod}>
              <th scope="row">
                <a
                  className="program-ad"
                  href={`https://yokatlas.yok.gov.tr/detay/${program.kod}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {program.bolum}
                </a>
                <span className="program-uni">{program.uni}</span>
                <span className="program-meta">
                  <span>{UNI_TURU_ADI[program.uniTur] ?? program.uniTur}</span>
                  <span>{program.sure} yıl</span>
                  <span>{program.ogretim}</span>
                  {program.burs && <span>{program.burs}</span>}
                  {program.odenecekUcret ? <span>{para(program.odenecekUcret)}</span> : null}
                  <span>Kod {program.kod}</span>
                </span>
              </th>
              <td>{program.il ?? <span className="yok">—</span>}</td>
              <td className="num">{tam(program.kontenjan)}</td>
              <td className="num">
                {program.tabanPuan === null
                  ? <span className="yok">dolmadı</span>
                  : fmtPuan(program.tabanPuan)}
              </td>
              <td className="num">
                {program.tabanSira === null ? <span className="yok">—</span> : tam(program.tabanSira)}
              </td>
              <td>
                <span className={`durum ${program.risk}`}>
                  <i aria-hidden="true" />
                  {DURUM_ADI[program.risk]}
                </span>
                {/*
                  Fark, aramanın hangi moda göre yapıldığını yansıtır: puan modunda
                  puan farkı, sıra modunda kaç sıra önde/geride olunduğu. İkisini
                  birden göstermek satırı okunmaz yapıyordu.
                */}
                {mod === "sira" && program.siraFarki !== null ? (
                  <span className="durum-fark">{fmtFarkTam(program.siraFarki)} sıra</span>
                ) : program.puanFarki !== null ? (
                  <span className="durum-fark">{fmtFark(program.puanFarki)} puan</span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
