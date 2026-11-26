import { ClipboardList, ShoppingBag } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router'
import { useOrders, useSession } from '@/app/backend'
import { TabBar } from '@/components/ui'
import { CartScreen } from '@/features/ordering/CartScreen'
import { CatalogScreen } from '@/features/ordering/CatalogScreen'
import { useCart } from '@/features/ordering/cart'
import { OrderDetailScreen } from '@/features/tracking/OrderDetailScreen'
import { OrdersScreen } from '@/features/tracking/OrdersScreen'

function ShopTabs() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const ready = (useOrders().data ?? []).filter((o) => o.status === 'ready').length
  const tab = pathname.startsWith('/shop/orders') ? 'orders' : 'order'
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
      <TabBar
        value={tab}
        onChange={(id) => navigate(id === 'orders' ? '/shop/orders' : '/shop')}
        items={[
          { id: 'order', label: t('catalog.title'), icon: <ShoppingBag size={22} /> },
          { id: 'orders', label: t('orders.title'), icon: <ClipboardList size={22} />, badge: ready, badgeTone: 'ok' },
        ]}
      />
    </div>
  )
}

export function ShopApp() {
  const session = useSession().data
  const setShop = useCart((s) => s.setShop)
  useEffect(() => {
    if (session?.shopId) setShop(session.shopId)
  }, [session?.shopId, setShop])
  return (
    <Routes>
      <Route element={<ShopTabs />}>
        <Route index element={<CatalogScreen />} />
        <Route path="orders" element={<OrdersScreen />} />
      </Route>
      <Route path="cart" element={<CartScreen />} />
      <Route path="orders/:id" element={<OrderDetailScreen />} />
      <Route path="*" element={<Navigate to="/shop" replace />} />
    </Routes>
  )
}
