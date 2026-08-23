const nf = new Intl.NumberFormat("tr-TR");
const nf1 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });

/** Tam sayı: 128.400 */
export const tam = (value: number) => nf.format(Math.round(value));

/** Sabit tek ondalık — puanlar sütun halinde hizalansın diye: 412,3 */
export const puan = (value: number) => nf1.format(value);

/** Değişken ondalık — netler: 32 / 30,75 */
export const net = (value: number) => nf2.format(value);

/** İşaretli fark: +8,4 / −3,1 */
export const fark = (value: number) => `${value >= 0 ? "+" : "−"}${nf1.format(Math.abs(value))}`;

/**
 * İşaretli tam sayı farkı: +1.067 / −35. Sıralama farkları için; "−35,0 sıra"
 * gibi bir ondalık, sayılamayan bir şeyde ondalık varmış izlenimi veriyordu.
 */
export const farkTam = (value: number) =>
  `${value >= 0 ? "+" : "−"}${nf.format(Math.abs(Math.round(value)))}`;

const nfPara = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });

/**
 * Yıllık ücret. Simge yerine "TL" yazılır: tablo meta satırı monospace ve o
 * yazı tipinde ₺ glifi bulunmadığı için simge yanlış karakterle çiziliyordu.
 */
export const para = (value: number) => `${nfPara.format(value)} TL`;
