"use client";

import { useId, useState } from "react";

import { puan as fmtPuan } from "../lib/format";

export type Seri = {
  ad: string;
  /** Yıl sırasına göre değerler; veri olmayan yıl null. */
  degerler: (number | null)[];
  /** Kesikli çizgi ve nötr renk: karşılaştırma referansı, gerçek bir seri değil. */
  referans?: boolean;
};

type Props = {
  yillar: number[];
  seriler: Seri[];
  /** İşaretlenecek zirve yılı — o noktanın etrafına altın halka çizilir. */
  zirveYil?: number | null;
  /** Y ekseni birimi açıklaması, ör. "taban yerleştirme puanı". */
  birim?: string;
  yukseklik?: number;
};

const KENAR = { ust: 22, sag: 92, alt: 40, sol: 56 };
const GENISLIK = 760;

/** Ekseni "yuvarlak" bir aralığa oturt: 412,7 → 410, 486,2 → 490. */
function eksenAraligi(degerler: number[]): [number, number, number] {
  const enAz = Math.min(...degerler);
  const enCok = Math.max(...degerler);
  const yayilim = Math.max(enCok - enAz, 1);
  /*
   * Pay iki uçta da lazım: tek bir yılın farkı 2-3 puan olduğunda pay olmadan
   * çizgi tavana yapışıyor. Ama oransal pay büyük yayılımlarda (üniversite ile
   * Türkiye ortalaması 150 puan ayrıysa) grafiğin yarısını boş bırakıyordu, bu
   * yüzden üstten sınırlanıyor.
   */
  const pay = Math.min(Math.max(yayilim * 0.18, 3), 25);
  const alt = Math.floor((enAz - pay) / 5) * 5;
  const ust = Math.ceil((enCok + pay) / 5) * 5;
  const adim = (ust - alt) / 4;
  return [alt, ust, adim];
}

