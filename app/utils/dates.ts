export type DueStatus = 'none' | 'overdue' | 'due-soon' | 'upcoming'

const DUE_SOON_DAYS = 3

export function getDueStatus(
  dueDate: string | Date | null | undefined,
  now: Date = new Date(),
  isCompleted = false
): DueStatus {
  if (!dueDate || isCompleted) return 'none'
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate
  const diffDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays < 0) return 'overdue'
  if (diffDays <= DUE_SOON_DAYS) return 'due-soon'
  return 'upcoming'
}

// ─── Shared formatting helpers ───────────────────────────────────────────────

const RT_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000], ['month', 2592000], ['week', 604800],
  ['day', 86400], ['hour', 3600], ['minute', 60]
]

/** Relative time string, e.g. "3 วันก่อน" / "2 hours ago". */
export function timeAgo(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—'
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  for (const [unit, secs] of RT_UNITS) {
    if (diff >= secs) return rtf.format(-Math.floor(diff / secs), unit)
  }
  return rtf.format(0, 'second')
}

/** Short date: "6 ต.ค. 2026" / "Oct 6, 2026". */
export function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Date + time: "6 ต.ค. 2026, 09:47" */
export function formatDateTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(locale, {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

/** Extract 1–2 letter initials from a name. */
export function initials(name: string | null | undefined, count = 2): string {
  const parts = (name ?? '').trim().split(/\s+/)
  if (count === 1 || parts.length === 1) {
    return (parts[0]?.[0] ?? '?').toUpperCase()
  }
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

/** Safe percentage: calcPct(3, 10) → 30 */
export function calcPct(part: number, total: number): number {
  return total ? Math.round((part / total) * 100) : 0
}
