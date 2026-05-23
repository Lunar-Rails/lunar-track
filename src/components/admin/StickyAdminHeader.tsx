'use client'

import { useEffect, useRef } from 'react'

export default function StickyAdminHeader({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () =>
      document.documentElement.style.setProperty('--admin-sticky-header-h', el.offsetHeight + 'px')
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className="sticky top-0 bg-lr-bg z-30 -mx-6 px-6 pt-6 pb-4 border-b border-lr-border"
    >
      {children}
    </div>
  )
}
