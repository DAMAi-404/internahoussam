import { BarChart3, Flame, Inbox, LayoutGrid } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router'
import { useOrders } from '@/app/backend'
import { ErrorState, SkeletonList, TabBar } from '@/components/ui'
import { CatalogAdminScreen } from '@/features/catalog/CatalogAdminScreen'
import { FollowupScreen } from '@/features/followup/FollowupScreen'
import { OrderFollowScreen } from '@/features/followup/OrderFollowScreen'
import { InboxScreen } from '@/features/review/InboxScreen'
import { ReviewScreen } from '@/features/review/ReviewScreen'
import { StatsScreen } from '@/features/stats/StatsScreen'

function OwnerTabs() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const orders = useOrders().data ?? []
  const inbox = orders.filter((o) => o.status === 'submitted').length
  const ready = orders.filter((o) => o.status === 'ready').length
  const tab = pathname.split('/')[2] || 'inbox'
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
      <TabBar
        value={tab}
        onChange={(id) => navigate(id === 'inbox' ? '/owner' : `/owner/${id}`)}
        items={[
          { id: 'inbox', label: t('review.inbox'), icon: <Inbox size={22} />, badge: inbox },
          { id: 'suivi', label: t('followup.title'), icon: <Flame size={22} />, badge: ready, badgeTone: 'ok' },
          { id: 'stats', label: t('stats.title'), icon: <BarChart3 size={22} /> },
          { id: 'catalog', label: t('catalogAdmin.title'), icon: <LayoutGrid size={22} /> },
        ]}
      />
    </div>
  )
}

/** /owner/orders/:id → review while waiting, follow-up once sent. */
function OrderRoute() {
  const { id } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const orders = useOrders()
  const o = orders.data?.find((x) => x.id === id)
  if (orders.isPending) return <SkeletonList />
  if (!o) return <ErrorState text={t('errors.not_found')} onRetry={() => navigate('/owner')} />
  return o.status === 'submitted' || o.status === 'in_review' ? <ReviewScreen order={o} /> : <OrderFollowScreen order={o} />
}

export function OwnerApp() {
  return (
    <Routes>
      <Route element={<OwnerTabs />}>
        <Route index element={<InboxScreen />} />
        <Route path="suivi" element={<FollowupScreen />} />
        <Route path="stats" element={<StatsScreen />} />
        <Route path="catalog" element={<CatalogAdminScreen />} />
      </Route>
      <Route path="orders/:id" element={<OrderRoute />} />
      <Route path="*" element={<Navigate to="/owner" replace />} />
    </Routes>
  )
}
