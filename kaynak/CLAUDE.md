# LTAC Esenboğa — çok oyunculu ATC / Pilot simülasyonu

Ömer'in (Nişantaşı Üniversitesi, hava trafik kontrol öğrencisi) sınavlarına çalışmak ve ders vermek için
yaptığı simülasyon. Hızlı bitmesi gerekiyor (1–2 gün), sınavlardan sonra büyütülecek.

## Kullanıcıyla çalışma kuralları
- Türkçe yaz. Adım adım, onun söylediği sırayla git; söylemediği özellikleri ekleme.
- **%100 insan**: yapay zekâ trafiği, otomatik pilot, bot YOK. Her uçak ve her telsiz konuşması gerçek kişi.
- Kalite önemli: havaalanı verisini uydurma, AIP/Jeppesen'den gelen veriyi kullan.

## Hedef ürün
- Tarayıcıdan açılan tek bir link; 2–20 kişi aynı anda bağlanır (önce yerel ağ, sonra internet).
- Giriş ekranı: "ATC olarak katıl" / "Pilot olarak katıl".
- **ATC ekranı (SIRADAKİ İŞ):** kule penceresinden görünüm. Ok tuşlarıyla sağa/sola/yukarı/aşağı bakış,
  360° dönüp arkayı görebilme. Pistler 5 NM ve 10 NM'ye kadar görünür. Taksi yolları görünür.
  Üstte PTT ve arama (call) tuşu. Kulenin yerini Ömer söyleyecek — sorulmadan yer seçme.
- **Pilot ekranı = instructor:** METAR/ATIS (QNH, rüzgâr, RVR...), aktif pist, uçak ekleme (callsign, tip,
  ADEP/ADES, park yeri...), uçakları yönetme: pushback, taksi (rota noktaları üzerinden), kalkış,
  paterne katılma, base/final dönüşü, iniş, meydan turu, holding, orbit vb.
- Ömer'in tasarım belgeleri: Main_Info.pdf (giriş ekranı, pilot ekranı, uçak ekleme formu, kule POV,
  AWOS ekranı, trafik ikonları) ve LTAC-6.pdf (Jeppesen). Ona sorup tekrar yüklemesini isteyebilirsin.
- Sesli PTT için not: tarayıcı mikrofonu sadece HTTPS'te (veya localhost'ta) açar. LAN'da self-signed
  sertifika ya da internete deploy (HTTPS) gerekir.

