"use client";

import { useId, useMemo, useState } from "react";

import { tam } from "../lib/format";

export type SehirNoktasi = {
  il: string;
  lat: number;
  lon: number;
  bolge: string;
  universiteSayisi: number;
  programSayisi: number;
  kontenjanToplami: number;
};

type Props = {
  iller: SehirNoktasi[];
  secili: string | null;
  onSec: (il: string | null) => void;
  /** Kabarcık büyüklüğünü hangi ölçü belirliyor. */
  olcu?: "program" | "universite" | "kontenjan";
};

/*
 * Türkiye'nin sınırları. Basit eş dikdörtgen izdüşüm kullanılıyor: bu enlemde
 * boylam dereceleri enlem derecelerinden dar olduğu için x ekseni cos(orta enlem)
 * ile daraltılır, yoksa ülke doğu-batı yönünde gerilmiş görünür. Gerçek bir ülke
 * sınırı çizilmiyor — 81 il merkezinin kendisi tanınabilir bir şekil oluşturuyor
 * ve uydurma bir sınır çizgisi veriden fazlasını iddia etmiş olurdu.
 */
const SINIR = { lonMin: 25.4, lonMax: 45.2, latMin: 34.8, latMax: 42.4 };
const ORTA_ENLEM_KOS = Math.cos(((SINIR.latMin + SINIR.latMax) / 2) * (Math.PI / 180));
const TUVAL_G = 800;
const KENAR = 26;

const cizimG = TUVAL_G - KENAR * 2;
const lonYayilim = (SINIR.lonMax - SINIR.lonMin) * ORTA_ENLEM_KOS;
const latYayilim = SINIR.latMax - SINIR.latMin;
const cizimY = (cizimG * latYayilim) / lonYayilim;
const TUVAL_Y = cizimY + KENAR * 2;

const OLCU_ADI = {
  program: "program",
  universite: "üniversite",
  kontenjan: "kontenjan",
} as const;

