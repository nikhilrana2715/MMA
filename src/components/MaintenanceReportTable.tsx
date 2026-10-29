import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Filter, Search, X } from 'lucide-react'
import {
  maintenanceColumns,
  rowMaintenanceStatus,
  type MaintenanceCols,
  type MaintenanceRowStatus,
  type MaintenanceSheet,
} from '../lib/maintenanceReport'

const EMPTY_INK = 'color-mix(in srgb, var(--ink) 62%, var(--surface))'
const MAX_OPTIONS = 400
const BLANK = '(blank)'

export const STATUS_COL_IDX = -99

export const STATUS_LABEL_MAP: Record<MaintenanceRowStatus, string> = {
  pending: 'Pending',
  overdue: 'Overdue',
  completed: 'Completed',
  delayed: 'Completed (Delayed)',
  none: '—',
}

const toNum = (v: string): number | null => {
  if (!v) return null
  const n = Number(v.replace(/,/g, '').replace(/\s/g, ''))
  return Number.isFinite(n) ? n : null
}

const fmtNum = (n: number): string =>
  Number.isInteger(n) ? n.toLocaleString('en-IN') : n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const IDENTIFIER_HEAD = /(^|\s)(code|id|ids|ref|sr|serial)(\s|$)|\bno\.?(\s|$)/i

function summableColumns(columns: string[], cells: string[][]): number[] {
  const out: number[] = []
  for (let c = 1; c < columns.length; c++) {
    if (IDENTIFIER_HEAD.test(columns[c] ?? '')) continue
    const vals = cells.map((r) => r[c] ?? '').filter((v) => v !== '')
    if (vals.length >= 1 && vals.every((v) => toNum(v) !== null)) out.push(c)
  }
  return out
}

export type SheetFilters = Record<number, string[]>

const cellText = (v: string) => (v === '' ? BLANK : v)

export function applyFilters(
  cells: string[][],
  filters: SheetFilters,
  exceptCol?: number,
  cols?: MaintenanceCols,
  todayISO?: string
): string[][] {
  const active = Object.entries(filters).filter(([c, vals]) => Number(c) !== exceptCol && vals.length > 0)
  if (!active.length) return cells
  return cells.filter((row) =>
    active.every(([c, vals]) => {
      const colIdx = Number(c)
      if (colIdx === STATUS_COL_IDX) {
        if (!cols || !todayISO) return true
        const status = rowMaintenanceStatus(row, cols, todayISO)
        const label = STATUS_LABEL_MAP[status] ?? '—'
        return vals.includes(label)
      }
      return vals.includes(cellText(row[colIdx] ?? ''))
    })
  )
}