export default function TabanGrafik({
  yillar, seriler, zirveYil, birim = "taban yerleştirme puanı", yukseklik = 300,
}: Props) {
  const kimlik = useId();
  const [vurgu, setVurgu] = useState<{ seri: number; nokta: number } | null>(null);

  const tumDegerler = seriler.flatMap((s) => s.degerler).filter((v): v is number => v !== null);
  if (tumDegerler.length === 0) {
    return (
      <div className="bos-durum">
        <strong>Bu seçim için geçmiş veri yok.</strong>
        <p>Üç yılın hiçbirinde yayımlanmış taban puan bulunamadı.</p>
      </div>
    );
  }

  const [altSinir, ustSinir, adim] = eksenAraligi(tumDegerler);
  const cizimG = GENISLIK - KENAR.sol - KENAR.sag;
  const cizimY = yukseklik - KENAR.ust - KENAR.alt;

  const x = (i: number) =>
    KENAR.sol + (yillar.length === 1 ? cizimG / 2 : (i / (yillar.length - 1)) * cizimG);
  const y = (deger: number) =>
    KENAR.ust + cizimY - ((deger - altSinir) / (ustSinir - altSinir)) * cizimY;

  const yEtiketleri = Array.from({ length: 5 }, (_, i) => altSinir + i * adim);

  /** null'lar diziyi bölmemeli: kesintili seriyi ayrı parçalar hâlinde çiz. */
  function parcalar(degerler: (number | null)[]): { i: number; v: number }[][] {
    const cikti: { i: number; v: number }[][] = [];
    let simdi: { i: number; v: number }[] = [];
    degerler.forEach((v, i) => {
      if (v === null) {
        if (simdi.length) cikti.push(simdi);
        simdi = [];
      } else {
        simdi.push({ i, v });
      }
    });
    if (simdi.length) cikti.push(simdi);
    return cikti;
  }

  const zirveIndeks = zirveYil == null ? -1 : yillar.indexOf(zirveYil);
  const anaSeri = seriler.find((s) => !s.referans) ?? seriler[0];

  return (
    <div className="grafik-tuval">
      <svg
        viewBox={`0 0 ${GENISLIK} ${yukseklik}`}
        role="img"
        aria-labelledby={`${kimlik}-baslik`}
        onMouseLeave={() => setVurgu(null)}
      >
        {/* Tek metin düğümü — bkz. SehirHarita'daki aynı not. */}
        <title id={`${kimlik}-baslik`}>
          {`${anaSeri.ad} — ${yillar[0]}–${yillar[yillar.length - 1]} ${birim} değişimi`}
        </title>

        {/* --- Izgara ve y ekseni ------------------------------------------- */}
        {yEtiketleri.map((deger) => (
          <g key={deger}>
            <line
              x1={KENAR.sol}
              x2={GENISLIK - KENAR.sag}
              y1={y(deger)}
              y2={y(deger)}
              stroke="var(--grid)"
              strokeWidth="1"
            />
            <text
              x={KENAR.sol - 10}
              y={y(deger) + 4}
              textAnchor="end"
              fill="var(--text-3)"
              fontSize="11"
              fontFamily="var(--font-mono)"
            >
              {Math.round(deger)}
            </text>
          </g>
        ))}

        {/* --- X ekseni ------------------------------------------------------ */}
        {yillar.map((yil, i) => (
          <text
            key={yil}
            x={x(i)}
            y={yukseklik - KENAR.alt + 22}
            textAnchor="middle"
            fill={yil === zirveYil ? "var(--gold-ink)" : "var(--text-2)"}
            fontSize="12"
            fontWeight={yil === zirveYil ? 700 : 500}
            fontFamily="var(--font-mono)"
          >
            {yil}
          </text>
        ))}

        {/* --- Zirve yılının dikey vurgusu ----------------------------------- */}
        {zirveIndeks >= 0 && (
          <line
            x1={x(zirveIndeks)}
            x2={x(zirveIndeks)}
            y1={KENAR.ust}
            y2={yukseklik - KENAR.alt}
            stroke="var(--gold-500)"
            strokeWidth="2"
            strokeDasharray="3 4"
            opacity="0.55"
          />
        )}

        {/* --- Seriler ------------------------------------------------------- */}
        {seriler.map((seri, si) => {
          const renk = seri.referans ? "var(--grid-ink)" : `var(--seri-${si + 1})`;
          return (
            <g key={seri.ad}>
              {parcalar(seri.degerler).map((parca, pi) => (
                <polyline
                  key={pi}
                  points={parca.map((n) => `${x(n.i)},${y(n.v)}`).join(" ")}
                  fill="none"
                  stroke={renk}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={seri.referans ? "6 5" : undefined}
                />
              ))}

              {seri.degerler.map((deger, i) =>
                deger === null ? null : (
                  <g key={i}>
                    {/* Fare hedefi işaretten büyük tutulur. */}
                    <circle
                      cx={x(i)}
                      cy={y(deger)}
                      r="14"
                      fill="transparent"
                      onMouseEnter={() => setVurgu({ seri: si, nokta: i })}
                    />
                    <circle
                      cx={x(i)}
                      cy={y(deger)}
                      r={vurgu?.seri === si && vurgu.nokta === i ? 6.5 : 5}
                      fill={renk}
                      stroke="var(--surface-2)"
                      strokeWidth="2"
                    />
                    {/* Zirve noktası ayrıca altın halkayla işaretlenir. */}
                    {!seri.referans && i === zirveIndeks && (
                      <circle
                        cx={x(i)}
                        cy={y(deger)}
                        r="10"
                        fill="none"
                        stroke="var(--gold-500)"
                        strokeWidth="2.5"
                      />
                    )}
                  </g>
                ),
              )}

              {/* Doğrudan etiket: seri adı son noktanın sağında — lejant tek başına
                  kalmasın, renk kimliğin tek taşıyıcısı olmasın. */}
              {(() => {
                const sonIndeks = [...seri.degerler].map((v, i) => (v === null ? -1 : i))
                  .filter((i) => i >= 0).pop();
                if (sonIndeks === undefined) return null;
                const deger = seri.degerler[sonIndeks] as number;
                return (
                  <text
                    x={x(sonIndeks) + 12}
                    y={y(deger) + 4}
                    fill="var(--text-2)"
                    fontSize="11"
                    fontWeight={seri.referans ? 400 : 700}
                  >
                    {fmtPuan(deger)}
                  </text>
                );
              })()}
            </g>
          );
        })}

        {/* --- Vurgulanan noktanın değeri ------------------------------------ */}
        {vurgu && seriler[vurgu.seri].degerler[vurgu.nokta] !== null && (
          <g pointerEvents="none">
            <rect
              x={Math.min(x(vurgu.nokta) - 52, GENISLIK - KENAR.sag - 104)}
              y={y(seriler[vurgu.seri].degerler[vurgu.nokta] as number) - 44}
              width="104"
              height="34"
              rx="6"
              fill="var(--navy-900)"
            />
            <text
              x={Math.min(x(vurgu.nokta), GENISLIK - KENAR.sag - 52)}
              y={y(seriler[vurgu.seri].degerler[vurgu.nokta] as number) - 29}
              textAnchor="middle"
              fill="var(--on-navy-2)"
              fontSize="10"
            >
              {yillar[vurgu.nokta]} · {seriler[vurgu.seri].ad}
            </text>
            <text
              x={Math.min(x(vurgu.nokta), GENISLIK - KENAR.sag - 52)}
              y={y(seriler[vurgu.seri].degerler[vurgu.nokta] as number) - 16}
              textAnchor="middle"
              fill="#ffffff"
              fontSize="12"
              fontWeight="700"
              fontFamily="var(--font-mono)"
            >
              {fmtPuan(seriler[vurgu.seri].degerler[vurgu.nokta] as number)}
            </text>
          </g>
        )}
      </svg>

      {/* Lejant: iki ve üzeri seride her zaman var. */}
      {seriler.length > 1 && (
        <div className="grafik-lejant">
          {seriler.map((seri, si) => (
            <span
              key={seri.ad}
              style={{ color: seri.referans ? "var(--grid-ink)" : `var(--seri-${si + 1})` }}
            >
              <i aria-hidden="true" />
              <span style={{ color: "var(--text-2)" }}>{seri.ad}</span>
            </span>
          ))}
        </div>
      )}

      {/* Renk tek erişim yolu olmasın: aynı veri tablo olarak da okunabilir. */}
      <table className="sr-only">
        <caption>{birim} — yıllara göre</caption>
        <thead>
          <tr>
            <th scope="col">Seri</th>
            {yillar.map((yil) => <th key={yil} scope="col">{yil}</th>)}
          </tr>
        </thead>
        <tbody>
          {seriler.map((seri) => (
            <tr key={seri.ad}>
              <th scope="row">{seri.ad}</th>
              {seri.degerler.map((deger, i) => (
                <td key={i}>{deger === null ? "veri yok" : fmtPuan(deger)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
