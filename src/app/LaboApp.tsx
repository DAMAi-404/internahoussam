import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { useLaboState, useNow } from '@/app/backend'
import { SkeletonList } from '@/components/ui'
import { useWakeLock } from '@/features/labo/device'
import { Handover } from '@/features/labo/Handover'
import { LaboListScreen } from '@/features/labo/LaboListScreen'
import { LaboOrderScreen } from '@/features/labo/LaboOrderScreen'
import { handoverDue } from '@/lib/time'

/** Labo device: team theme on everything, handover enforced at each shift change (PRD LAB-1/2). */
export function LaboApp() {
  const labo = useLaboState()
  const now = useNow()
  const [manual, setManual] = useState(false)
  useWakeLock()
  if (labo.isPending) return <SkeletonList />
  const team = labo.data?.team ?? 'matin'
  const due = handoverDue(labo.data?.since ?? null, now) || !labo.data?.team
  return (
    <div className={`theme-${team} flex h-full min-h-0 flex-col bg-surface`}>
      <Routes>
        <Route index element={<LaboListScreen onHandover={() => setManual(true)} />} />
        <Route path="orders/:id" element={<LaboOrderScreen />} />
        <Route path="*" element={<Navigate to="/labo" replace />} />
      </Routes>
      {(due || manual) && <Handover mandatory={due} onDone={() => setManual(false)} onCancel={() => setManual(false)} />}
    </div>
  )
}
