import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { ChefHat, ChevronLeft, Crown, Store, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useBackend, useErrorMessage, useShops } from '@/app/backend'
import { Button, Keypad, PinDots } from '@/components/ui'
import type { Role, Shop } from '@/domain/types'
import { setLang } from '@/lib/i18n'
import { loc } from '@/lib/format'
import { homeFor } from '@/app/routes'

const SHOP_PIN_LENGTH = 6

/** One login screen for every device (ROLES §4): shop = pick shop + PIN; staff = email + password. */
export function Login() {
  const { t, i18n } = useTranslation()
  const backend = useBackend()
  const shops = useShops().data ?? []
  const [shop, setShop] = useState<Shop | null>(null)
  const [staff, setStaff] = useState(false)
  const demo = backend.kind === 'demo'

  return (
    <div className="flex min-h-full flex-col bg-paper text-ink">
      <div className="safe-top bg-ink text-cream">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-5 pb-7 pt-6">
          <BrandMark />
          <div className="min-w-0 flex-1">
            <div className="text-title font-semibold tracking-tight">Mahroussa Pro</div>
            <div className="text-meta text-sage-soft">{demo ? t('login.demoTitle') : t('login.title')}</div>
          </div>
          <button
            type="button"
            onClick={() => void setLang(i18n.language === 'ar' ? 'fr' : 'ar')}
            className="press h-10 rounded-full bg-cream/10 px-4 text-[15px] font-semibold"
          >
            {t('action.language')}
          </button>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-5 py-6">
        {shop ? (
          <ShopPin shop={shop} onBack={() => setShop(null)} />
        ) : staff ? (
          <StaffLogin onBack={() => setStaff(false)} />
        ) : (
          <>
            {demo && <DemoRoles />}
            <section className="flex flex-col gap-3">
              <h2 className="text-meta font-semibold uppercase tracking-wide text-muted">{t('login.chooseShop')}</h2>
              <div className="grid grid-cols-2 gap-2.5">
                {shops.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setShop(s)}
                    className="press flex h-14 items-center gap-2.5 rounded-2xl bg-cream px-3.5 text-start text-[15px] font-medium"
                  >
                    <Store size={18} className="shrink-0 text-sage-mid" />
                    <span className="truncate">{loc(s.name, i18n.language)}</span>
                  </button>
                ))}
              </div>
            </section>
            {!demo && (
              <Button variant="tinted" className="w-full" onClick={() => setStaff(true)}>
                {t('login.staff')}
              </Button>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function BrandMark() {
  return (
    <svg width="44" height="44" viewBox="0 0 512 512" aria-hidden className="shrink-0">
      <rect width="512" height="512" rx="120" fill="#275238" />
      <path d="M136 360V160l120 120 120-120v200" fill="none" stroke="#6BAA75" strokeWidth="44" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function useAfterSignIn() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  return async (role: Role) => {
    await qc.invalidateQueries()
    await qc.refetchQueries({ queryKey: ['session'] })
    navigate(homeFor(role), { replace: true })
  }
}

function DemoRoles() {
  const { t } = useTranslation()
  const backend = useBackend()
  const after = useAfterSignIn()
  const roles: { role: Role; icon: typeof Store; label: string; sub: string }[] = [
    { role: 'shop', icon: Store, label: t('role.shop'), sub: 'El Madania' },
    { role: 'owner', icon: Crown, label: t('role.owner'), sub: t('review.inbox') },
    { role: 'deputy', icon: UserRound, label: t('role.deputy'), sub: t('review.inbox') },
    { role: 'labo', icon: ChefHat, label: t('role.labo'), sub: t('labo.new') },
  ]
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-meta font-semibold uppercase tracking-wide text-muted">{t('login.demoRole')}</h2>
        <p className="text-meta text-muted">{t('login.demoHint')}</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {roles.map(({ role, icon: Icon, label, sub }) => (
          <button
            key={role}
            type="button"
            onClick={async () => {
              await backend.signInDemo?.(role, 'madania')
              await after(role)
            }}
            className="press flex flex-col items-start gap-3 rounded-[20px] bg-ink p-4 text-start text-cream"
          >
            <span className="grid size-10 place-items-center rounded-full bg-sage text-ink">
              <Icon size={20} />
            </span>
            <span>
              <span className="block text-[17px] font-semibold">{label}</span>
              <span className="block text-meta text-sage-soft">{sub}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function ShopPin({ shop, onBack }: { shop: Shop; onBack: () => void }) {
  const { t, i18n } = useTranslation()
  const backend = useBackend()
  const after = useAfterSignIn()
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)

  const digit = async (d: string) => {
    if (busy || pin.length >= SHOP_PIN_LENGTH) return
    const next = pin + d
    setPin(next)
    setError(false)
    if (next.length === SHOP_PIN_LENGTH) {
      setBusy(true)
      try {
        await backend.signInShop(shop.id, next)
        await after('shop')
      } catch {
        setError(true)
        setPin('')
      } finally {
        setBusy(false)
      }
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <button type="button" onClick={onBack} className="flex items-center gap-1 self-start text-[15px] font-medium text-sage-deep">
        <ChevronLeft size={20} className="flip-rtl" />
        {t('action.back')}
      </button>
      <h2 className="text-title-sm font-semibold">{t('login.pinFor', { shop: loc(shop.name, i18n.language) })}</h2>
      <PinDots length={SHOP_PIN_LENGTH} filled={pin.length} error={error} />
      <p className={clsx('h-5 text-center text-[15px] font-medium text-[var(--st-refused-fg)]', !error && 'invisible')}>{t('login.wrongPin')}</p>
      <Keypad onDigit={(d) => void digit(d)} onDelete={() => setPin((p) => p.slice(0, -1))} disabled={busy} />
    </div>
  )
}

function StaffLogin({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()
  const backend = useBackend()
  const after = useAfterSignIn()
  const message = useErrorMessage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = 'h-12 w-full rounded-xl border border-line bg-cream px-3.5 text-body focus:border-sage-deep focus:outline-none'
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError(null)
        try {
          const s = await backend.signInStaff(email.trim(), password)
          await after(s.role)
        } catch (err) {
          setError(message(err))
        } finally {
          setBusy(false)
        }
      }}
    >
      <button type="button" onClick={onBack} className="flex items-center gap-1 self-start text-[15px] font-medium text-sage-deep">
        <ChevronLeft size={20} className="flip-rtl" />
        {t('action.back')}
      </button>
      <label className="flex flex-col gap-1.5 text-meta font-medium text-muted">
        {t('login.email')}
        <input id="login-email" className={input} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" />
      </label>
      <label className="flex flex-col gap-1.5 text-meta font-medium text-muted">
        {t('login.password')}
        <input id="login-password" className={input} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required dir="ltr" />
      </label>
      {error && <p className="text-[15px] font-medium text-[var(--st-refused-fg)]">{error}</p>}
      <Button type="submit" loading={busy} className="w-full">
        {t('login.signIn')}
      </Button>
    </form>
  )
}