export default function SehirHarita({ iller, secili, onSec, olcu = "program" }: Props) {
  const kimlik = useId();
  const [uzerinde, setUzerinde] = useState<string | null>(null);

  const deger = (n: SehirNoktasi) =>
    olcu === "universite" ? n.universiteSayisi
      : olcu === "kontenjan" ? n.kontenjanToplami
        : n.programSayisi;

  const enBuyuk = Math.max(1, ...iller.map(deger));


  const konum = (n: SehirNoktasi) => ({
    x: KENAR + ((n.lon - SINIR.lonMin) * ORTA_ENLEM_KOS / lonYayilim) * cizimG,
    y: KENAR + ((SINIR.latMax - n.lat) / latYayilim) * cizimY,
  });

  /*
   * Yarıçap alanla orantılı olmalı (√), yoksa büyük şehirler gerçek farkın kat
   * kat üstünde görünür. Taban 3 px: en küçük il de tıklanabilir kalsın.
   */
  const yaricap = (n: SehirNoktasi) => 3 + Math.sqrt(deger(n) / enBuyuk) * 23;

  /*
   * Tek hue'lu yoğunluk rampası. Taban basamak 1 değil 2: dağılım öyle çarpık ki
   * (İstanbul tek başına ikinciden üç kat büyük) illerin çoğu en açık basamağa
   * düşüyor ve zeminden ayırt edilemiyordu. Büyüklüğü zaten yarıçap taşıyor;
   * renk burada ikincil kodlama.
   */
  const rampa = (n: SehirNoktasi) => {
    const oran = deger(n) / enBuyuk;
    const basamak = oran > 0.5 ? 5 : oran > 0.2 ? 4 : oran > 0.06 ? 3 : 2;
    return `var(--ramp-${basamak})`;
  };

  /*
   * Kutunun dışına düşen kayıtlar (kılavuzdaki tek yurt dışı kampüsü, Saraybosna)
   * haritaya konmaz. Alternatifi kutuyu Bosna'yı içine alacak kadar büyütmekti;
   * o zaman Türkiye haritanın küçük bir köşesine sıkışıyor ve asıl bilgi
   * okunmaz hâle geliyordu. Dışarıda kalanlar altta ayrıca sayılır.
   */
  const icerde = iller.filter(
    (n) => n.lat >= SINIR.latMin && n.lat <= SINIR.latMax
      && n.lon >= SINIR.lonMin && n.lon <= SINIR.lonMax,
  );
  const disarida = iller.length - icerde.length;

  /* Büyükten küçüğe çizilir ki küçük noktalar büyüklerin üstünde kalsın. */
  const sirali = useMemo(
    () => [...icerde].sort((a, b) => deger(b) - deger(a)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [iller, olcu],
  );

  /*
   * Yalnızca en büyük altı ilin adı yazılır. Sekizde İstanbul ile Bursa'nın
   * etiketleri üst üste biniyordu; kabarcıklar zaten tıklanabilir ve ipucu
   * gösteriyor, o yüzden etiket kalabalığı bilgi değil gürültü.
   */
  const etiketliler = new Set(sirali.slice(0, 6).map((n) => n.il));

  const gosterilen = uzerinde ?? secili;
  const gosterilenNokta = gosterilen ? iller.find((n) => n.il === gosterilen) : null;

  return (
    <div className={`harita-tuval${secili ? " secili-var" : ""}`}>
      <svg
        viewBox={`0 0 ${TUVAL_G} ${TUVAL_Y}`}
        role="img"
        aria-labelledby={`${kimlik}-baslik`}
        onMouseLeave={() => setUzerinde(null)}
      >
        {/* SVG <title> tek bir metin düğümü olmak zorunda: React, dizi çocuğu
            verilen <title>'ı sunucu ve istemcide farklı serileştiriyor ve sayfa
            hydration hatasıyla yeniden kuruluyordu. */}
        <title id={`${kimlik}-baslik`}>
          {`Türkiye haritasında illere göre ${OLCU_ADI[olcu]} dağılımı; ` +
            `kabarcık büyüklüğü ${OLCU_ADI[olcu]} sayısıyla orantılı`}
        </title>

        {sirali.map((nokta) => {
          const { x, y } = konum(nokta);
          const r = yaricap(nokta);
          const isaretli = nokta.il === gosterilen;
          return (
            <g
              key={nokta.il}
              className={`harita-nokta${nokta.il === secili ? " secili" : ""}`}
              role="button"
              tabIndex={0}
              aria-pressed={nokta.il === secili}
              aria-label={`${nokta.il}: ${tam(deger(nokta))} ${OLCU_ADI[olcu]}`}
              onMouseEnter={() => setUzerinde(nokta.il)}
              onFocus={() => setUzerinde(nokta.il)}
              onBlur={() => setUzerinde(null)}
              onClick={() => onSec(nokta.il === secili ? null : nokta.il)}
              onKeyDown={(olay) => {
                if (olay.key !== "Enter" && olay.key !== " ") return;
                olay.preventDefault();
                onSec(nokta.il === secili ? null : nokta.il);
              }}
            >
              <circle
                cx={x}
                cy={y}
                r={r}
                fill={rampa(nokta)}
                fillOpacity={isaretli ? 0.95 : 0.75}
                stroke={isaretli ? "var(--gold-500)" : "var(--surface-2)"}
                strokeWidth={isaretli ? 2.5 : 1.5}
              />
              {etiketliler.has(nokta.il) && (
                <text
                  x={x}
                  y={y + r + 12}
                  textAnchor="middle"
                  fill="var(--text-2)"
                  fontSize="11"
                  fontWeight="600"
                  pointerEvents="none"
                >
                  {nokta.il}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {disarida > 0 && (
        <p className="ozet-satir" style={{ marginTop: "var(--s-2)" }}>
          {disarida} kayıt harita kutusunun dışında kaldığı için çizilmedi; sağdaki listede
          yerini koruyor.
        </p>
      )}

      {/* --- Büyüklük lejantı ------------------------------------------------ */}
      <div className="harita-lejant">
        <span className="label">Kabarcık = {OLCU_ADI[olcu]} sayısı</span>
        <svg viewBox="0 0 220 56" width="220" height="56" aria-hidden="true">
          {[0.05, 0.3, 1].map((oran, i) => {
            const r = 3 + Math.sqrt(oran) * 23;
            const cx = 30 + i * 70;
            return (
              <g key={oran}>
                <circle
                  cx={cx}
                  cy={30}
                  r={r}
                  fill="none"
                  stroke="var(--border-strong)"
                  strokeWidth="1.5"
                />
                <text x={cx} y={52} textAnchor="middle" fill="var(--text-3)" fontSize="10">
                  {tam(Math.round(enBuyuk * oran))}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* --- İpucu ------------------------------------------------------------ */}
      {gosterilenNokta && (
        <div
          className="harita-ipucu"
          style={{
            left: `${(konum(gosterilenNokta).x / TUVAL_G) * 100}%`,
            top: `${(konum(gosterilenNokta).y / TUVAL_Y) * 100}%`,
            transform: "translate(-50%, calc(-100% - 14px))",
          }}
        >
          <b>{gosterilenNokta.il}</b>
          <span>{gosterilenNokta.bolge}</span>
          <br />
          {tam(gosterilenNokta.universiteSayisi)} üniversite ·{" "}
          {tam(gosterilenNokta.programSayisi)} program
          <br />
          {tam(gosterilenNokta.kontenjanToplami)} kontenjan
        </div>
      )}
    </div>
  );
}
