import { createContext, useContext, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const LANG_KEY = 'flavorum_lang'

export const translations = {
  en: {
    'app.tagline': 'Calculate your perfect mix',
    'tab.build': 'Build',
    'tab.batches': 'Batches',
    'tab.recipes': 'Recipes',
    'tab.flavors': 'Flavors',

    // NicotineScreen
    'build.ingredients': 'Ingredients',
    'build.flavor.mode': 'Flavor',
    'build.mix.mode': 'Mix',
    'build.loadBatch': 'Load Batch',
    'build.concentrateAmount': 'Concentrate Amount',
    'build.concentratePct': 'Concentrate % of Total',
    'build.makesAbout': 'Makes ≈',
    'build.totalLiquid': 'total liquid',
    'build.nicotine': 'Nicotine',
    'build.nicStrength': 'Nicotine Base Strength',
    'build.nicBaseType': 'Nicotine Base Type',
    'build.pg100': '100% PG',
    'build.vg100': '100% VG',
    'build.custom': 'Custom',
    'build.savedSources': 'Saved Sources',
    'build.addNicSource': 'Add Nicotine Source',
    'build.target': 'Target',
    'build.targetAmount': 'Target Liquid Amount',
    'build.targetPgVg': 'Target VG / PG',
    'build.targetStrength': 'Target Nicotine Strength',
    'build.save': 'Save',
    'build.calculate': 'Calculate',
    'build.source': 'Nicotine Source',
    'build.available': 'Available',
    'build.loadFlavorsFromRecipe': 'Load Flavors from Recipe',
    'build.loadBatch': 'Load Batch',
    'build.saveBatch': 'Save Batch',
    'build.batchName': 'Batch name',
    'build.noBatches': 'No saved batches yet',
    'build.noRecipesWithFlavors': 'No saved recipes with flavors yet',
    'build.readyToMix': 'Ready to mix',
    'build.impossibleMix': 'Impossible mix',
    'build.flavorToAdd': 'Flavor to Add',
    'build.concentrate': 'Concentrate',
    'build.nicToAdd': 'Nicotine to Add',
    'build.pgToAdd': 'PG to Add',
    'build.vgToAdd': 'VG to Add',
    'build.totalLiquidRes': 'Total Liquid',
    'build.recipe': 'Recipe',
    'build.warnMissingSource': 'Enter an amount for every nicotine source before calculating.',
    'build.warnConcentratePct': 'Concentrate % must be greater than 0 to calculate a mix.',
    'build.mixDetail': '{amount} ml concentrate · {pct}% of total',
    'build.flavorDetail': '{volume} ml total · {pct}% flavor',
    'build.flavorDetailNoPct': '{volume} ml total',
    'build.sourcesDetail': 'Source {i}: {strength} mg/ml ({base}) — {amount} ml',
    'build.resultDetail1': 'Flavor {flavorMl} ml · Nic {nicMl} ml · PG {pgNeeded} ml · VG {vgNeeded} ml',
    'build.resultDetail2': 'Total {total} ml · Final {nic} mg/ml',
    'build.baseTypePg': 'PG',
    'build.baseTypeVg': 'VG',
    'build.baseTypeCustom': 'CUSTOM',
    'build.flavorTitle': 'Flavor',
    'build.mixTitle': 'Mix',
    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'common.save': 'Save',
    'common.name': 'Name',
    'common.flavorCount': '{count} flavors',
    'common.untitledBatch': 'Untitled batch',

    // RecipesScreen
    'recipes.title': 'Recipes',
    'recipes.subtitle': 'Save your favorite mixes',
    'recipes.new': 'New Recipe',
    'recipes.edit': 'Edit Recipe',
    'recipes.recipeName': 'Recipe Name',
    'recipes.recipeNamePlaceholder': 'My Signature Mix',
    'recipes.flavors': 'Flavors',
    'recipes.addFlavor': 'Add Flavor',
    'recipes.save': 'Save Recipe',
    'recipes.update': 'Update Recipe',
    'recipes.cancelEdit': 'Cancel Edit',
    'recipes.saved': 'Saved Recipes',
    'recipes.searchPlaceholder': 'Search name or flavor...',
    'recipes.noMatch': 'No recipes match',
    'recipes.noFlavors': 'No flavors',
    'recipes.empty': 'No saved recipes yet',
    'recipes.errName': 'Enter a name for your recipe',
    'recipes.errFlavor': 'Add at least one flavor with a percentage',
    'recipes.savedOk': 'saved!',
    'recipes.updatedOk': 'updated!',
    'recipes.deleteTitle': 'Delete recipe?',
    'recipes.deleteMsg': 'This recipe will be permanently removed.',
    'recipes.flavorN': 'Flavor {i}',

    // BatchScreen
    'batches.title': 'Batches',
    'batches.subtitle': 'Your saved mixes',
    'batches.empty': 'No saved batches yet',
    'batches.deleteTitle': 'Delete batch?',
    'batches.deleteMsg': 'This batch will be permanently removed.',
    'batches.flavors': 'Flavors',
    'batches.nicSources': 'Nicotine Sources',
    'batches.result': 'Result',

    // FlavorLibraryScreen
    'flavors.title': 'Flavors',
    'flavors.subtitle': '{total} flavors from ELR + local usage',
    'flavors.search': 'Search flavor name...',
    'flavors.noMatch': 'No flavors match',
    'flavors.sort': 'Sort',
    'flavors.sortUsed': 'Used',
    'flavors.sortAz': 'A–Z',
    'flavors.recipe1': '1 recipe',
    'flavors.recipes': '{count} recipes',
    'flavors.batch1': '1 batch',
    'flavors.batches': '{count} batches',
    'flavors.unused': 'unused',
    'flavors.local': 'local',
    'flavors.recipesSection': 'Recipes',
    'flavors.batchesSection': 'Batches',
    'flavors.notInRecipe': 'Not used in any recipe',
    'flavors.notInBatch': 'Not used in any batch',
    'flavors.close': 'Close',
    'flavors.prepare': 'Prepare',
    'flavors.deleteTitle': 'Delete flavor?',
    'flavors.deleteMsg': 'This flavor will be removed from all recipes and batches that use it.',
    'flavors.add': 'Add Flavor',
    'flavors.addTitle': 'Add Flavor',
    'flavors.addPlaceholder': 'Flavor name...',
    'flavors.addErrorEmpty': 'Enter a flavor name',
    'flavors.addErrorExists': 'This flavor already exists',
    'flavors.addedOk': 'added!',

    // Components
    'dialog.delete': 'Delete',
    'dialog.cancel': 'Cancel',
    'confirm.yes': 'Confirm',
    'results.title': 'Results',
    'slider.label': 'Value',
    'pgvg.label': 'PG',
    'pgvg.vg': 'VG',
    'pgvg.pg': 'PG',
  },
  tr: {
    'app.tagline': 'Mükemmel karışımınızı hesaplayın',
    'tab.build': 'Karışım',
    'tab.batches': 'Batchler',
    'tab.recipes': 'Tarifler',
    'tab.flavors': 'Aromalar',

    // NicotineScreen
    'build.ingredients': 'Malzemeler',
    'build.flavor.mode': 'Aroma',
    'build.mix.mode': 'Karışım',
    'build.loadBatch': 'Batch Yükle',
    'build.concentrateAmount': 'Konsantre Miktarı',
    'build.concentratePct': 'Konsantre % (Toplamın)',
    'build.makesAbout': 'Yaklaşık',
    'build.totalLiquid': 'ml toplam likit yapar',
    'build.nicotine': 'Nikotin',
    'build.nicStrength': 'Nikotin Baz Gücü',
    'build.nicBaseType': 'Nikotin Baz Tipi',
    'build.pg100': '%100 PG',
    'build.vg100': '%100 VG',
    'build.custom': 'Özel',
    'build.savedSources': 'Kayıtlı Kaynaklar',
    'build.addNicSource': 'Nikotin Kaynağı Ekle',
    'build.target': 'Hedef',
    'build.targetAmount': 'Hedef Likit Miktarı',
    'build.targetPgVg': 'Hedef VG / PG',
    'build.targetStrength': 'Hedef Nikotin Gücü',
    'build.save': 'Kaydet',
    'build.calculate': 'Hesapla',
    'build.source': 'Nikotin Kaynağı',
    'build.available': 'Mevcut',
    'build.loadFlavorsFromRecipe': 'Tariften Aromaları Yükle',
    'build.loadBatch': 'Batch Yükle',
    'build.saveBatch': 'Batch Kaydet',
    'build.batchName': 'Batch adı',
    'build.noBatches': 'Henüz kayıtlı batch yok',
    'build.noRecipesWithFlavors': 'Henüz aromalı kayıtlı tarif yok',
    'build.readyToMix': 'Karışıma hazır',
    'build.impossibleMix': 'İmkansız karışım',
    'build.flavorToAdd': 'Eklenecek Aroma',
    'build.concentrate': 'Konsantre',
    'build.nicToAdd': 'Eklenecek Nikotin',
    'build.pgToAdd': 'Eklenecek PG',
    'build.vgToAdd': 'Eklenecek VG',
    'build.totalLiquidRes': 'Toplam Sıvı',
    'build.recipe': 'Tarif',
    'build.warnMissingSource': 'Hesaplamadan önce her nikotin kaynağı için bir miktar girin.',
    'build.warnConcentratePct': 'Karışım hesaplamak için konsantre % 0\'dan büyük olmalı.',
    'build.mixDetail': '{amount} ml konsantre · toplamın %{pct}\'si',
    'build.flavorDetail': '{volume} ml toplam · %{pct} aroma',
    'build.flavorDetailNoPct': '{volume} ml toplam',
    'build.sourcesDetail': 'Kaynak {i}: {strength} mg/ml ({base}) — {amount} ml',
    'build.resultDetail1': 'Aroma {flavorMl} ml · Nik {nicMl} ml · PG {pgNeeded} ml · VG {vgNeeded} ml',
    'build.resultDetail2': 'Toplam {total} ml · Final {nic} mg/ml',
    'build.baseTypePg': 'PG',
    'build.baseTypeVg': 'VG',
    'build.baseTypeCustom': 'ÖZEL',
    'build.flavorTitle': 'Aroma',
    'build.mixTitle': 'Karışım',
    'common.cancel': 'İptal',
    'common.close': 'Kapat',
    'common.save': 'Kaydet',
    'common.name': 'Ad',
    'common.flavorCount': '{count} aroma',
    'common.untitledBatch': 'Adsız batch',

    // RecipesScreen
    'recipes.title': 'Tarifler',
    'recipes.subtitle': 'Favori karışımlarınızı kaydedin',
    'recipes.new': 'Yeni Tarif',
    'recipes.edit': 'Tarifi Düzenle',
    'recipes.recipeName': 'Tarif Adı',
    'recipes.recipeNamePlaceholder': 'Bana Özgü Karışım',
    'recipes.flavors': 'Aromalar',
    'recipes.addFlavor': 'Aroma Ekle',
    'recipes.save': 'Tarifi Kaydet',
    'recipes.update': 'Tarifi Güncelle',
    'recipes.cancelEdit': 'Düzenlemeyi İptal Et',
    'recipes.saved': 'Kayıtlı Tarifler',
    'recipes.searchPlaceholder': 'İsim veya aroma ara...',
    'recipes.noMatch': 'Eşleşen tarif yok',
    'recipes.noFlavors': 'Aroma yok',
    'recipes.empty': 'Henüz kayıtlı tarif yok',
    'recipes.errName': 'Tarifiniz için bir ad girin',
    'recipes.errFlavor': 'Yüzdeli en az bir aroma ekleyin',
    'recipes.savedOk': 'kaydedildi!',
    'recipes.updatedOk': 'güncellendi!',
    'recipes.deleteTitle': 'Tarif silinsin mi?',
    'recipes.deleteMsg': 'Bu tarif kalıcı olarak silinecek.',
    'recipes.flavorN': 'Aroma {i}',

    // BatchScreen
    'batches.title': 'Batchler',
    'batches.subtitle': 'Kayıtlı karışımlarınız',
    'batches.empty': 'Henüz kayıtlı batch yok',
    'batches.deleteTitle': 'Batch silinsin mi?',
    'batches.deleteMsg': 'Bu batch kalıcı olarak silinecek.',
    'batches.flavors': 'Aromalar',
    'batches.nicSources': 'Nikotin Kaynakları',
    'batches.result': 'Sonuç',

    // FlavorLibraryScreen
    'flavors.title': 'Aromalar',
    'flavors.subtitle': 'ELR + yerel kullanımdan {total} aroma',
    'flavors.search': 'Aroma adı ara...',
    'flavors.noMatch': 'Eşleşen aroma yok',
    'flavors.sort': 'Sırala',
    'flavors.sortUsed': 'Kullanılan',
    'flavors.sortAz': 'A–Z',
    'flavors.recipe1': '1 tarif',
    'flavors.recipes': '{count} tarif',
    'flavors.batch1': '1 batch',
    'flavors.batches': '{count} batch',
    'flavors.unused': 'kullanılmadı',
    'flavors.local': 'yerel',
    'flavors.recipesSection': 'Tarifler',
    'flavors.batchesSection': 'Batchler',
    'flavors.notInRecipe': 'Hiçbir tarifte kullanılmadı',
    'flavors.notInBatch': 'Hiçbir batchte kullanılmadı',
    'flavors.close': 'Kapat',
    'flavors.prepare': 'Hazırla',
    'flavors.deleteTitle': 'Aroma silinsin mi?',
    'flavors.deleteMsg': 'Bu aroma, onu kullanan tüm tarif ve batchlerden kaldırılacak.',
    'flavors.add': 'Aroma Ekle',
    'flavors.addTitle': 'Aroma Ekle',
    'flavors.addPlaceholder': 'Aroma adı...',
    'flavors.addErrorEmpty': 'Aroma adı girin',
    'flavors.addErrorExists': 'Bu aroma zaten var',
    'flavors.addedOk': 'eklendi!',

    // Components
    'dialog.delete': 'Sil',
    'dialog.cancel': 'İptal',
    'confirm.yes': 'Onayla',
    'results.title': 'Sonuçlar',
    'slider.label': 'Değer',
    'pgvg.label': 'PG',
    'pgvg.vg': 'VG',
    'pgvg.pg': 'PG',
  },
}

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('en')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then(saved => {
      if (saved === 'en' || saved === 'tr') setLang(saved)
      setReady(true)
    }).catch(() => setReady(true))
  }, [])

  const switchLang = (next) => {
    setLang(next)
    AsyncStorage.setItem(LANG_KEY, next).catch(() => {})
  }

  return (
    <LanguageContext.Provider value={{ lang, ready, switchLang, t: (key, params) => translate(lang, key, params) }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useI18n must be used within LanguageProvider')
  return ctx
}

function translate(lang, key, params) {
  const table = translations[lang] || translations.en
  let str = table[key]
  if (str === undefined) {
    str = translations.en[key]
    if (str === undefined) return key
  }
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replaceAll(`{${k}}`, String(v))
    }
  }
  return str
}