function ColumnFilterPopover({
  label,
  col,
  cells,
  filters,
  setFilters,
  anchor,
  onClose,
  cols,
  todayISO,
}: {
  label: string
  col: number
  cells: string[][]
  filters: SheetFilters
  setFilters: (f: SheetFilters) => void
  anchor: DOMRect
  onClose: () => void
  cols?: MaintenanceCols
  todayISO?: string
}) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const isStatus = col === STATUS_COL_IDX

  const available = useMemo(() => {
    const candidates = applyFilters(cells, filters, col, cols, todayISO)
    const counts = new Map<string, number>()
    for (const row of candidates) {
      const txt = isStatus
        ? cols && todayISO
          ? STATUS_LABEL_MAP[rowMaintenanceStatus(row, cols, todayISO)]
          : '—'
        : cellText(row[col] ?? '')
      counts.set(txt, (counts.get(txt) ?? 0) + 1)
    }
    const list = Array.from(counts.entries()).map(([val, cnt]) => ({ val, cnt }))
    list.sort((a, b) => {
      if (a.val === BLANK) return 1
      if (b.val === BLANK) return -1
      if (isStatus) {
        const order = ['Pending', 'Overdue', 'Completed', 'Completed (Delayed)', '—']
        const ia = order.indexOf(a.val)
        const ib = order.indexOf(b.val)
        if (ia !== -1 && ib !== -1) return ia - ib
        if (ia !== -1) return -1
        if (ib !== -1) return 1
      }
      const na = toNum(a.val)
      const nb = toNum(b.val)
      if (na !== null && nb !== null) return na - nb
      return a.val.localeCompare(b.val, undefined, { numeric: true, sensitivity: 'base' })
    })
    return list
  }, [cells, filters, col, cols, todayISO, isStatus])

  const initial = useMemo(() => {
    const set = filters[col]
    return set && set.length > 0 ? new Set(set) : new Set(available.map((x) => x.val))
  }, [filters, col, available])

  const [draft, setDraft] = useState<Set<string>>(initial)

  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('mousedown', onClickOutside)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('mousedown', onClickOutside)
    }
  }, [onClose])

  const matching = useMemo(() => {
    if (!q.trim()) return available
    const query = q.trim().toLowerCase()
    return available.filter((x) => x.val.toLowerCase().includes(query))
  }, [available, q])

  const allVisibleSelected = matching.length > 0 && matching.every((x) => draft.has(x.val))
  const toggleSelectAll = () => {
    const next = new Set(draft)
    if (allVisibleSelected) {
      for (const x of matching) next.delete(x.val)
    } else {
      for (const x of matching) next.add(x.val)
    }
    setDraft(next)
  }

  const apply = () => {
    const next = { ...filters }
    if (draft.size === available.length || draft.size === 0) {
      delete next[col]
    } else {
      next[col] = Array.from(draft)
    }
    setFilters(next)
    onClose()
  }

  const clear = () => {
    const next = { ...filters }
    delete next[col]
    setFilters(next)
    onClose()
  }

  const screenW = typeof window !== 'undefined' ? window.innerWidth : 1024
  const screenH = typeof window !== 'undefined' ? window.innerHeight : 768
  const width = Math.min(280, screenW - 32)
  let left = anchor.left
  if (left + width > screenW - 16) left = screenW - width - 16
  if (left < 16) left = 16

  let top = anchor.bottom + 6
  if (top + 340 > screenH - 16) top = Math.max(16, anchor.top - 340 - 6)

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 rounded-xl shadow-xl border border-slate-200 bg-white text-slate-800 text-[12.5px] flex flex-col"
      style={{ left, top, width, maxHeight: 360 }}
    >
      <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2">
        <Filter size={13} className="text-sky-600 shrink-0" />
        <div className="font-bold text-slate-800 truncate flex-1">
          {label || (isStatus ? 'Status' : `Column ${col + 1}`)}
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X size={15} />
        </button>
      </div>

      <div className="p-2 border-b border-slate-100">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-2 text-slate-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${label || 'values'}…`}
            className="w-full pl-7 pr-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[12px] focus:outline-none focus:border-sky-500"
          />
          {q && (
            <button onClick={() => setQ('')} className="text-slate-400 hover:text-slate-600 absolute right-2.5 top-2">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between text-[11.5px] font-semibold text-slate-600">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleSelectAll}
            className="rounded border-slate-300 text-sky-600 focus:ring-0"
          />
          <span>(Select All)</span>
        </label>
        <span className="text-[11px] text-slate-400">
          {draft.size} / {available.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
        {matching.slice(0, MAX_OPTIONS).map(({ val, cnt }) => {
          const checked = draft.has(val)
          return (
            <label
              key={val}
              className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer select-none text-[12px] hover:bg-slate-50 ${
                checked ? 'text-slate-900 font-medium' : 'text-slate-500'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  const next = new Set(draft)
                  if (checked) next.delete(val)
                  else next.add(val)
                  setDraft(next)
                }}
                className="rounded border-slate-300 text-sky-600 focus:ring-0"
              />
              <span className="truncate flex-1 flex items-center gap-1.5">
                {isStatus ? (
                  val === 'Completed' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                      ✓ Completed
                    </span>
                  ) : val === 'Completed (Delayed)' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                      ⏱ Completed (Delayed)
                    </span>
                  ) : val === 'Pending' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800">
                      ⏳ Pending
                    </span>
                  ) : val === 'Overdue' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                      ⚠ Overdue
                    </span>
                  ) : (
                    <span>{val}</span>
                  )
                ) : (
                  val
                )}
              </span>
              <span className="text-[10.5px] text-slate-400 font-normal">({cnt})</span>
            </label>
          )
        })}
      </div>

      <div className="p-2 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50 rounded-b-xl">
        <button
          onClick={clear}
          className="px-2.5 py-1 text-[11.5px] font-semibold text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-200/50"
        >
          Clear
        </button>
        <button
          onClick={apply}
          className="px-3 py-1 text-[11.5px] font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-sm"
        >
          Apply
        </button>
      </div>
    </div>
  )
}

const isWrapCol = (colIndex: number, colName: string, cols: ReturnType<typeof maintenanceColumns>): boolean => {
  if (colIndex === cols.issue || colIndex === cols.remark) return true
  const h = (colName || '').toLowerCase()
  return /issue|problem|remark|note|comment|description|action|reason|detail|work\s*done|root\s*cause/i.test(h)
}

/**
 * How a column sizes itself. The table is auto-layout, so:
 *  - `fit`  (dates, numbers): `w-[1%]` + nowrap → exactly as wide as its content, never more.
 *  - `text` (machine etc.):   `w-[1%]` + an inner box sized to its content but capped, so one
 *                             long name ("ASSEMBLY (NEW MACHINE)") wraps instead of widening
 *                             the whole column.
 *  - `wrap` (issue, remark):  no width → these soak up all the spare room on wide screens and
 *                             wrap on narrow ones, never shrinking below a readable minimum.
 */
type ColKind = 'fit' | 'text' | 'wrap'
const colKind = (
  colIndex: number,
  colName: string,
  cols: ReturnType<typeof maintenanceColumns>,
  numericCols: number[],
): ColKind => {
  if (numericCols.includes(colIndex)) return 'fit'
  if (isWrapCol(colIndex, colName, cols)) return 'wrap'
  if (colIndex === cols.expectedDate || colIndex === cols.actualDate || /date|time/i.test(colName)) return 'fit'
  return 'text'
}
const TD_BY_KIND: Record<ColKind, string> = {
  fit: 'w-[1%] whitespace-nowrap',
  text: 'w-[1%] whitespace-normal',
  wrap: 'whitespace-normal',
}
/** Inner box for wrapping cells — gives the column a real width the table has to respect. */
const BOX_BY_KIND: Record<ColKind, string> = {
  fit: '',
  text: 'w-max max-w-[8rem] sm:max-w-[9.5rem] [overflow-wrap:anywhere]',
  wrap: 'min-w-[200px] sm:min-w-[240px] [overflow-wrap:anywhere] leading-relaxed',
}

/** The status pill — shared by the table cell and the phone card. */
function StatusBadge({ status }: { status: ReturnType<typeof rowMaintenanceStatus> }) {
  return (
    <>
      {status === 'completed' && (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
          ✓ Completed
        </span>
      )}
      {status === 'delayed' && (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
          ⏱ Completed (Delayed)
        </span>
      )}
      {status === 'pending' && (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800">
          ⏳ Pending
        </span>
      )}
      {status === 'overdue' && (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
          ⚠ Overdue
        </span>
      )}
      {status === 'none' && <span className="text-slate-400">–</span>}
    </>
  )
}

/** Phones are too narrow for a 7-column table, so each row becomes a card there. */
const PHONE_QUERY = '(max-width: 639px)'
function useIsPhone() {
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(PHONE_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY)
    const on = () => setPhone(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return phone
}

export function MaintenanceReportTable({
  sheet,
  rows,
  baseRows,
  filters,
  setFilters,
  todayISO,
  scrollerRef,
}: {
  sheet: MaintenanceSheet
  rows: string[][]
  baseRows?: string[][]
  filters: SheetFilters
  setFilters: (f: SheetFilters) => void
  todayISO: string
  scrollerRef?: React.RefObject<HTMLDivElement | null> | React.MutableRefObject<HTMLDivElement | null>
}) {
  const ownRef = useRef<HTMLDivElement | null>(null)
  const scroller = scrollerRef ?? ownRef

  const [popover, setPopover] = useState<{ col: number; anchor: DOMRect } | null>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)
  const [hasOverflow, setHasOverflow] = useState(false)
  const isPhone = useIsPhone()
  // On a phone the cards are the default; the table stays one tap away for its column filters.
  const [phoneTable, setPhoneTable] = useState(false)
  const showCards = isPhone && !phoneTable

  const thWrap = 'px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-white align-bottom leading-[1.25]'

  const cols = useMemo(() => maintenanceColumns(sheet.columns), [sheet.columns])
  const hasStatusCol = cols.expectedDate >= 0 || cols.actualDate >= 0

  const checkScroll = useCallback(() => {
    const el = scroller.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    const maxScroll = scrollWidth - clientWidth
    setHasOverflow(maxScroll > 6)
    setCanLeft(scrollLeft > 6)
    setCanRight(maxScroll > 6 && scrollLeft < maxScroll - 6)
  }, [scroller])

  useEffect(() => {
    checkScroll()
    const el = scroller.current
    if (!el) return
    const ro = new ResizeObserver(checkScroll)
    ro.observe(el)
    window.addEventListener('resize', checkScroll)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', checkScroll)
    }
  }, [checkScroll, rows.length, showCards])

  const step = (dir: -1 | 1) => {
    scroller.current?.scrollBy({ left: dir * 300, behavior: 'smooth' })
    setTimeout(checkScroll, 320)
  }

  const summable = useMemo(() => summableColumns(sheet.columns, sheet.cells), [sheet])
  const sums = useMemo(() => {
    if (!summable.length) return new Map<number, number>()
    const map = new Map<number, number>()
    for (const c of summable) {
      let sum = 0
      for (const r of rows) {
        const n = toNum(r[c] ?? '')
        if (n !== null) sum += n
      }
      map.set(c, sum)
    }
    return map
  }, [summable, rows])

  return (
    <div className="bento overflow-hidden flex flex-col shadow-sm relative group">
      {sheet.preamble && (
        <div className="px-4 py-2 border-b border-[var(--hairline)] text-xs font-semibold text-slate-500 bg-slate-50/50">
          {sheet.preamble}
        </div>
      )}

      {isPhone && (
        <div className="flex justify-end px-3 py-2 border-b border-[var(--hairline)] bg-slate-50/60">
          <button
            type="button"
            onClick={() => setPhoneTable((v) => !v)}
            className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-[var(--hairline)] bg-white text-slate-700 active:scale-95"
          >
            {showCards ? 'Table view (filters)' : 'Card view'}
          </button>
        </div>
      )}

      {showCards && (
        <div className="max-h-[70vh] overflow-y-auto scroll-area divide-y divide-[var(--hairline)]">
          {rows.length === 0 && <div className="p-6 text-center text-sm text-slate-400">No rows</div>}
          {rows.map((row, r) => {
            const status = hasStatusCol ? rowMaintenanceStatus(row, cols, todayISO) : 'none'
            const at = (i: number) => (i >= 0 ? (row[i] ?? '').trim() : '')
            const shown = new Set([cols.machine, cols.date, cols.issue, cols.remark, cols.expectedDate, cols.actualDate])
            const extra = sheet.columns
              .map((name, i) => ({ name, i, val: at(i) }))
              .filter((x) => !shown.has(x.i) && x.val)
            return (
              <div key={r} className="px-3.5 py-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-[13.5px] text-slate-800 [overflow-wrap:anywhere]">{at(cols.machine) || '–'}</div>
                    <div className="text-[11px] text-slate-500">{at(cols.date)}</div>
                  </div>
                  {hasStatusCol && (
                    <div className="shrink-0">
                      <StatusBadge status={status} />
                    </div>
                  )}
                </div>
                {at(cols.issue) && (
                  <div className="text-[12.5px] leading-relaxed [overflow-wrap:anywhere]" style={{ color: 'var(--ink)' }}>
                    {at(cols.issue)}
                  </div>
                )}
                {(cols.expectedDate >= 0 || cols.actualDate >= 0) && (
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11.5px] text-slate-500">
                    {cols.expectedDate >= 0 && (
                      <span>
                        Expected: <b className="text-slate-700 font-semibold">{at(cols.expectedDate) || '–'}</b>
                      </span>
                    )}
                    {cols.actualDate >= 0 && (
                      <span>
                        Actual: <b className="text-slate-700 font-semibold">{at(cols.actualDate) || '–'}</b>
                      </span>
                    )}
                  </div>
                )}
                {at(cols.remark) && (
                  <div className="text-[12px] leading-relaxed text-slate-600 bg-slate-50 rounded-lg px-2.5 py-1.5 [overflow-wrap:anywhere]">
                    <span className="font-semibold text-slate-500">Remark: </span>
                    {at(cols.remark)}
                  </div>
                )}
                {extra.map((x) => (
                  <div key={x.i} className="text-[11.5px] text-slate-500 [overflow-wrap:anywhere]">
                    {x.name}: <span className="text-slate-700">{x.val}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {!showCards && (<>
      {/* Floating Left Button on Table Edge */}
      {hasOverflow && canLeft && (
        <button
          type="button"
          onClick={() => step(-1)}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-slate-900/85 hover:bg-slate-900 text-white shadow-lg flex items-center justify-center transition-transform hover:scale-110 active:scale-95 cursor-pointer backdrop-blur-xs select-none touch-manipulation"
          title="Scroll Table Left"
        >
          <ChevronLeft size={20} />
        </button>
      )}

      {/* Floating Right Button on Table Edge */}
      {hasOverflow && canRight && (
        <button
          type="button"
          onClick={() => step(1)}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-slate-900/85 hover:bg-slate-900 text-white shadow-lg flex items-center justify-center transition-transform hover:scale-110 active:scale-95 cursor-pointer backdrop-blur-xs select-none touch-manipulation"
          title="Scroll Table Right"
        >
          <ChevronRight size={20} />
        </button>
      )}

      <div
        ref={scroller as React.RefObject<HTMLDivElement>}
        className="overflow-x-auto max-h-[70vh] scroll-area"
        onScroll={checkScroll}
      >
        <table className="w-full text-left border-collapse">
          <thead>
            <tr style={{ background: 'linear-gradient(180deg,#1e293b,#0f172a)' }}>
              {sheet.columns.map((colName, c) => {
                const isNumCol = sheet.numericCols.includes(c)
                const hasFilter = filters[c] && filters[c].length > 0
                const kind = colKind(c, colName, cols, sheet.numericCols)
                return (
                  <th
                    key={c}
                    className={`${thWrap} ${kind === 'wrap' ? 'whitespace-nowrap' : 'w-[1%]'} ${isNumCol ? 'text-right' : 'text-left'}`}
                  >
                    <div className={`flex items-center gap-1.5 ${isNumCol ? 'justify-end' : 'justify-start'}`}>
                      <span>{colName || `Col ${c + 1}`}</span>
                      <button
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect()
                          setPopover(popover?.col === c ? null : { col: c, anchor: rect })
                        }}
                        title="Filter column"
                        className={`p-1 rounded transition ${
                          hasFilter ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                        }`}
                      >
                        <Filter size={11} />
                      </button>
                    </div>
                  </th>
                )
              })}
              {hasStatusCol && (
                <th className={`${thWrap} whitespace-nowrap w-[1%] text-center`}>
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Status</span>
                    <button
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        setPopover(popover?.col === STATUS_COL_IDX ? null : { col: STATUS_COL_IDX, anchor: rect })
                      }}
                      title="Filter by status"
                      className={`p-1 rounded transition ${
                        filters[STATUS_COL_IDX] && filters[STATUS_COL_IDX].length > 0
                          ? 'bg-sky-500 text-white'
                          : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                      }`}
                    >
                      <Filter size={11} />
                    </button>
                  </div>
                </th>
              )}
            </tr>

            {/* Total Strip */}
            {sums.size > 0 && (
              <tr className="bg-sky-900/10 border-b-2 border-sky-500/20 text-[11.5px] font-bold text-sky-900">
                {sheet.columns.map((_, c) => {
                  const sum = sums.get(c)
                  return (
                    <td key={c} className={`px-3 py-2 whitespace-nowrap ${sheet.numericCols.includes(c) ? 'text-right' : 'text-left'}`}>
                      {c === 0 ? 'TOTAL' : sum !== undefined ? fmtNum(sum) : ''}
                    </td>
                  )
                })}
                {hasStatusCol && <td />}
              </tr>
            )}
          </thead>

          <tbody className="divide-y divide-[var(--hairline)]">
            {rows.map((row, r) => {
              const status = hasStatusCol ? rowMaintenanceStatus(row, cols, todayISO) : 'none'
              return (
                <tr key={r} className="hover:bg-sky-50/40 transition-colors">
                  {sheet.columns.map((_, c) => {
                    const val = row[c] ?? ''
                    const isNumCol = sheet.numericCols.includes(c)
                    const isMachineCol = c === cols.machine
                    const kind = colKind(c, sheet.columns[c] ?? '', cols, sheet.numericCols)
                    return (
                      <td
                        key={c}
                        className={`px-3 py-2.5 text-[12.5px] align-middle ${TD_BY_KIND[kind]} ${
                          isNumCol ? 'text-right font-mono' : 'text-left'
                        } ${isMachineCol ? 'font-bold text-slate-800' : ''}`}
                        style={{ color: val ? 'var(--ink)' : EMPTY_INK }}
                      >
                        {kind === 'fit' ? val || '–' : <div className={BOX_BY_KIND[kind]}>{val || '–'}</div>}
                      </td>
                    )
                  })}
                  {hasStatusCol && (
                    <td className="px-3 py-2.5 text-center whitespace-nowrap w-[1%]">
                      <StatusBadge status={status} />
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      </>)}

      {popover && (
        <ColumnFilterPopover
          label={popover.col === STATUS_COL_IDX ? 'Status' : (sheet.columns[popover.col] ?? '')}
          col={popover.col}
          cells={baseRows ?? sheet.cells}
          filters={filters}
          setFilters={setFilters}
          anchor={popover.anchor}
          onClose={() => setPopover(null)}
          cols={cols}
          todayISO={todayISO}
        />
      )}
    </div>
  )
}
