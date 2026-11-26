import { useTranslation } from 'react-i18next'
import { BrowserRouter, Route, Routes } from 'react-router'
import { StatusPill } from '@/components/ui/StatusPill'
import { ORDER_STATUSES } from '@/lib/status'
import { setLang, type Lang } from '@/lib/i18n'

/**
 * Routes per role. Each role area becomes real in its phase (PRD §11):
 *   /shop/*  → features/ordering + tracking (+ stats)
 *   /owner/* → features/review + followup + catalog + stats
 *   /labo/*  → features/labo
 * RoleGuard (Phase 0, step 4) will redirect each signed-in device to its area.
 */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<ScaffoldHome />} />
      </Routes>
    </BrowserRouter>
  )
}

/** Temporary screen proving tokens, font, i18n and RTL work end to end. Removed when auth lands. */
function ScaffoldHome() {
  const { t, i18n } = useTranslation()
  const next: Lang = i18n.language === 'ar' ? 'fr' : 'ar'
  return (
    <main className="min-h-full">
      <header className="safe-top flex items-end justify-between bg-ink px-4 pb-4 pt-5 text-cream">
        <div>
          <p className="text-meta text-sage-soft">{t('app.name')}</p>
          <h1 className="text-title font-semibold">{t('scaffold.title')}</h1>
        </div>
        <button
          type="button"
          onClick={() => void setLang(next)}
          className="h-10 rounded-full bg-cream/10 px-4 text-body font-medium"
        >
          {next === 'ar' ? 'ع' : 'FR'}
        </button>
      </header>
      <section className="flex flex-col gap-4 p-4">
        <p className="text-body">{t('scaffold.body')}</p>
        <h2 className="text-meta font-semibold uppercase text-muted">{t('scaffold.statuses')}</h2>
        <div className="flex flex-wrap gap-2">
          {ORDER_STATUSES.map((s) => (
            <StatusPill key={s} status={s} />
          ))}
        </div>
      </section>
    </main>
  )
}
