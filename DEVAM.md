# Flavorum — Kaldığımız Yer (Devam Notu)

Son güncelleme: 2026-08-04

## Proje
- Konum: `C:\TimeToCode\Flavorum` (Expo / React Native, web + mobil)
- Web dev server: `http://localhost:8081` (hot reload, log: `C:\TimeToCode\Flavorum\web-server.log`)
- Git repo değil → değişiklikler için yedek yok, dikkatli çalış.
- Konuşma dili: Türkçe.

## Tamamlananlar
- **`src/data/flavors.js`**: `ELR_FLAVORS` — **35.664** aroma ismi (alfabetik, benzersiz). **TAM liste**: 5625 sayfanın tamamı tarandı (5 dk, 12 eşzamanlı). Filtreler: `(` içeren, latin karakterli, recipes>0, parantezle başlayıp bitmeyen, açılıp kapanmayan parantez içermeyen, Unknown/invalid içermeyen, parantez içinde tek harf içermeyen, VG/PG içermeyen, `&` ile başlamayan, `%` içermeyen, özel karakterle (`.` `_` `,` `(` `#`) başlamayan, `#` `;` `&` içermeyen, `.` içermeyen, **`-` içermeyen** (230 + 404 + 128 + 450 + 26 + 407 + 46 + 1714 + 677 + 1107 isim bu filtrelerle silindi).
- **`scripts/fetch-flavors.mjs`**: yeniden oluşturuldu — checkpoint'li (`scripts/flavors-checkpoint.json`), 12 eşzamanlı, 4 retry'lı, parse + filtrelerle. Tamamı çalıştırıldı. (Log: `elr-fetch.log`)
- **`src/components/FlavorAutocomplete.js`**: aroma adı yazınca ELR listesinden öneri getiren bileşen (akış içinde açılan kutu, max 8 öneri). New Recipe ve Build ekranlarında kullanılıyor.
- **`src/screens/FlavorLibraryScreen.js`** (Flavors tab):
  - FlatList (sanallaştırılmış, ilk 30 satır + kaydırdıkça yükler)
  - Arama kutusu
  - Sıralama başlığı (Sort butonu): **Used** (kullanılanlar üste, varsayılan) / **A–Z** toggle
  - "local" rozeti: kullanıcının tarif/batch'lerinde geçen ama ELR listesinde olmayan isimler
  - Recipe/batch rozetleri tıklanabilir → o aromayı kullanan tarif ve batch'leri gösteren modal
- **`src/screens/RecipesScreen.js`**: alfabetik liste, arama, edit modu, FlavorAutocomplete entegre.
- **`src/screens/NicotineScreen.js`** (Build): FlavorAutocomplete entegre.
- **`src/utils/seedRecipes.js`**: 106 seed tarif; `SEED_VERSION = 3`.
- **Mobil görünüm düzeltmeleri**:
  - `expo-navigation-bar` (~5.0.10) eklendi; Android sistem navigasyon barı `colors.bg`'ye, butonları light yapıldı. StatusBar'a koyu `backgroundColor` eklendi (App.js).
  - Tab bar: floating/yuvarlak stil kaldırıldı → standart opak koyu bar (telefonda görünmezdi).
  - LangToggle taşması: 4 ekranda da hero'ya `heroText` (flex:1) eklendi, subtitle `numberOfLines={2}` yapıldı.
  - FlavorLibrary performans: sıralama `localeCompare` yerine önceden hesaplanan küçük harf anahtarıyla; FlatList chunk'lı render (200 + kaydıkça +500).
- Web bundle her değişiklikten sonra 200 OK doğrulandı.

## Yarın Yapılacak (Öncelikli)
1. **Kullanıcı testi**: Flavors tab'de arama + autocomplete'i telefonla doğrula. 40.853 isimle performans iyiyse tamam; yavaşsa FlatList/getItemLayout optimizasyonu gerekebilir.
2. **İsteğe bağlı**: "local" etiketi artık tam liste sayesinde doğru çalışmalı — kullanıcının tarif/batch'lerinde ELR'de olmayan isimler "local" görünür.

## Bilinen Kararlar / Kurallar
- ELR listesi: sadece `(` içeren isimler (marka parantezli, örn. `Strawberry (TPA)`).
- "invalid" içerenler silindi; parantezle başlayıp bitenler silindi.
- ELR puanları/istatistikleri saklanmayacak; sadece isim + uygulama içi kullanım sayısı.
- Uygulama tamamen local — çalışma zamanında ELR'ye istek yok.

## Yarın Nasıl Hatırlatılır
- Bu konuşmada "What did we do so far?" yazman yeterli, ya da
- "C:\TimeToCode\Flavorum\DEVAM.md oku" de, dosyayı okuyup devam ederim.
