import { Bell, ClipboardList, Flame, Inbox, LayoutGrid, ShoppingBag, Sun, Moon, TriangleAlert, Ban, Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BarChart,
  Button,
  Card,
  ChoiceCard,
  ConfirmSheet,
  EmptyState,
  FilterChips,
  Group,
  Header,
  IconButton,
  Keypad,
  LineRow,
  LineStateIcon,
  NoteIcon,
  NoteSheet,
  PinDots,
  ProductArt,
  ProductCard,
  Progress,
  Qty,
  RankList,
  ReasonChips,
  Section,
  Segmented,
  Sheet,
  SkeletonList,
  StatTile,
  StatusPill,
  Stepper,
  Steps,
  Switch,
  TabBar,
  useToast,
} from '@/components/ui'
import { DEMO_CATALOG } from '@/backend/seed'
import { setLang } from '@/lib/i18n'
import { ORDER_STATUSES } from '@/lib/status'

/** /dev/ui: every design-system component in its states, for visual review (fr/ar, both labo themes). */
export function Gallery() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const [chip, setChip] = useState('all')
  const [tab, setTab] = useState('order')
  const [qty, setQty] = useState(250)
  const [seg, setSeg] = useState<'5l' | '10l'>('10l')
  const [sw, setSw] = useState(true)
  const [sheet, setSheet] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [note, setNote] = useState(false)
  const [reason, setReason] = useState('')
  const [choice, setChoice] = useState<'partial' | 'not_done'>('partial')
  const [pin, setPin] = useState('12')
  const [night, setNight] = useState(false)
  const p = DEMO_CATALOG.products
  const lang = i18n.language as 'fr' | 'ar'
  const notes = [
    { id: '1', author: 'Patron', at: new Date().toISOString(), body: 'Chantilly bien ferme, pas trop sucrée.' },
    { id: '2', author: 'Patron', at: new Date().toISOString(), body: 'dqsssssssssdsssssssssssssssssssssssssssssssssssssssssssssss long word test' },
  ]

  return (
    <div className="min-h-full bg-surface pb-24 text-fg">
      <Header
        eyebrow="El Madania"
        title={t('catalog.title')}
        actions={
          <>
            <IconButton label="lang" tone="onDark" onClick={() => void setLang(lang === 'ar' ? 'fr' : 'ar')}>
              <span className="text-[15px] font-semibold">{lang === 'ar' ? 'FR' : 'ع'}</span>
            </IconButton>
            <IconButton label={t('notifications.title')} tone="onDark" badge={3}>
              <Bell size={20} />
            </IconButton>
          </>
        }
      >
        <FilterChips
          label="filters"
          value={chip}
          onChange={setChip}
          items={[{ id: 'all', label: t('catalog.all') }, { id: 'usual', label: t('catalog.usual') }, ...DEMO_CATALOG.categories.map((c) => ({ id: c.id, label: c.name[lang] }))]}
        />
      </Header>

      <main className="mx-auto flex max-w-lg flex-col gap-6 p-4">
        <Section title="Product cards">
          <div className="grid grid-cols-2 gap-3">
            <ProductCard name={p[0]!.name[lang]} nameLocalized={p[0]!.name} categoryId="glaces" photo={null} onOpen={() => setSheet(true)} />
            <ProductCard name={p[1]!.name[lang]} nameLocalized={p[1]!.name} categoryId="glaces" photo={null} badge="10 L × 3" onOpen={() => setSheet(true)} />
            <ProductCard name={p[24]!.name[lang]} nameLocalized={p[24]!.name} categoryId="ingredients" photo={null} badge="1,25 kg" onOpen={() => setSheet(true)} />
            <ProductCard name={p[5]!.name[lang]} nameLocalized={p[5]!.name} categoryId="glaces" photo={null} unavailable onOpen={() => undefined} />
          </div>
        </Section>

        <Section title="Status pills">
          <div className="flex flex-wrap gap-2">
            {ORDER_STATUSES.map((s) => (
              <StatusPill key={s} status={s} />
            ))}
          </div>
        </Section>

        <Section title="Order cards" count={3}>
          <Card highlight="ready">
            <div className="flex items-center gap-2">
              <StatusPill status="ready" />
              <span className="flex-1" />
              <span className="num text-meta text-fg-muted">08:15</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="num text-code font-semibold">EMD-1126-01</span>
              <span className="flex-1" />
              <NoteIcon notes={notes.slice(0, 1)} />
            </div>
            <Button size="md" className="w-full">
              {t('action.received')}
            </Button>
          </Card>
          <Card>
            <div className="flex items-center gap-2">
              <StatusPill status="in_preparation" />
              <span className="flex-1" />
              <span className="num text-meta text-fg-muted">09:02</span>
            </div>
            <span className="num text-code font-semibold">EMD-1126-02</span>
            <Progress done={3} total={5} />
          </Card>
          <Card highlight="new">
            <div className="flex items-center gap-2">
              <StatusPill status="submitted" />
              <span className="flex-1" />
              <IconButton label="edit" size={36}>
                <span className="text-[13px]">✎</span>
              </IconButton>
            </div>
            <span className="num text-code font-semibold">EMD-1126-03</span>
          </Card>
        </Section>

        <Section title="Steps + lines">
          <Group>
            <Steps current={2} times={[new Date().toISOString(), new Date().toISOString(), new Date().toISOString(), undefined]} />
          </Group>
          <Group>
            <LineRow lead={<LineStateIcon line={{ decision: 'accepted', prep: 'done' }} />} name="Cornet" qty={<Qty mode="count" qty={200} />} trailing={<NoteIcon notes={notes} unread />} />
            <LineRow lead={<LineStateIcon line={{ decision: 'reduced', prep: 'todo' }} />} name="Crème chantilly" qty={<><Qty mode="pack" qty={1} pack="10 L" /><Qty mode="pack" qty={2} pack="10 L" struck /></>} />
            <LineRow lead={<LineStateIcon line={{ decision: 'refused', prep: 'todo' }} />} name="Pistache" struck tint="refused" sub={<span className="text-[var(--st-refused-fg)]">Rupture</span>} qty={<Qty mode="weight" qty={1000} />} />
            <LineRow lead={<LineStateIcon line={{ decision: 'accepted', prep: 'partial' }} />} name="Pâte à pizza" sub={<span className="text-wood">20 · Pas le temps</span>} qty={<Qty mode="count" qty={30} />} />
            <LineRow lead={<LineStateIcon line={{ decision: 'accepted', prep: 'not_done' }} />} name="Bananes" tint="changed" qty={<Qty mode="weight" qty={2000} />} />
          </Group>
        </Section>

        <Section title="Controls">
          <Stepper value={<Qty mode="weight" qty={qty} />} onDec={() => setQty((q) => Math.max(250, q - 250))} onInc={() => setQty((q) => q + 250)} canDec={qty > 250} />
          <div className="flex items-center gap-3">
            <div className="w-36">
              <Stepper size="sm" tone="ink" value={<Qty mode="count" qty={150} />} onDec={() => undefined} onInc={() => undefined} />
            </div>
            <div className="w-36">
              <Stepper size="sm" value="10" onDec={() => undefined} onInc={() => undefined} decRemoves />
            </div>
          </div>
          <Segmented label="pack" value={seg} onChange={setSeg} options={[{ value: '5l', label: '5 L' }, { value: '10l', label: '10 L' }]} />
          <Segmented label="team" value={night ? 'nuit' : 'matin'} onChange={(v) => setNight(v === 'nuit')} options={[{ value: 'matin', label: <><Sun size={17} />{t('team.matin')}</> }, { value: 'nuit', label: <><Moon size={17} />{t('team.nuit')}</> }]} />
          <div className="flex items-center gap-3">
            <Switch checked={sw} onChange={setSw} label="active" />
            <ReasonChips label="reasons" options={t('review.reasons', { returnObjects: true }) as string[]} value={reason} onChange={setReason} />
          </div>
          <div className="flex gap-2.5" role="radiogroup">
            <ChoiceCard selected={choice === 'partial'} onClick={() => setChoice('partial')} icon={<TriangleAlert size={24} />} label={t('labo.partial')} />
            <ChoiceCard selected={choice === 'not_done'} onClick={() => setChoice('not_done')} icon={<Ban size={24} />} label={t('labo.notDone')} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setSheet(true)}>{t('action.sendToLabo')}</Button>
            <Button variant="tinted" size="md" onClick={() => setNote(true)}>{t('action.note')}</Button>
            <Button variant="dangerTinted" size="md" onClick={() => setConfirm(true)}>{t('action.delete')}</Button>
            <Button variant="plain" size="md" onClick={() => toast(t('cart.sent'))}>Toast</Button>
            <Button size="md" loading>…</Button>
          </div>
        </Section>

        <Section title="Stats">
          <div className="grid grid-cols-2 gap-3">
            <StatTile value="128" label={t('stats.orders')} />
            <StatTile value="4 %" label={t('stats.refused')} tone="warn" />
          </div>
          <BarChart ariaLabel="per day" highlight="d29" data={Array.from({ length: 30 }, (_, i) => ({ key: `d${i}`, value: [3, 5, 8, 4, 6, 9, 7][i % 7]!, label: String(i + 1) }))} />
          <RankList rows={[{ key: 'a', name: 'Cornet', value: <Qty mode="count" qty={4200} />, amount: 4200, sub: '12' }, { key: 'b', name: 'Pistache', value: <Qty mode="weight" qty={12500} />, amount: 2500, sub: '8' }]} />
        </Section>

        <Section title="Labo theme + keypad">
          <div className={night ? 'theme-nuit rounded-group bg-surface p-3' : 'theme-matin rounded-group bg-surface p-3'}>
            <Header compact eyebrow={t('labo.since', { time: '16:02' })} title={t(`team.${night ? 'nuit' : 'matin'}`)} actions={<IconButton label="team" tone="onDark">{night ? <Moon size={20} /> : <Sun size={20} />}</IconButton>} />
            <div className="mt-3 flex flex-col gap-2">
              <Card highlight="new">
                <span className="text-code font-semibold">Kouba</span>
                <Progress done={0} total={4} />
              </Card>
              <Group>
                <LineRow lead={<LineStateIcon line={{ decision: 'accepted', prep: 'done' }} size={40} />} name="Cornet" struck qty={<Qty mode="count" qty={150} />} trailing={<NoteIcon notes={notes} />} />
                <LineRow lead={<LineStateIcon line={{ decision: 'accepted', prep: 'todo' }} size={40} />} name="Kachtouta fraise" qty={<Qty mode="count" qty={40} />} />
              </Group>
            </div>
          </div>
          <PinDots length={4} filled={pin.length} />
          <Keypad onDigit={(d) => setPin((x) => (x + d).slice(0, 4))} onDelete={() => setPin((x) => x.slice(0, -1))} />
        </Section>

        <Section title="Empty + loading">
          <EmptyState icon={<ClipboardList size={28} />} title={t('orders.empty')} />
          <SkeletonList rows={2} />
          <ProductArt photo={null} name={p[10]!.name} categoryId="kachtouta" size={56} />
        </Section>
      </main>

      <div className="fixed inset-x-0 bottom-0">
        <TabBar
          value={tab}
          onChange={setTab}
          items={[
            { id: 'order', label: t('catalog.title'), icon: <ShoppingBag size={22} /> },
            { id: 'orders', label: t('orders.title'), icon: <ClipboardList size={22} />, badge: 1, badgeTone: 'ok' },
            { id: 'inbox', label: t('review.inbox'), icon: <Inbox size={22} />, badge: 4 },
            { id: 'live', label: t('followup.title'), icon: <Flame size={22} /> },
            { id: 'cat', label: 'Catalogue', icon: <LayoutGrid size={22} /> },
          ]}
        />
      </div>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title={p[1]!.name[lang]}
        footer={<Button className="w-full" onClick={() => setSheet(false)}>{t('action.add')} · <Qty mode="pack" qty={3} pack="10 L" /></Button>}
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <ProductArt photo={null} name={p[1]!.name} categoryId="glaces" size={72} />
            <p className="user-text text-[15px] text-muted">{p[1]!.description[lang]}</p>
          </div>
          <Segmented size="lg" label="pack" value={seg} onChange={setSeg} options={[{ value: '5l', label: '5 L' }, { value: '10l', label: '10 L' }]} />
          <Stepper value="3" onDec={() => undefined} onInc={() => undefined} />
          <div className="flex items-center gap-2 text-muted"><Search size={16} /> sheet content scrolls</div>
        </div>
      </Sheet>
      <ConfirmSheet open={confirm} onClose={() => setConfirm(false)} title={t('orders.deleteConfirm')} confirmLabel={t('action.delete')} onConfirm={() => setConfirm(false)} />
      <NoteSheet open={note} onClose={() => setNote(false)} title={t('note.forLabo')} limit="lineNote" onSave={() => setNote(false)} />
    </div>
  )
}
