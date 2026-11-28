# 3D uçak modelleri

Kule görünümündeki gerçek tip modelleri FlightGear uçuş simülatörünün açık kaynak uçaklarından dönüştürüldü
(GNU GPL v2; kaynaklar https://github.com/FGMEMBERS). Kokpit, kabin içi ve ışık efektleri çıkarıldı; dış gövde,
iniş takımı ve boya olduğu gibi kullanıldı. Dönüştürme araçları: `kaynak/tools/fg/` (`build_models.sh`).

| Dosya | Tip | Kaynak (FGMEMBERS) | Boya |
|---|---|---|---|
| B738.glb | Boeing 737-800 | 737NG (David Culp, Syd Adams, Innis Cunningham) | Turkish Airlines TC-JGE |
| A320.glb | Airbus A320 | A320-family | Airbus house |
| B744.glb | Boeing 747-400 | 747-400 | Boeing house |
| B763.glb | Boeing 767-300 | 767-300 | Delta |
| A310.glb | Airbus A310-300 | A310 | Air Transat |
| DH8D.glb | Dash 8 Q400 | Q400 | Bombardier house |
| GLF5.glb | Gulfstream (GLF4/GLF5 için) | GulfstreamG550 | varsayılan |
| C172.glb | Cessna 172 | c172p | varsayılan |
| BE40.glb | BE40 yerine Citation Bravo (benzer iş jeti) | Citation-Bravo | varsayılan |

`A350.glb`: amvlab 3d Aircraft Models (https://github.com/amvlab/aircraft-models), CC BY 4.0, logosuz sürüm
(lisans metni `LICENSE-CC-BY-4.0.txt`). Dosya değiştirilmedi; tarayıcıda ölçeklenip döndürülüyor.
