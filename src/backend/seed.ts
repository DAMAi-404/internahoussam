/**
 * Reference data (also the source for supabase/seed.sql) + demo catalogue and history.
 * The 12 shops and 10 categories are real; products are examples the owner will replace.
 */
import type { Catalog, Category, Pack, Product, Shop } from '@/domain/types'

export const SHOPS: Shop[] = [
  { id: 'madania', code: 'EMD', name: { fr: 'El Madania', ar: 'المدنية' } },
  { id: '1er-mai', code: 'PRM', name: { fr: '1er Mai', ar: 'أول ماي' } },
  { id: 'sidi-abdelah', code: 'SAB', name: { fr: 'Sidi Abdelah', ar: 'سيدي عبد الله' } },
  { id: 'kouba', code: 'KOU', name: { fr: 'Kouba', ar: 'القبة' } },
  { id: 'rouiba', code: 'ROU', name: { fr: 'Rouiba', ar: 'الرويبة' } },
  { id: 'birtouta', code: 'BIR', name: { fr: 'Birtouta', ar: 'بئر توتة' } },
  { id: 'boulevard', code: 'BOU', name: { fr: 'Boulevard', ar: 'البولفار' } },
  { id: 'ain-naadja', code: 'AIN', name: { fr: 'Aïn Naadja', ar: 'عين النعجة' } },
  { id: 'bir-mourad-rais', code: 'BMR', name: { fr: 'Bir Mourad Raïs', ar: 'بئر مراد رايس' } },
  { id: 'bachedjerah', code: 'BAC', name: { fr: 'Bachedjerah', ar: 'باش جراح' } },
  { id: 'kitani', code: 'KIT', name: { fr: 'Kitani', ar: 'الكيتاني' } },
  { id: 'koucha', code: 'KCH', name: { fr: 'Koucha', ar: 'كوشة' } },
]

const CATEGORY_ROWS: [string, string, string][] = [
  ['glaces', 'Glaces', 'مثلجات'],
  ['crepes', 'Crêpes', 'كريب'],
  ['kachtouta', 'Kachtouta', 'كشطوطة'],
  ['patisserie', 'Pâtisserie', 'حلويات'],
  ['pizza', 'Pizza', 'بيتزا'],
  ['jus', 'Jus', 'عصير'],
  ['fruits', 'Fruits', 'فواكه'],
  ['supplements', 'Suppléments', 'إضافات'],
  ['ingredients', 'Ingrédients', 'مكونات'],
  ['emballage', 'Emballage', 'تغليف'],
]

export const CATEGORIES: Category[] = CATEGORY_ROWS.map(([id, fr, ar], i) => ({ id, name: { fr, ar }, sort: i + 1, active: true }))

const packs = (...labels: string[]): Pack[] =>
  labels.map((label) => ({ id: label.replace(/[^0-9a-z×]/gi, '').toLowerCase() || 'pack', label, active: true }))

type Row = [string, string, string, string, Product['mode'], number, Pack[]?, string?, string?, boolean?]
const ROWS: Row[] = [
  ['cornet', 'glaces', 'Cornet', 'كورني', 'count', 10, undefined, 'Cornet gaufré', 'كورني مقرمش'],
  ['chantilly', 'glaces', 'Crème chantilly', 'كريمة شانتي', 'pack', 1, packs('5 L', '10 L'), 'Bien froide, à garder au frais', 'باردة، تحفظ في الثلاجة'],
  ['bac-vanille', 'glaces', 'Bac vanille', 'علبة فانيلا', 'pack', 1, packs('5 L')],
  ['bac-chocolat', 'glaces', 'Bac chocolat', 'علبة شوكولا', 'pack', 1, packs('5 L')],
  ['bac-pistache', 'glaces', 'Bac pistache', 'علبة فستق', 'pack', 1, packs('5 L')],
  ['sorbet-citron', 'glaces', 'Sorbet citron', 'سوربيه ليمون', 'pack', 1, packs('5 L'), undefined, undefined, false],
  ['pate-crepe', 'crepes', 'Pâte à crêpe', 'عجينة كريب', 'volume', 1000],
  ['nutella', 'crepes', 'Nutella', 'نوتيلا', 'weight', 500],
  ['crepe-nature', 'crepes', 'Crêpe nature', 'كريب سادة', 'count', 10],
  ['kachtouta-fraise', 'kachtouta', 'Kachtouta fraise', 'كشطوطة فراولة', 'count', 5],
  ['kachtouta-mangue', 'kachtouta', 'Kachtouta mangue', 'كشطوطة مانجو', 'count', 5],
  ['tarte-fruits', 'patisserie', 'Tarte aux fruits', 'تارت فواكه', 'count', 1, undefined, 'Tarte entière, 8 parts', 'تارت كاملة، 8 قطع'],
  ['mille-feuille', 'patisserie', 'Mille-feuille', 'ميلفاي', 'count', 6],
  ['eclair', 'patisserie', 'Éclair', 'إكلير', 'count', 6],
  ['pate-pizza', 'pizza', 'Pâte à pizza', 'عجينة بيتزا', 'count', 10, undefined, 'Boule de 250 g', 'كرة 250 غ'],
  ['sauce-tomate', 'pizza', 'Sauce tomate', 'صلصة طماطم', 'pack', 1, packs('1 L', '5 L')],
  ['fromage', 'pizza', 'Fromage râpé', 'جبن مبشور', 'weight', 500],
  ['jus-orange', 'jus', 'Jus d’orange', 'عصير برتقال', 'pack', 1, packs('1 L', '5 L')],
  ['citronnade', 'jus', 'Citronnade', 'ليموناضة', 'pack', 1, packs('5 L')],
  ['fraises', 'fruits', 'Fraises', 'فراولة', 'weight', 500],
  ['bananes', 'fruits', 'Bananes', 'موز', 'weight', 1000],
  ['mangue', 'fruits', 'Mangue', 'مانجو', 'weight', 1000],
  ['sauce-chocolat', 'supplements', 'Sauce chocolat', 'صلصة شوكولا', 'pack', 1, packs('1 L')],
  ['amandes', 'supplements', 'Amandes effilées', 'لوز مقطع', 'weight', 250],
  ['pistache', 'ingredients', 'Pistache', 'فستق', 'weight', 250, undefined, 'Décortiquée, non salée', 'مقشر، غير مملح'],
  ['noisette', 'ingredients', 'Noisette', 'بندق', 'weight', 250],
  ['sucre', 'ingredients', 'Sucre', 'سكر', 'weight', 1000],
  ['lait', 'ingredients', 'Lait', 'حليب', 'volume', 1000],
  ['gobelets', 'emballage', 'Gobelets', 'أكواب', 'pack', 1, packs('50 pcs')],
  ['boites', 'emballage', 'Boîtes pâtisserie', 'علب حلويات', 'count', 10],
]

export const DEMO_CATALOG: Catalog = {
  categories: CATEGORIES,
  products: ROWS.map(([id, categoryId, fr, ar, mode, step, pk, dfr, dar, active], i) => ({
    id,
    categoryId,
    name: { fr, ar },
    description: { fr: dfr ?? '', ar: dar ?? '' },
    photo: null,
    mode,
    step: mode === 'pack' ? 1 : step,
    max: null,
    active: active !== false,
    sort: i + 1,
    packs: pk ?? [],
  })),
}

/** Demo credentials (shown on the demo login screen only). */
export const DEMO_SHOP_PIN = '123456'
export const DEMO_TEAM_PINS = { matin: '1111', nuit: '2222' } as const
