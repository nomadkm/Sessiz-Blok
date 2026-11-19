# Sessiz Blok

[English](README.md) | **Türkçe**

Popup, pop-under ve video reklamlarına odaklanan, hafif bir Chrome reklam engelleyici (Manifest V3).

## Özellikler

- **Popup ve pop-under engelleme:** Kullanıcı tıklaması olmadan açılan pencereleri ve görünmez tam sayfa tıklama tuzaklarını durdurur.
- **Tab-under koruması:** Yeni sekme açıldıktan hemen sonra eski sayfanın reklama yönlendirilmesini iptal eder.
- **Video reklamlar:** YouTube'da reklamı atlar ya da hızlandırır.
- **Filtre listeleri:** EasyList, EasyPrivacy, uBlock filters ve Peter Lowe listeleriyle ağ ve kozmetik filtreleme.
- **Anti-adblock önlemleri:** Basit tespit yoklamalarına zararsız taklitlerle cevap verir.
- **Site bazlı kapatma:** İstediğin sitede tek tıkla eklentiyi devre dışı bırakırsın.
- **Otomatik güncelleme:** Listeler haftada bir kendiliğinden yenilenir.

## Kurulum

1. Repoyu indir ya da klonla.
2. Chrome'da `chrome://extensions` sayfasını aç.
3. Sağ üstten **Geliştirici modu**nu aç.
4. **Paketlenmemiş öğe yükle** düğmesine bas ve proje klasörünü seç.

Kurulumdan yaklaşık bir dakika sonra eklenti listeleri kendisi indirir. Durumu popup'taki "Listeleri şimdi güncelle" bölümünden görebilirsin.

## Büyük liste seti (isteğe bağlı)

Chrome, otomatik güncellemede en fazla 25.000 kural yükleyebilir. Daha geniş kapsam için listeleri önceden derleyebilirsin:

```bash
python3 build_lists.py
```

Script listeleri `lists/` klasörüne indirir, `list_*.json` ve `cosmetic.json` dosyalarını üretir ve `manifest.json`'u günceller. Ardından eklentiyi `chrome://extensions` sayfasında yenile.

> **Not:** `build_lists.py` `manifest.json`'u değiştirir. Commit atmadan önce `git checkout manifest.json` ile geri al. Üretilen liste dosyaları `.gitignore` ile dışarıda tutulur, çünkü başkalarının lisanslı listelerinden türetilirler.

İnternet yoksa `.txt` liste dosyalarını `lists/` klasörüne elle koyup `python3 build_lists.py --only-local` çalıştırabilirsin.

## Proje yapısı

| Dosya | Görevi |
|---|---|
| `manifest.json` | Eklenti tanımı |
| `rules.json` | Çekirdek engelleme kuralları ve script taklitleri |
| `scriptlets.js` | Sayfa ortamında çalışır: popup, tab-under, YouTube, anti-adblock |
| `content.js` | Kozmetik gizleme ve YouTube reklam atlatma |
| `background.js` | Kozmetik veri sunumu, otomatik güncelleme |
| `lists.js` | Filtre listelerini Chrome kurallarına çevirir |
| `common.js` | Aç/kapa ve site istisnaları |
| `popup.*` | Arayüz |
| `stubs/` | Anti-adblock yoklamalarına verilen zararsız taklit scriptler |
| `build_lists.py` | Büyük liste setini önceden derleyen araç |

## Gizlilik

Eklenti kullanıcı verisi toplamaz, hiçbir yere göndermez. Tek ağ isteği, filtre listelerini indirmek için şu adreslere yapılır: `easylist.to`, `ublockorigin.github.io`, `pgl.yoyo.org`. Ayarların ve listelerin tamamı tarayıcıda yerel olarak saklanır.

## Bilinen sınırlar

- Manifest V3 kısıtları nedeniyle uBlock Origin kadar kapsamlı değildir. `$csp`, `$redirect`, `$removeparam` gibi seçenekler ve regex filtreler atlanır.
- YouTube'daki yöntemler Google tarafında sık değiştiği için zaman zaman bozulabilir.
- Bazı siteler reklam engelleyici tespit edebilir. Her tespit yöntemine karşı koruma yoktur.
- Tab-under koruması bir tahmine dayanır, nadiren meşru bir yönlendirmeyi engelleyebilir. Sorun yaşadığın sitede popup'tan eklentiyi kapat.

## Sorun bildirme

Bir sitede reklam geçiyor ya da sayfa bozuluyorsa, sitenin adresini ve F12 > Network sekmesindeki kırmızı (engellenmiş) satırları paylaşarak issue aç.

## Lisans

MIT. Ayrıntılar için `LICENSE` dosyasına bak.
