# Rota — YKS puan ve tercih aracı

Netlerini bir kez gir; beş puan türünün tamamını, OBP'li yerleştirme puanını ve tahmini
başarı sıranı gör, sonra YÖK Atlas tercih kılavuzunun tamamında hangi programlara
yettiğini ara.

Bağımsız bir araçtır, ÖSYM ile ilişkisi yoktur.

## Neler yapıyor

- **Puan hesaplama** — tek cevap kâğıdından TYT, SAY, EA, SÖZ ve DİL puanlarının hepsi.
- **Tercih bulucu, iki modlu** — puanınla ara ya da doğrudan başarı sıranı yaz
  ("1000. sıradayım, nereye girerim?"). Sıra modunda risk etiketleri taban puana değil
  taban sıraya göre hesaplanır.
- **Taban puan geçmişi** — üniversitelerin 2023–2025 taban puan ortalaması ve
  **en yüksek ortalamayı aldıkları yıl** işaretli çizgi grafik, Türkiye ortalamasına karşı.
- **Şehir dağılımı** — hangi ilde kaç üniversite, kaç program, kaç kontenjan; her ilin en
  yüksek ve **en düşük tabanlı programı** hangisi. Kabarcık haritası + sıralı liste.
- **Uç noktalar** — en yüksek ve en düşük puanla kapanan programlar, ayrı listeler hâlinde.
- **Açık / koyu tema** — sistem tercihini izler, düğmeyle geçilir, seçim saklanır.

## Neden bir tahmin, ve ne kadar iyi bir tahmin

ÖSYM puanları standart puanlar (z-skoru) üzerinden hesaplar ve net → puan için açık bir
formül yayımlamaz. Bu yüzden burada bir formül **uydurulmadı**; model, YÖK Atlas'ın
yayımladığı gerçek kayıtlardan çözüldü.

`scripts/veri-cek.mjs` her programın taban adayının net dökümünü, taban puanını, OBP'sini
ve OBP katsayısını çeker; hedef değişken olarak

```
ham (sınav) puanı = taban puan − OBP × katsayı
```

kullanıp her puan türü için `ham puan = sabit + Σ (net × katsayı)` modelini en küçük
kareler ile çözer. Son kalibrasyondaki ölçülen hata:

| Puan türü | Kayıt | RMSE | R² | Ayrılan kümede RMSE |
|---|---:|---:|---:|---:|
| SAY | 5.264 | 3,43 | 0,998 | 3,21 |
| EA | 3.841 | 5,26 | 0,994 | 4,56 |
| SÖZ | 1.870 | 5,72 | 0,993 | 5,78 |
| DİL | 659 | 5,50 | 0,996 | 6,30 |
| TYT | 9.186 | 5,91 | 0,984 | 5,86 |

Son sütun, katsayıların yalnızca %80'lik eğitim kümesine oturtulup kalan %20'de ölçüldüğü
durumdur; eğitim hatasına yakın olması modelin veriyi ezberlemediğini gösterir. Güncel
sayılar her zaman `data/model.json` içindedir ve arayüzdeki "Hesap nasıl yapılıyor?"
bölümünde gösterilir.

Başarı sırası ayrıca modellenir: kılavuzdaki binlerce programın gerçek
(taban puan, taban başarı sırası) çiftinden monoton bir eğri çıkarılır. Taban puan OBP
dahil olduğu için, eğri sınav puanı birimine çevrilirken her programın taban adayının OBP
katkısı bir önceki yılın kayıtlarından düşülür.

Bir testin neti negatif olabilir — gerçek veride net dökümlerinin %6,7'si negatiftir
(en düşüğü −8,75), bu yüzden sıfıra kırpılmaz.

**Sınırları:** katsayılar `kalibrasyonYili` sınav istatistiklerini yansıtır; bu yılın soru
güçlüğü değiştiğinde gerçek puan sapar. Taban puanlar `kilavuzYili` yerleştirmesinin
sonucudur. Model `kalibrasyonAraligi` dışındaki puanlarda ekstrapolasyon yapar ve arayüz
bunu uyarır.

