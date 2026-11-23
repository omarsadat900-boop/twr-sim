# TWR SİM

LTAC Esenboğa kule simülatörü (ATC + pilot/instructor), çok oyunculu sunucu.

## Çalıştırma
```
npm install
npm start          # http://localhost:8080
```
Ortam değişkenleri: `PORT` (varsayılan 8080), `ADMIN_KEY` (verilirse yönetici olmak için linke `?key=...` eklenir; verilmezse ilk giren yönetici olur).

## Render
New → Web Service → bu depo → Build: `npm install`, Start: `npm start`.

## Kaynak
`kaynak/` klasörü: meydan verisi (`data/ltac.json`, `data/geo_tr.json`), sayfa şablonları (`public/*.template.html`, `wx.js`, `net.js`) ve derleme betiği (`tools/build_all.py`). Derlenen sayfalar `public/` klasörüne kopyalanır (tower.html → atc.html).