## Mevcut durum (tamamlandı: Adım 1 ve 2)
`data/ltac.json` — havaalanının tamamı, yerel metre koordinatları (x = doğu, y = kuzey,
orijin = RWY 03R eşiği 40°06'50.61"N 032°58'59.44"E).
- `runways`: 03R/21L 3752×60 m, 03L/21R 3391×45 m, stopway 60 m. Eşikler AIP AD 2 LTAC ADC (AIRAC 09/22).
- `pavement` / `holes`: pist ve taksi yüzey poligonları; `pave_lines`: kalın çizgi olarak çizilen
  yüzeyler (taksi yolu G), `w` = genişlik (m).
- `taxi.nodes` / `taxi.edges`: taksi ağı. `kind`: `runway` | `taxiway` | `taxilane` (apron içi) |
  `leadin` (park yeri giriş çizgisi, adı `STAND <id>`). Her edge'de `pts` (orta hat), `len` (m).
  Park düğümlerinde `stand`, eşik düğümlerinde `thr` alanı var. Ağ tek parça; her park yerinden
  her piste rota var (networkx/Dijkstra ile test edildi).
- `stands` (111): `id, apron, xy, hdg` (park hâlinde burun yönü, °T), `lead_len`.
  Apron 1: 1A,1–6 · Apron 2: 7–14, 345 (Ömer'in haritasından ekstra) · Apron 3: 15–22 ·
  Apron 4: 101–120, 201–207 · YKK: A1, A2 · Apron 5: P1–P6, 238, 239, 240, 242, 243, 286, 288, 289
  (Ömer'in fotoğrafından, Jeppesen A1–G3 yerine; konum yaklaşık ±10–15 m, `note` alanında yazıyor; 'APRON 5'
  taksi hattı G'ye kuzeydoğu ucundan bağlı) · Apron 6: 600–632 · Apron 7: 701–704.
- `holding_points` (53): Jeppesen isimleri. `type`: `runway` (korunan pist `rwy`, eksenden `dist_cl`)
  veya `intermediate`. AHP3/A3HP = 03R CAT II/III HP.
- Taksi yolları: A, A1–A3, AA, AB, AC, B, B1, B2, C, C1, D, D1, D2, E, E1, E2, F, G, G1–G4.
  **H ve J kaldırıldı** (Ömer: kullanım dışı).

`public/chart.html` — 2D harita görüntüleyici (canvas, sürükle/zoom, iPad dokunma). Veri içine gömülü;
`chart.template.html` + `data/ltac.json` → `__DATA__` yer tutucusu değiştirilerek üretilir.
Çizim fonksiyonları (pist işaretleri, HP çubukları, park okları) kule ekranında yeniden kullanılabilir.

`tools/` — veriyi PDF'lerden üreten Python betikleri (Jeppesen 10-9 georeferans, 0,1 m hata;
detay sayfaları ECC ile hizalandı). Sadece referans için; yollar eski ortama göre yazılmış.

## Açık sorular (Ömer'e sorulacak)
1. F taksi yolu da AIP üzerinde "out of order" olarak yeşil işaretli — silinsin mi?
2. Apron 5: Ömer'in fotoğrafındaki 14 park yeri eklendi. 241 ve 287 fotoğrafta yok — var mı? Daha net görüntü gelirse konumlar düzeltilecek.
3. Stand 345'in yeri (Apron 2 güney ucu) doğru mu?
4. Kule konumu ve göz yüksekliği (Jeppesen'de "Control Tower" Apron 1/2 arasında, yaklaşık x≈1310, y≈990).

## Güncelleme 2026-11-23 (binalar, H/J/F)
- H, J ve F taksi yolları (AIP s.7'de "Not exist / out of order") hem rota grafiğinden hem yüzeyden silindi: `removed_taxiways`, `removed_pavement`, ilgili `holes`.
- Apron 4 ortasındaki yeşil eşkenar dörtgen (eski hole) kaldırıldı.
- `buildings`: 54 bina, Main_Info.pdf AIP sayfa 7 çiziminden izlendi (hizalama hatası ~2 m). Yükseklikler (`h`) TAHMİNİDİR; düzeltilebilir.
- AIP'deki TWR işareti Apron 2 güney ucunu gösteriyor; kule kullanıcının seçtiği (1310, 990) noktasında bırakıldı.

## Güncelleme 2026-11-23 (pilot ekranı)
- `public/pilot.template.html` → pilot.html (instructor ekranı). `public/wx.js` iki sayfada ortak hava modeli + AWOS görünümü. Derleme: `python3 tools/build_all.py <proje>` (data/geo_tr.json gerekir).
- Hava durumunu sadece pilot değiştirir; ATC (AWOS artık sağda) salt okunur. Şimdilik aynı tarayıcıdaki sekmeler arasında BroadcastChannel ile senkron; ağ üzerinden senkron + ses sunucu adımında.
- Uçak tipleri listesi geçici; kullanıcı gerçek listeyi gönderecek. SID/STAR için AIP verisi bekleniyor (uydurulmadı).

## Güncelleme 2026-11-28 (3D)
- Taksi yolu çizim genişliği 2.0× (TWYW, uçak ölçeğiyle aynı); HP çizgileri HPW=11.5*TWYW.
- Gerçek tip modelleri: `public/models3d/*.glb` (amvlab, CC BY 4.0, CREDITS.md). Kule `GLB_FILES` ile yükler,
  `MODELS.useGLB` boyu tip L'ye ölçekler, gövde altını iniş takımının üstüne oturtur; el yapımı gövde gizlenir,
  iniş takımı ve ışık noktaları kalır. Dosya yüklenemezse eski model kullanılır. GLTFLoader (r128) derlemede `/*__GLTF__*/` yerine gömülür.