## Kurulum

```bash
npm install
npm run veri     # YÖK Atlas'tan veriyi çeker ve data/ altını üretir
npm run dev
```

`npm run veri` dört dosya yazar:

| Dosya | İçerik |
|---|---|
| `data/programlar.json` | Tercih kılavuzunun tamamı (~21,5 bin program), taban puan ve sıra dahil |
| `data/model.json` | Puan türü başına katsayılar, ölçülen hata, sıralama eğrisi, filtre seçenekleri |
| `data/tarihce.json` | 2023–2025 taban puanları: program başına seri, üniversite ve Türkiye ortalamaları, zirve yılı |
| `data/dogrulama.json` | Ayrılan kümeden 400 kayıt — testler modeli buna karşı sınar |

Ayrıca `data/il-koordinat.json` elle bakımı yapılan bir tablodur (81 il + KKTC + yurt dışı
kampüs ülkesi, enlem/boylam ve coğrafi bölge) ve `npm run veri` tarafından üretilmez.

Hepsi commit edilir; uygulamanın çalışması için ağ bağlantısı gerekmez. Veriyi tazelemek
için script'i yeniden çalıştırıp çıktıyı commit etmek yeterlidir.

## Testler

```bash
npm test
```

`test/model.test.ts` modeli gerçek kayıtlara karşı doğrular (ölçülen hatanın üstüne
çıkarsa kırmızıya döner), ayrıca net/baraj/OBP kurallarını, girdi kırpmasını ve sıralama
eğrisinin monotonluğunu sınar. `test/arama.test.ts` arama katmanını gerçek veri üzerinde
çalıştırır. `test/siralama.test.ts` sıra tabanlı risk sınıflamasını, `test/istatistik.test.ts`
şehir dağılımı ile uç noktaları, `test/tarihce.test.ts` üç yıllık serileri ve zirve yılını
sınar.

## Yapı

```
app/lib/yks.ts           puan ve sıralama modeli (data/model.json'u uygular)
app/lib/veri.ts          program arama (puan VE sıra modu) — SADECE SUNUCU
app/lib/tarihce.ts       2023–2025 taban puan serileri, zirve yılı — SADECE SUNUCU
app/lib/istatistik.ts    şehir dağılımı, uç noktalar, özet — SADECE SUNUCU
app/api/programlar/      arama ucu (?puan= veya ?sira=)
app/api/tarihce/         ?kod= | ?uni= | zirveye göre üniversite listesi
app/api/istatistik/      ?tur=sehir | uc | ozet
app/components/          hesaplayıcı, sonuç panosu, bulucu, grafik, harita, uç noktalar
scripts/veri-cek.mjs     veri çekme + model kalibrasyonu + tarihçe üretimi
```

Veri okuma üç sunucu modülünde toplandı (`veri.ts`, `tarihce.ts`, `istatistik.ts`);
`programlar.json`'u fiilen okuyan tek yer hâlâ `veri.ts`'tir, bir gün Postgres'e
taşınırsa değişmesi gereken dosya odur.

Görsel dil, `yukselenkoleji.k12.tr/yks-puan-hesaplama` sayfası referans alınarak kuruldu:
lacivert üst bant, altın vurgu, koyu gradyanlı sonuç kutuları. Renk jetonlarının tamamı
`app/globals.css` başındadır; grafik seri renkleri gözle değil, `dataviz` doğrulayıcısıyla
(OKLab ΔE, renk körlüğü benzetimi, yüzeye karşı kontrast) seçildi.

## Kaynaklar

- [YÖK Atlas](https://yokatlas.yok.gov.tr/) — program ve taban puan verisi
- [ÖSYM](https://www.osym.gov.tr/) — kılavuz ve resmi kurallar
