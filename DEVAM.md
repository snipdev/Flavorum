# Flavorum — Kaldığımız Yer (Devam Notu)

Son güncelleme: 2026-08-08

## Proje
- Konum: `C:\TimeToCode\Flavorum` (Expo / React Native, web + mobil)
- Web dev server: `http://localhost:8081` (hot reload, log: `C:\TimeToCode\Flavorum\web-server.log`)
- Git repo aktif — değişiklikler commit ile izleniyor. Çalışmaya başlamadan önce `git status` kontrol et.
- Konuşma dili: Türkçe.

## Tamamlananlar
- **`src/data/flavors.js`**: `ELR_FLAVORS` — **35.664** aroma ismi (alfabetik, benzersiz).
- **`src/utils/flavorUtils.js`**: `parseFlavorName(fullName)` — parantezli marka ayrıştırma (örn. `Strawberry (TPA)` -> `{ name: "Strawberry", brand: "TPA" }`).
- **`src/utils/shareUtils.js`**: `formatRecipeText(recipe)` — reçeteyi panoya kopyalanabilir şık metne dönüştürme.
- **`src/components/SliderInput.js`**: `−` ve `+` hassas adım butonları eklendi.
- **`src/components/FlavorAutocomplete.js`**: marka rozetleri (Pill Badges) eklendi.
- **`src/screens/FlavorLibraryScreen.js`**:
  - Marka Pill Badges eklendi.
  - "Stokta Var / Elimde Var" envanter takibi eklendi (`AsyncStorage` key: `flavorum_inventory`).
  - "Tümü" / "Stoktakiler" filtreleme sekmeleri eklendi.
- **`src/screens/RecipesScreen.js`**:
  - Reçete kartlarına tek tıkla **"Demle (Brew)"** butonu eklendi.
  - **"Stokla Yapılabilenler"** ve **"1 Eksik"** filtreleri eklendi.
  - Reçete kopyalama (**Duplicate**), hızlı ml/gram hesaplayan **Ölçekleme Penceresi (Scale)** ve **Paylaşım (Share Modal)** eklendi.
- **`src/screens/BatchScreen.js`**:
  - Canlı **% Demlenme İlerleme Çubuğu** (Steeping Countdown) & **"İçime Hazır! 🎉"** rozeti eklendi.
  - **5-Yıldızlı Puanlama** ve **Tadım Notları (Tasting Notes)** alanı eklendi.
- **`src/screens/NicotineScreen.js`**: `route.params.brewRecipe` desteği eklendi.
- **Tema Sistemi**: Ember, Nebula, Glacier ve yeni AMOLED dostu **Obsidian (OLED Siyah)** temaları aktif.
- Web bundle 200 OK doğrulandı.

## Bilinen Kararlar / Kurallar
- ELR listesi: sadece `(` içeren isimler (marka parantezli, örn. `Strawberry (TPA)`).
- Envanter, reçeteler, parti tadım notları cihazda yerel `AsyncStorage`'da tutulur.
- Uygulama tamamen local — çalışma zamanında ELR'ye istek yok.


