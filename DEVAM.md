# Flavorum — Kaldığımız Yer (Devam Notu)

Son güncelleme: 2026-08-18

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

## Temizlik / Bug Düzeltme Turu (2026-08-18)
- **Undo stale-closure bug'u düzeltildi** (`BatchScreen`, `RecipesScreen`): silme anında `prev` snapshot'ı alınıyor; art arda silmelerde eski array geri yüklenmiyor.
- **`estimateBatchCost` result-aware** oldu (`src/utils/prices.js`): kayıtlı `result` varsa `pgNeeded/vgNeeded/nicMl/flavorMl` doğrudan kullanılıyor — nikotin artık `baseNicMl` yerine `nicMl` (kaynak + baz) sayılıyor.
- **PricesScreen'e undo** eklendi (`useUndo` + `UndoToast`, diğer ekranlarla tutarlı).
- **`useLayoutMode()`** hook'u eklendi (`src/theme.js`): breakpoint + sidebar matematiği tek yerde; 6 ekran ve App.js bu hook'u kullanıyor (`useWideWeb`/`useSidebarWeb` artık ince wrapper).
- **`ScreenHero` bileşeni** (`src/components/ScreenHero.js`): 6 ekrandaki tekrarlı hero bloğu + ~8 stil key'i tek bileşene toplandı (~300 satır → 1 dosya). Not: iconCircle rengi tüm ekranlarda `primary+'33'` ile birleştirildi (FlavorLibrary/Nicotine eskiden `'1F'`).
- **Şişe renkleri tema-aware** oldu: PG→`colors.warning`, VG→`colors.success`, Nic→`colors.danger`, Aroma→yeni `colors.flavor` anahtarı (10 tema). `BatchScreen` + `NicotineScreen` (ResultBox accent'leri dahil).
- **Kontrast rozetleri**: ThemePickerModal'da WCAG AA altındaki temalara "⚠ Düşük kontrast" rozeti (`src/utils/contrast.js` + `FAIL_MAP`).
- **SurfaceRipple** (`BottleSVG.js`): per-frame React state yerine `Animated.createAnimatedComponent(G)` ile DOM attribute güncellemesi — web'de re-render yok.

## Batch Maliyet & Aroma Fiyat Linkleri (2026-08-18)
- **Batch kartına maliyet satırı**: `BatchScreen` artık fiyat tablosunu + envanter meta'sını yüklüyor; her kartın altında `estimateBatchCost` tahmini gösteriliyor. Maliyet bilinmiyorsa "Maliyet için fiyat ekle" → Prices linki.
- **Fiyatsız aroma chip'leri link oldu**: fiyat tablosunda veya envanter meta'sında fiyatı olmayan flavor chip'leri kesikli (dashed) warning rozetli tıklanabilir chip; `navigate('prices', { prefillFlavor: name })`.
- **PricesScreen `prefillFlavor` param desteği**: batch'ten gelen aroma adı add-form'una ön doldurulur (param tüketilir; `appliedPrefill` ref'i tekrar-doldurmayı engeller). `setParams` ile temizlenir.
- **Analytics'ten Batch Costs kaldırıldı**: per-batch cost kartı (pricedBatches/maxBatchCost + costRow/costBar* stilleri) stats'tan batch kartına taşındı; kullanılmayan `analytics.batchCosts`/`analytics.batchCostHint` i18n anahtarları temizlendi.
- Yeni i18n anahtarları (EN+TR): `batches.cost`, `batches.costMissing`, `batches.addPrice`.
- **Maliyet satırı 3 durumlu** hale getirildi: (1) tüm fiyatlar tam → `Maliyet 12.50`; (2) base fiyatları var ama bazı aromalar fiyatsız → `Aromalar için fiyat ekle` + `~12.50` (yaklaşık, eksik aroma katkısı yok) ve tıklayınca ilk fiyatsız aroma prefill'li Prices'a gider; (3) hiç fiyat yok → `Maliyet için fiyat ekle →`. Yeni i18n: `batches.costMissingFlavors`.
- **Cost bloğu yeniden tasarlandı**: `Maliyet` etiketi her zaman gösteriliyor; eksik fiyatlar satırın altında uyarı chip'leri (`alert-circle` + kesikli çerçeve) olarak listeleniyor — `Aromalar için fiyat ekle` (ilk fiyatsız aromayı prefill eder), `VG fiyatı ekle` / `PG fiyatı ekle` / `Nikotin fiyatı ekle` (yalnızca o batch'te kullanılan ve fiyatı olmayan base'ler, `estimateBatchCost` artık `baseMl` döndürüyor). Uyarı varken değer `~` ile yaklaşık işaretleniyor; hiç fiyat yoksa değer `—`. Yeni i18n: `batches.addBasePrice` (`{label} fiyatı ekle`); `batches.costMissing` kaldırıldı.

## Bilinen Kararlar / Kurallar
- ELR listesi: sadece `(` içeren isimler (marka parantezli, örn. `Strawberry (TPA)`).
- Envanter, reçeteler, parti tadım notları cihazda yerel `AsyncStorage`'da tutulur.
- Uygulama tamamen local — çalışma zamanında ELR'ye istek yok.


