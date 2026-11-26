import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import fr from '@/locales/fr.json'
import ar from '@/locales/ar.json'

export type Lang = 'fr' | 'ar'
const STORAGE_KEY = 'mahroussa-lang'

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'fr' || saved === 'ar') return saved
  } catch {
    /* storage can be blocked: fall back to the default */
  }
  return 'ar' // PRD §10: Arabic default for shops and labo; the owner switches once.
}

/** Applies lang + direction to <html> so CSS logical properties flip correctly. */
export function applyDocumentLang(lang: Lang): void {
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
}

export async function setLang(lang: Lang): Promise<void> {
  await i18n.changeLanguage(lang)
  applyDocumentLang(lang)
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    /* ignore */
  }
}

const lng = initialLang()
void i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, ar: { translation: ar } },
  lng,
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
})
applyDocumentLang(lng)

export default i18n
