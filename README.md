# TWR SİM

LTAC Esenboğa kule simülatörü (ATC + pilot/instructor), çok oyunculu sunucu.

## Çalıştırma
```
npm install
npm start          # http://localhost:8080
```
Ortam değişkenleri: `PORT` (varsayılan 8080), `ADMIN_KEY` (verilirse yönetici olmak için linke `?key=...` eklenir; verilmezse ilk giren yönetici olur).

## Google ile giriş ve sahip onayı
`GOOGLE_CLIENT_ID` verilince giriş açılır:
- Herkes önce Google hesabıyla giriş yapar (ilk giriş = kayıt).
- `OWNER_EMAILS` listesindeki sahipler onaysız girer ve yönetici olur.
- Diğer herkes **her girişte** çevrimiçi bir sahibin onayını bekler. Sahip ekranında Onayla/Reddet kartı çıkar; çevrimiçi sahip yoksa giriş yapılamaz.
- Onay seçilen rol (ATC ya da Pilot) içindir. Bağlantı koparsa 1 dakika içinde yeniden bağlanmak yeni onay istemez; sayfayı kapatıp sonra gelen yeniden onay ister.
- Sahip birini "Çıkar" ile atarsa onayı da iptal olur.

| Değişken | Açıklama |
|---|---|
| `GOOGLE_CLIENT_ID` | Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application). Authorized JavaScript origins: sitenin adresi (ör. `https://xxx.onrender.com`) ve yerel deneme için `http://localhost` ile `http://localhost:8080`. |
| `OWNER_EMAILS` | Sahiplerin Gmail adresleri, virgülle ayrılmış. Depoya yazılmaz, sadece Render'da tutulur. |
| `SESSION_SECRET` | Uzun rastgele bir metin. Verilmezse sunucu her yeniden başladığında (Render uykudan uyanınca) herkes tekrar giriş yapar. |

`GOOGLE_CLIENT_ID` yoksa giriş kapalıdır ve eski davranış geçerlidir (ilk giren yönetici).

## Render
New → Web Service → bu depo → Build: `npm install`, Start: `npm start`.

## Kaynak
`kaynak/` klasörü: meydan verisi (`data/ltac.json`, `data/geo_tr.json`), sayfa şablonları (`public/*.template.html`, `wx.js`, `net.js`) ve derleme betiği (`tools/build_all.py`). Derlenen sayfalar `public/` klasörüne kopyalanır (tower.html → atc.html).

## 3D uçak modelleri
Kule görünümünde 11 tipin hepsi gerçek uçak modelleriyle çizilir: FlightGear açık kaynak uçakları (GPL) ve A350 için
amvlab (CC BY 4.0). Ayrıntılar ve boyalar `public/models3d/CREDITS.md`, yeniden üretmek için `kaynak/tools/fg/build_models.sh`.
