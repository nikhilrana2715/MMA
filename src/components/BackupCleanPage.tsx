import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  BarChart3,
  Boxes,
  CalendarCheck,
  CalendarRange,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  Filter,
  HardDrive,
  History as HistoryIcon,
  Info,
  Layers,
  Loader2,
  RefreshCw,
  Route,
  Search,
  ShieldCheck,
  Sigma,
  StickyNote,
  Target,
  Trash2,
  Undo2,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  backupCleanApi,
  downloadExport,
  fmtDay,
  humanBytes,
  monthsAgo,
  todayKey,
  type ArchiveRow,
  type AuditRow,
  type Item,
  type Job,
  type Preview,
  type Selection,
  type Summary,
} from '../lib/backupClean'

/**
 * Backup Clean — admin page for removing uploaded data.
 *
 * A selection is PERIOD × DATA TYPES: tick September and only "Cp-Cpk" and exactly those
 * records go — nothing else from that month. The server's one shared selector takes the same
 * { months | from/to, types } shape for preview, export and delete, so what is shown here is
 * what gets removed.
 *
 * Deliberately NOT blocking anywhere: the backup is recommended, not required, and the 30-day
 * recency rule only warns. Typing DELETE in the confirmation is the single gate. Every action
 * is audited server-side.
 */

const chip = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap'
const HINT = 'var(--ink-hint)'
const DANGER = 'color-mix(in srgb, #dc2626 46%, var(--ink))'
const DANGER_BG = 'color-mix(in srgb, #dc2626 8%, var(--surface))'
const DANGER_LINE = 'color-mix(in srgb, #dc2626 30%, var(--surface))'
const ACCENT_BG = 'color-mix(in srgb, var(--accent) 9%, var(--surface))'
const ACCENT_LINE = 'color-mix(in srgb, var(--accent) 45%, var(--surface))'
const OK = 'color-mix(in srgb, #059669 70%, var(--ink))'
const OK_BG = 'color-mix(in srgb, #059669 10%, var(--surface))'
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1'
const field = 'rounded-xl border border-[var(--hairline)] bg-transparent px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200'

const TYPE_ICON: Record<string, LucideIcon> = {
  meetings: CalendarCheck,
  notes: StickyNote,
  cpk: Target,
  cumulative: Sigma,
  uploads: FileSpreadsheet,
  assembly: Boxes,
  monthlyplan: CalendarRange,
  routecard: Route,
  planvsach: BarChart3,
}

const plural = (n: number, word: string) => `${n.toLocaleString('en-IN')} ${word}${n === 1 ? '' : 's'}`

type Labels = Record<string, string>
type Mode = 'month' | 'range'

/** Does month 'YYYY-MM' overlap the inclusive day range [from, to]? */
const monthInRange = (month: string, from: string, to: string) => (!from || `${month}-31` >= from) && (!to || `${month}-01` <= to)

function Chips({ breakdown, labels, only }: { breakdown: Record<string, number>; labels: Labels; only?: string[] }) {
  const entries = Object.entries(breakdown)
    .filter(([k, v]) => v > 0 && (!only || only.includes(k)))
    .sort((a, b) => b[1] - a[1])
  if (!entries.length) return null
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([k, v]) => (
        <span key={k} className={chip} style={{ background: ACCENT_BG, color: 'var(--accent)' }}>
          {labels[k] || k} <span className="tabular-nums opacity-80">{v}</span>
        </span>
      ))}
    </div>
  )
}

function Card({ step, title, sub, right, children }: { step?: number; title: string; sub?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="bento overflow-hidden">
      <header className="flex items-center gap-3 px-4 md:px-5 py-3.5 border-b border-[var(--hairline)] flex-wrap">
        {step !== undefined && (
          <span className="w-7 h-7 rounded-full grid place-items-center text-[12.5px] font-extrabold shrink-0" style={{ background: ACCENT_BG, color: 'var(--accent)' }}>
            {step}
          </span>
        )}
        <div className="flex-1 min-w-[160px]">
          <h2 className="font-bold text-slate-800 text-[14.5px] leading-tight">{title}</h2>
          {sub && (
            <div className="text-[12px] mt-0.5" style={{ color: HINT }}>
              {sub}
            </div>
          )}
        </div>
        {right}
      </header>
      <div className="p-4 md:p-5">{children}</div>
    </section>
  )
}

function Stat({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bento px-4 py-3 flex items-center gap-3 min-w-0">
      <div className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: ACCENT_BG, color: 'var(--accent)' }}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: HINT }}>
          {label}
        </div>
        <div className="text-[18px] font-extrabold text-slate-800 tabular-nums leading-tight truncate">{value}</div>
        {sub && (
          <div className="text-[11px] truncate" style={{ color: HINT }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  )
}

/** The typed-DELETE gate. */
function ConfirmDialog({
  preview,
  soft,
  backupTaken,
  recentAcknowledged,
  labels,
  typeNames,
  periodText,
  archiveDays,
  onCancel,
  onConfirm,
}: {
  preview: Preview
  soft: boolean
  backupTaken: boolean
  recentAcknowledged: boolean
  labels: Labels
  typeNames: string
  periodText: string
  archiveDays: number
  onCancel: () => void
  onConfirm: () => void
}) {
  const [typed, setTyped] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => inputRef.current?.focus(), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])
  const armed = typed === 'DELETE' // case-sensitive, as specified

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center p-3"
      style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(2px)' }}
      onClick={onCancel}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="bc-confirm-title"
      aria-describedby="bc-confirm-desc"
    >
      <form
        className="bento w-full max-w-lg flex flex-col overflow-hidden"
        style={{ maxHeight: 'min(90vh, 90dvh)', animation: 'rise 0.18s ease both' }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (armed) onConfirm()
        }}
      >
        <div className="shrink-0 flex items-center gap-3 px-5 pt-4 pb-3 border-b border-[var(--hairline)]">
          <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: DANGER_BG, color: DANGER }}>
            <AlertTriangle size={18} />
          </div>
          <div id="bc-confirm-title" className="font-bold text-slate-800">
            {soft ? 'Move this data to the Archive?' : 'Permanently delete this data?'}
          </div>
        </div>
        <div id="bc-confirm-desc" className="flex-1 min-h-0 overflow-y-auto scroll-area p-5 flex flex-col gap-3 text-sm">
          <dl className="rounded-xl px-4 py-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]" style={{ background: DANGER_BG }}>
            <dt style={{ color: HINT }}>Period</dt>
            <dd className="font-semibold text-slate-800">{periodText}</dd>
            <dt style={{ color: HINT }}>Data types</dt>
            <dd className="font-semibold text-slate-800">{typeNames}</dd>
            <dt style={{ color: HINT }}>Records</dt>
            <dd className="font-semibold text-slate-800">
              {plural(preview.count, 'record')} · {preview.humanBytes} · {plural(preview.users.length, 'user')}
            </dd>
          </dl>
          <Chips breakdown={preview.breakdown} labels={labels} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: DANGER }}>
                Will be removed
              </div>
              <ul className="mt-1 ml-4 list-disc text-[12.5px] text-slate-600 space-y-0.5">
                <li>Only the records counted above, with their photos/files</li>
                <li>{soft ? `Kept in the Archive for ${archiveDays} days` : 'Gone immediately — not restorable'}</li>
              </ul>
            </div>
            <div>
              <div className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: OK }}>
                Will be kept
              </div>
              <ul className="mt-1 ml-4 list-disc text-[12.5px] text-slate-600 space-y-0.5">
                <li>Every other data type and period</li>
                <li>User accounts and login history</li>
                <li>This tool's audit log</li>
              </ul>
            </div>
          </div>
          {preview.recent_count > 0 && !recentAcknowledged && (
            <div className="text-[12px] font-semibold flex items-start gap-1.5" style={{ color: DANGER }}>
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {plural(preview.recent_count, 'record')} uploaded in the last 30 days.
            </div>
          )}
          {!backupTaken && (
            <div className="text-[12px] font-semibold flex items-start gap-1.5" style={{ color: DANGER }}>
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> No backup downloaded for this selection.
            </div>
          )}
          <label className="block">
            <span className="text-[13px] font-semibold text-slate-700">
              Type <span className="font-mono px-1 rounded bg-slate-100">DELETE</span> to confirm
            </span>
            <input
              ref={inputRef}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={typed.length > 0 && !armed}
              className="mt-1 w-full rounded-xl border border-[var(--hairline)] bg-transparent px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-200 font-mono"
            />
          </label>
        </div>
        <div className="shrink-0 flex gap-2 justify-end px-5 py-3 border-t border-[var(--hairline)]">
          <button type="button" className={`icon-btn ${FOCUS}`} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            className={`icon-btn !text-white disabled:opacity-45 disabled:cursor-not-allowed ${FOCUS}`}
            style={{ background: '#dc2626', borderColor: '#dc2626' }}
            disabled={!armed}
          >
            {soft ? <Archive size={14} /> : <Trash2 size={14} />} {soft ? 'Move to Archive' : 'Permanently delete'}
          </button>
        </div>
      </form>
    </div>
  )
}

const TABS = [
  { id: 'clean', label: 'Clean data', icon: Trash2 },
  { id: 'archive', label: 'Archive', icon: Archive },
  { id: 'history', label: 'History', icon: HistoryIcon },
] as const
type Tab = (typeof TABS)[number]['id']

export function BackupCleanPage({ onBack, isAdmin }: { onBack: () => void; isAdmin: boolean }) {
  const [tab, setTab] = useState<Tab>('clean')
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState('')

  // ---- selection: period × types ----
  const [mode, setMode] = useState<Mode>('month')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [activePreset, setActivePreset] = useState<number | null>(null)
  const [types, setTypes] = useState<Set<string>>(new Set())
  const [rangeScope, setRangeScope] = useState<Preview | null>(null)

  // ---- impact + actions ----
  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [overrideRecent, setOverrideRecent] = useState(false)
  const [soft, setSoft] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [backupTaken, setBackupTaken] = useState(false)
  const [backupName, setBackupName] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [job, setJob] = useState<Job | null>(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  // ---- review list ----
  const [q, setQ] = useState('')
  const [qLive, setQLive] = useState('')
  const [reviewType, setReviewType] = useState('all')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<Item[]>([])
  const [itemsTotal, setItemsTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [itemsBusy, setItemsBusy] = useState(false)

  // ---- other tabs ----
  const [history, setHistory] = useState<AuditRow[] | null>(null)
  const [archive, setArchive] = useState<ArchiveRow[] | null>(null)
  const [restoring, setRestoring] = useState('')

  const labels: Labels = useMemo(() => Object.fromEntries((summary?.types ?? []).map((t) => [t.id, t.label])), [summary])
  const allTypeIds = useMemo(() => (summary?.types ?? []).map((t) => t.id), [summary])
  const archiveDays = summary?.config.archiveKeepDays ?? 30

  const summaryLoaded = useRef(false)
  const load = useCallback(() => {
    setLoading(true)
    backupCleanApi
      .summary()
      .then((s) => {
        setSummary(s)
        setLoadErr('')
        setSoft((prev) => (summaryLoaded.current ? prev : s.config.softDeleteDefault))
        // First load: every type is chosen; the admin narrows it down.
        if (!summaryLoaded.current) setTypes(new Set(s.types.map((t) => t.id)))
        summaryLoaded.current = true
      })
      .catch((e: Error) => setLoadErr(e.message))
      .finally(() => setLoading(false))
    backupCleanApi.archive().then(setArchive).catch(() => setArchive([]))
  }, [])
  useEffect(() => {
    if (isAdmin) load()
  }, [load, isAdmin])
  useEffect(() => {
    if (tab === 'history') backupCleanApi.history().then(setHistory).catch(() => setHistory([]))
    if (tab === 'archive') backupCleanApi.archive().then(setArchive).catch(() => setArchive([]))
  }, [tab])

  // ---- derived selection ----
  const today = todayKey()
  const rangeMsg =
    mode !== 'range' ? '' : from && to && to < from ? '"To" must be on or after "From".' : from > today || to > today ? 'Dates cannot be in the future.' : ''
  const periodChosen = mode === 'month' ? picked.size > 0 : !!(from || to) && !rangeMsg
  const allTypesChosen = allTypeIds.length > 0 && types.size === allTypeIds.length
  const typeList = allTypeIds.filter((t) => types.has(t))
  const hasSelection = periodChosen && types.size > 0
  const monthList = [...picked].sort()
  // Never send an empty types list — the server would read that as "all types".
  const selection: Selection = {
    ...(mode === 'month' ? { months: monthList } : { from: from || null, to: to || null }),
    ...(allTypesChosen ? {} : { types: typeList }),
  }
  const selKey = JSON.stringify(selection)

  const periodText =
    mode === 'month'
      ? summary?.months
          .filter((m) => picked.has(m.month))
          .map((m) => m.label)
          .join(', ') || '—'
      : from && to && from === to
        ? fmtDay(from)
        : `${from ? fmtDay(from) : 'the beginning'} – ${to ? fmtDay(to) : 'today'}`
  const typeNames = allTypesChosen ? 'All data types' : typeList.map((t) => labels[t] || t).join(', ')

  // Range mode: per-type counts inside the range come from a preview across all types.
  useEffect(() => {
    if (mode !== 'range' || !periodChosen) {
      setRangeScope(null)
      return
    }
    let alive = true
    backupCleanApi
      .preview({ from: from || null, to: to || null })
      .then((p) => alive && setRangeScope(p))
      .catch(() => alive && setRangeScope(null))
    return () => {
      alive = false
    }
  }, [mode, from, to, periodChosen])

  /** How many records of each type sit in the chosen period (or everywhere, before one is chosen). */
  const scopeCounts: Record<string, number> = useMemo(() => {
    if (!summary) return {}
    if (mode === 'range' && periodChosen) return rangeScope?.breakdown ?? {}
    const months = mode === 'month' && picked.size ? summary.months.filter((m) => picked.has(m.month)) : summary.months
    const out: Record<string, number> = {}
    for (const m of months) for (const [k, v] of Object.entries(m.breakdown)) out[k] = (out[k] ?? 0) + v
    return out
  }, [summary, mode, picked, periodChosen, rangeScope])

  // Live impact preview.
  useEffect(() => {
    if (!hasSelection) {
      setPreview(null)
      return
    }
    let alive = true
    setPreviewBusy(true)
    setErr('')
    backupCleanApi
      .preview(selection)
      .then((p) => alive && setPreview(p))
      .catch((e: Error) => alive && setErr(e.message))
      .finally(() => alive && setPreviewBusy(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey, hasSelection])

  // A new selection invalidates the backup and acknowledgement taken for the previous one.
  useEffect(() => {
    setBackupTaken(false)
    setBackupName('')
    setOverrideRecent(false)
    setPage(1)
  }, [selKey])

  // Review list: debounce the search box, then page through exactly what is selected.
  useEffect(() => {
    const id = setTimeout(() => setQLive(q), 250)
    return () => clearTimeout(id)
  }, [q])
  useEffect(() => setPage(1), [qLive, reviewType])
  useEffect(() => {
    if (reviewType !== 'all' && !types.has(reviewType)) setReviewType('all')
  }, [types, reviewType])
  useEffect(() => {
    if (!hasSelection) {
      setItems([])
      setItemsTotal(0)
      setPages(1)
      return
    }
    let alive = true
    setItemsBusy(true)
    const sel = reviewType === 'all' ? selection : { ...selection, types: [reviewType] }
    backupCleanApi
      .items({ ...sel, q: qLive, page, perPage: 25 })
      .then((r) => {
        if (!alive) return
        setItems(r.items)
        setItemsTotal(r.total)
        setPages(r.pages)
      })
      .catch(() => alive && setItems([]))
      .finally(() => alive && setItemsBusy(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey, hasSelection, qLive, reviewType, page])

  // ---- actions ----
  const toggleMonth = (month: string) =>
    setPicked((p) => {
      const n = new Set(p)
      if (n.has(month)) n.delete(month)
      else n.add(month)
      return n
    })
  const toggleType = (t: string) =>
    setTypes((p) => {
      const n = new Set(p)
      if (n.has(t)) n.delete(t)
      else n.add(t)
      return n
    })
  const preset = (months: number) => {
    setFrom('')
    setTo(monthsAgo(months))
    setActivePreset(months)
  }

  const doExport = async () => {
    setExporting(true)
    setErr('')
    try {
      const name = await downloadExport(selection)
      setBackupTaken(true)
      setBackupName(name)
      setMsg(`Backup downloaded: ${name}`)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setExporting(false)
    }
  }

  const doDelete = async () => {
    if (!preview) return
    setConfirming(false)
    setErr('')
    setMsg('')
    try {
      const started = await backupCleanApi.del({ ...selection, soft, expected_count: preview.count, backup_taken: backupTaken })
      setJob({ id: started.job_id, state: 'running', done: 0, total: started.total, bytes: 0, errors: [], soft })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      const poll = async () => {
        try {
          const j = await backupCleanApi.job(started.job_id)
          setJob(j)
          if (j.state === 'running') {
            setTimeout(poll, 500)
            return
          }
          load()
          setPicked(new Set())
          setFrom('')
          setTo('')
          setActivePreset(null)
          setMsg(
            j.state === 'done'
              ? `${plural(j.done, 'record')} ${j.soft ? 'moved to the Archive' : 'deleted'} · ${humanBytes(j.bytes)} freed${backupName ? ` · backup ${backupName}` : ''}`
              : `Finished with ${plural(j.errors.length, 'problem')}.`,
          )
        } catch (e) {
          setErr((e as Error).message)
          setJob(null)
        }
      }
      poll()
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  const doRestore = async (file: string) => {
    setRestoring(file)
    setErr('')
    setMsg('')
    try {
      const r = await backupCleanApi.restore(file)
      load()
      setMsg(`${plural(r.restored, 'record')} restored.`)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setRestoring('')
    }
  }

  const running = job?.state === 'running'
  // Recency is advisory — the only gate is typing DELETE in the confirmation.
  const canDelete = !!preview && preview.count > 0 && !previewBusy && !running
  const nextHint = !periodChosen
    ? mode === 'month'
      ? 'Tick one or more months in step 1.'
      : rangeMsg || 'Pick a preset or enter dates in step 1.'
    : types.size === 0
      ? 'Choose at least one data type in step 2.'
      : ''

  // Data-map columns: only types that exist somewhere, so the table stays readable.
  const mapTypes = summary ? allTypeIds.filter((t) => summary.months.some((m) => (m.breakdown[t] ?? 0) > 0)) : []
  const allPicked = !!summary && summary.months.length > 0 && picked.size === summary.months.length
  const selectAllRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = picked.size > 0 && !allPicked
  }, [picked.size, allPicked])

  if (!isAdmin) {
    return (
      <div className="bento bento-pad flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className={`icon-btn shrink-0 ${FOCUS}`}>
          <ArrowLeft size={15} /> Back
        </button>
        <div className="text-sm font-semibold" style={{ color: DANGER }}>
          Only an admin can use Backup Clean.
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      {/* ---- page header ---- */}
      <div className="bento bento-pad flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className={`icon-btn shrink-0 ${FOCUS}`}>
          <ArrowLeft size={15} /> Back
        </button>
        <div className="w-10 h-10 rounded-xl grid place-items-center text-white shrink-0" style={{ background: 'linear-gradient(135deg,#f59e0b,#dc2626)' }}>
          <HardDrive size={19} />
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="font-bold text-slate-800">Backup Clean</div>
          <div className="text-xs" style={{ color: HINT }}>
            Choose a period and the exact data types to remove — everything else stays.
            {summary && <> Times in {summary.config.timezone}.</>}
          </div>
        </div>
        <button onClick={load} className={`icon-btn shrink-0 ${FOCUS}`} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* ---- totals ---- */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat icon={<Layers size={18} />} label="Records" value={summary.grand.records.toLocaleString('en-IN')} sub="uploaded data, all units" />
          <Stat icon={<HardDrive size={18} />} label="Storage used" value={humanBytes(summary.grand.bytes)} sub="records, photos and files" />
          <Stat icon={<CalendarRange size={18} />} label="Months" value={String(summary.grand.months)} sub={summary.months.length ? `${summary.months[summary.months.length - 1].label} – ${summary.months[0].label}` : '—'} />
          <Stat icon={<Archive size={18} />} label="In archive" value={archive ? String(archive.length) : '…'} sub={`restorable for ${archiveDays} days`} />
        </div>
      )}

      {/* ---- tabs ---- */}
      <div role="tablist" aria-label="Backup Clean sections" className="bento p-1 flex gap-1 overflow-x-auto scroll-area">
        {TABS.map((t, i) => {
          const active = tab === t.id
          const Icon = t.icon
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[i] = el
              }}
              role="tab"
              id={`bc-tab-${t.id}`}
              aria-selected={active}
              aria-controls={`bc-panel-${t.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => {
                const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
                if (!step) return
                e.preventDefault()
                const next = (i + step + TABS.length) % TABS.length
                setTab(TABS[next].id)
                tabRefs.current[next]?.focus()
              }}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-[13px] font-bold whitespace-nowrap transition ${FOCUS}`}
              style={active ? { background: 'var(--accent)', color: 'var(--surface)' } : { color: 'var(--ink-2)' }}
            >
              <Icon size={15} />
              {t.label}
              {t.id === 'archive' && archive && archive.length > 0 && (
                <span className={chip} style={active ? { background: 'var(--surface)', color: 'var(--accent)' } : { background: ACCENT_BG, color: 'var(--accent)' }}>
                  {archive.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ---- status ---- */}
      <div aria-live="polite" className="flex flex-col gap-2 empty:hidden">
        {running && job && (
          <div className="bento px-4 py-3" style={{ background: ACCENT_BG }}>
            <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-700">
              <Loader2 size={15} className="animate-spin" style={{ color: 'var(--accent)' }} />
              {job.soft ? 'Archiving' : 'Deleting'} {job.done.toLocaleString('en-IN')} of {plural(job.total, 'record')}… keep this page open.
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden" role="progressbar" aria-label="Progress" aria-valuenow={job.done} aria-valuemin={0} aria-valuemax={job.total}>
              <div className="h-full rounded-full transition-[width]" style={{ width: `${Math.round((job.done / Math.max(1, job.total)) * 100)}%`, background: 'var(--accent)' }} />
            </div>
          </div>
        )}
        {msg && !running && (
          <div className="bento px-4 py-3 flex items-center gap-2 text-[13px] font-semibold" style={{ color: OK, background: OK_BG }}>
            <CheckCircle2 size={16} className="shrink-0" />
            <span className="flex-1 min-w-0">{msg}</span>
            <button className={`p-1 rounded ${FOCUS}`} onClick={() => setMsg('')} aria-label="Dismiss message">
              <X size={14} />
            </button>
          </div>
        )}
        {(err || loadErr) && (
          <div role="alert" className="bento px-4 py-3 flex items-center gap-2 text-[13px] font-semibold" style={{ color: DANGER, background: DANGER_BG }}>
            <AlertTriangle size={16} className="shrink-0" />
            <span className="flex-1 min-w-0">{err || loadErr}</span>
            {err && (
              <button className={`p-1 rounded ${FOCUS}`} onClick={() => setErr('')} aria-label="Dismiss error">
                <X size={14} />
              </button>
            )}
          </div>
        )}
        {job && !running && job.errors.length > 0 && (
          <details className="bento px-4 py-3 text-[12.5px]">
            <summary className="cursor-pointer font-bold" style={{ color: DANGER }}>
              {plural(job.errors.length, 'item')} failed — show details
            </summary>
            <div className="mt-1">
              {job.errors.slice(0, 8).map((e, i) => (
                <div key={i} style={{ color: HINT }}>
                  {e.type ?? ''} {e.id ?? ''} — {e.error}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* ================= CLEAN ================= */}
      {tab === 'clean' && (
        <div role="tabpanel" id="bc-panel-clean" aria-labelledby="bc-tab-clean">
          {!summary ? (
            !loadErr && (
              <div className="bento py-16 text-center text-sm" style={{ color: HINT }} role="status">
                <Loader2 size={20} className="mx-auto mb-2 animate-spin" /> Loading data…
              </div>
            )
          ) : summary.months.length === 0 ? (
            <div className="bento py-16 text-center text-sm" style={{ color: HINT }}>
              <Database size={26} className="mx-auto mb-2 opacity-60" />
              No uploaded data found — nothing to clean.
            </div>
          ) : (
            <div className="grid gap-3 md:gap-4 xl:grid-cols-[minmax(0,1fr)_370px] items-start">
              {/* ---- step 1: period ---- */}
              <div className="xl:col-start-1 min-w-0">
                <Card
                  step={1}
                  title="Choose the period"
                  sub={mode === 'month' ? 'Tick whole months in the table below.' : 'Any range — for a single day, set From and To to the same date.'}
                  right={
                    <div role="radiogroup" aria-label="Period type" className="inline-flex rounded-xl border border-[var(--hairline)] p-0.5" style={{ background: 'var(--surface-2)' }}>
                      {(
                        [
                          ['month', 'By month', <Layers size={14} key="i" />],
                          ['range', 'By date range', <CalendarRange size={14} key="i" />],
                        ] as const
                      ).map(([v, label, icon]) => (
                        <button
                          key={v}
                          role="radio"
                          aria-checked={mode === v}
                          onClick={() => setMode(v)}
                          className={`inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[12.5px] font-bold transition ${FOCUS}`}
                          style={mode === v ? { background: 'var(--surface)', color: 'var(--accent)', boxShadow: '0 1px 3px rgba(15,23,42,0.12)' } : { color: 'var(--ink-2)' }}
                        >
                          {icon}
                          {label}
                        </button>
                      ))}
                    </div>
                  }
                >
                  {mode === 'range' && (
                    <div className="flex flex-col gap-3 mb-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12px] font-bold text-slate-600 mr-1">Quick:</span>
                        {[['Older than 3 months', 3], ['Older than 6 months', 6], ['Older than 1 year', 12]].map(([label, n]) => {
                          const on = activePreset === n
                          return (
                            <button
                              key={label as string}
                              onClick={() => preset(n as number)}
                              aria-pressed={on}
                              className={`rounded-full border px-3 py-1 text-[12px] font-bold transition ${FOCUS}`}
                              style={on ? { background: ACCENT_BG, borderColor: ACCENT_LINE, color: 'var(--accent)' } : { borderColor: 'var(--hairline)', color: 'var(--ink-2)' }}
                            >
                              {label as string}
                            </button>
                          )
                        })}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                        <label className="block">
                          <span className="text-xs font-semibold text-slate-600">From (empty = from the start)</span>
                          <input
                            type="date"
                            value={from}
                            max={today}
                            onChange={(e) => {
                              setFrom(e.target.value)
                              setActivePreset(null)
                            }}
                            className={`mt-1 w-full ${field}`}
                            aria-invalid={!!rangeMsg}
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold text-slate-600">To (inclusive)</span>
                          <input
                            type="date"
                            value={to}
                            max={today}
                            onChange={(e) => {
                              setTo(e.target.value)
                              setActivePreset(null)
                            }}
                            className={`mt-1 w-full ${field}`}
                            aria-invalid={!!rangeMsg}
                          />
                        </label>
                        <button
                          className={`icon-btn !py-2 disabled:opacity-45 ${FOCUS}`}
                          disabled={!from && !to}
                          onClick={() => {
                            setFrom('')
                            setTo('')
                            setActivePreset(null)
                          }}
                        >
                          <X size={14} /> Clear
                        </button>
                      </div>
                      {rangeMsg && (
                        <div role="alert" className="text-[12px] font-semibold flex items-center gap-1.5" style={{ color: DANGER }}>
                          <AlertTriangle size={13} /> {rangeMsg}
                        </div>
                      )}
                    </div>
                  )}

                  {/* data map: months × types. Highlighted cells are exactly what is selected. */}
                  <div className="rounded-xl border border-[var(--hairline)] overflow-x-auto scroll-area">
                    <table className="w-full min-w-max text-[12.5px] border-separate border-spacing-0">
                      <thead>
                        <tr className="text-left" style={{ background: 'var(--surface-2)' }}>
                          <th scope="col" className="sticky left-0 z-[1] px-3 py-2.5 border-b border-[var(--hairline)]" style={{ background: 'var(--surface-2)' }}>
                            {mode === 'month' ? (
                              <label className="flex items-center gap-2.5 cursor-pointer font-bold text-slate-700">
                                <input
                                  ref={selectAllRef}
                                  type="checkbox"
                                  checked={allPicked}
                                  onChange={() => setPicked(allPicked ? new Set() : new Set(summary.months.map((m) => m.month)))}
                                  className={`w-4 h-4 accent-indigo-600 ${FOCUS}`}
                                />
                                Month
                              </label>
                            ) : (
                              <span className="font-bold text-slate-700">Month</span>
                            )}
                          </th>
                          {mapTypes.map((t) => {
                            const on = types.has(t)
                            return (
                              <th key={t} scope="col" className="px-1.5 py-2 border-b border-[var(--hairline)] text-center">
                                <button
                                  onClick={() => toggleType(t)}
                                  aria-pressed={on}
                                  title={on ? `Exclude ${labels[t]}` : `Include ${labels[t]}`}
                                  className={`w-full rounded-lg px-1.5 py-1 text-[11px] font-bold leading-tight transition ${FOCUS}`}
                                  style={on ? { background: ACCENT_BG, color: 'var(--accent)' } : { color: HINT, textDecoration: 'line-through' }}
                                >
                                  {labels[t] || t}
                                </button>
                              </th>
                            )
                          })}
                          <th scope="col" className="px-3 py-2.5 border-b border-[var(--hairline)] text-right font-bold text-slate-700">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.months.map((m) => {
                          const rowOn = mode === 'month' ? picked.has(m.month) : periodChosen && monthInRange(m.month, from, to)
                          return (
                            <tr key={m.month} className={mode === 'month' ? 'cursor-pointer' : ''} onClick={mode === 'month' ? () => toggleMonth(m.month) : undefined}>
                              <th
                                scope="row"
                                className="sticky left-0 z-[1] px-3 py-2.5 border-b border-[var(--hairline)] text-left font-normal"
                                style={{ background: rowOn ? 'color-mix(in srgb, var(--accent) 6%, var(--surface))' : 'var(--surface)' }}
                              >
                                <div className="flex items-center gap-2.5">
                                  {mode === 'month' && (
                                    <input
                                      type="checkbox"
                                      checked={picked.has(m.month)}
                                      onChange={() => toggleMonth(m.month)}
                                      onClick={(e) => e.stopPropagation()}
                                      className={`w-4 h-4 shrink-0 accent-indigo-600 ${FOCUS}`}
                                      aria-label={`Select ${m.label}`}
                                    />
                                  )}
                                  <div>
                                    <div className="font-bold text-slate-800 whitespace-nowrap">{m.label}</div>
                                    <div className="text-[11px] whitespace-nowrap" style={{ color: HINT }}>
                                      {fmtDay(m.first_date)} – {fmtDay(m.last_date)}
                                    </div>
                                  </div>
                                </div>
                              </th>
                              {mapTypes.map((t) => {
                                const n = m.breakdown[t] ?? 0
                                const hit = rowOn && types.has(t) && n > 0
                                return (
                                  <td
                                    key={t}
                                    className="px-1.5 py-2.5 border-b border-[var(--hairline)] text-center tabular-nums"
                                    style={{
                                      background: hit ? DANGER_BG : rowOn ? 'color-mix(in srgb, var(--accent) 4%, var(--surface))' : undefined,
                                      color: hit ? DANGER : n ? 'var(--ink-2)' : 'var(--ink-muted)',
                                      fontWeight: hit ? 800 : 500,
                                    }}
                                  >
                                    {n || '·'}
                                  </td>
                                )
                              })}
                              <td
                                className="px-3 py-2.5 border-b border-[var(--hairline)] text-right whitespace-nowrap"
                                style={{ background: rowOn ? 'color-mix(in srgb, var(--accent) 4%, var(--surface))' : undefined }}
                              >
                                <div className="font-bold text-slate-800 tabular-nums">{m.record_count.toLocaleString('en-IN')}</div>
                                <div className="text-[11px] tabular-nums" style={{ color: HINT }}>
                                  {humanBytes(m.total_bytes)}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2.5 flex items-center gap-4 flex-wrap text-[11.5px]" style={{ color: HINT }}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded" style={{ background: DANGER_BG, border: `1px solid ${DANGER_LINE}` }} /> Will be removed
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Info size={12} /> Click a column name to include/exclude that data type
                    </span>
                    {mode === 'month' && picked.size > 0 && (
                      <button className={`ml-auto font-bold rounded ${FOCUS}`} style={{ color: 'var(--accent)' }} onClick={() => setPicked(new Set())}>
                        Clear {plural(picked.size, 'month')}
                      </button>
                    )}
                  </div>
                </Card>
              </div>

              {/* ---- step 2: types ---- */}
              <div className="xl:col-start-1 min-w-0">
                <Card
                  step={2}
                  title="Choose the data types"
                  sub={periodChosen ? 'Counts are for the chosen period. Only ticked types are removed.' : 'Counts are for all data. Only ticked types are removed.'}
                  right={
                    <div className="flex items-center gap-2">
                      <button className={`icon-btn ${FOCUS}`} onClick={() => setTypes(new Set(allTypeIds))} disabled={allTypesChosen}>
                        Select all
                      </button>
                      <button className={`icon-btn ${FOCUS}`} onClick={() => setTypes(new Set())} disabled={types.size === 0}>
                        None
                      </button>
                    </div>
                  }
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {summary.types.map((t) => {
                      const on = types.has(t.id)
                      const n = scopeCounts[t.id] ?? 0
                      const Icon = TYPE_ICON[t.id] ?? Database
                      return (
                        <label
                          key={t.id}
                          className="flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-indigo-300"
                          style={{
                            borderColor: on ? ACCENT_LINE : 'var(--hairline)',
                            background: on ? ACCENT_BG : 'var(--surface)',
                            opacity: n === 0 && !on ? 0.6 : 1,
                          }}
                        >
                          <div
                            className="w-9 h-9 rounded-lg grid place-items-center shrink-0"
                            style={on ? { background: 'var(--accent)', color: 'var(--surface)' } : { background: 'var(--surface-2)', color: 'var(--ink-2)' }}
                          >
                            <Icon size={17} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-bold text-slate-800 truncate">{t.label}</div>
                            <div className="text-[11.5px] tabular-nums" style={{ color: HINT }}>
                              {n ? plural(n, 'record') : 'No records'}
                            </div>
                          </div>
                          <input type="checkbox" checked={on} onChange={() => toggleType(t.id)} className="w-4 h-4 shrink-0 accent-indigo-600" />
                        </label>
                      )
                    })}
                  </div>
                </Card>
              </div>

              {/* ---- summary + actions (sticky beside the steps on wide screens) ---- */}
              <aside aria-label="What will happen" className="xl:col-start-2 xl:row-start-1 xl:row-span-3 xl:sticky xl:top-24 self-start min-w-0">
                <section className="bento overflow-hidden">
                  <header className="px-4 py-3.5 border-b border-[var(--hairline)] flex items-center gap-2">
                    <ShieldCheck size={17} style={{ color: 'var(--accent)' }} />
                    <h2 className="text-[14.5px] font-bold text-slate-800">What will happen</h2>
                  </header>

                  {!hasSelection ? (
                    <div className="px-5 py-10 text-center">
                      <Filter size={24} className="mx-auto mb-2 opacity-50" style={{ color: HINT }} />
                      <div className="text-[13px] font-semibold text-slate-700">Nothing selected yet</div>
                      <div className="text-[12px] mt-1" style={{ color: HINT }}>
                        {nextHint}
                      </div>
                    </div>
                  ) : previewBusy && !preview ? (
                    <div className="px-5 py-10 text-center text-[13px]" style={{ color: HINT }} role="status">
                      <Loader2 size={20} className="mx-auto mb-2 animate-spin" /> Calculating…
                    </div>
                  ) : preview && preview.count === 0 ? (
                    <div className="px-5 py-10 text-center">
                      <Info size={22} className="mx-auto mb-2 opacity-60" style={{ color: HINT }} />
                      <div className="text-[13px] font-semibold text-slate-700">No matching records</div>
                      <div className="text-[12px] mt-1" style={{ color: HINT }}>
                        {typeNames} has no data in {periodText}.
                      </div>
                    </div>
                  ) : preview ? (
                    <div className={`p-4 flex flex-col gap-4 transition-opacity ${previewBusy ? 'opacity-60' : ''}`}>
                      <div className="rounded-xl p-3.5" style={{ background: DANGER_BG }}>
                        <div className="flex items-baseline gap-2">
                          <span className="text-[28px] font-extrabold tabular-nums leading-none" style={{ color: DANGER }}>
                            {preview.count.toLocaleString('en-IN')}
                          </span>
                          <span className="text-[13px] font-semibold text-slate-700">{preview.count === 1 ? 'record' : 'records'}</span>
                          <span className="ml-auto text-[14px] font-bold tabular-nums text-slate-700">{preview.humanBytes}</span>
                        </div>
                        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
                          <dt style={{ color: HINT }}>Period</dt>
                          <dd className="font-semibold text-slate-700">{periodText}</dd>
                          <dt style={{ color: HINT }}>Types</dt>
                          <dd className="font-semibold text-slate-700">{typeNames}</dd>
                          <dt style={{ color: HINT }}>Dates</dt>
                          <dd className="text-slate-700">
                            {fmtDay(preview.first_date || '')} – {fmtDay(preview.last_date || '')}
                          </dd>
                          <dt style={{ color: HINT }}>Users</dt>
                          <dd className="text-slate-700">{preview.users.length}</dd>
                        </dl>
                      </div>
                      <Chips breakdown={preview.breakdown} labels={labels} only={allTypeIds} />
                      {preview.recent_count > 0 && (
                        <label className="flex items-start gap-2 text-[12px] rounded-lg p-2.5 cursor-pointer border" style={{ background: DANGER_BG, borderColor: DANGER_LINE }}>
                          <input type="checkbox" checked={overrideRecent} onChange={(e) => setOverrideRecent(e.target.checked)} className={`mt-0.5 w-4 h-4 shrink-0 accent-red-600 ${FOCUS}`} />
                          <span style={{ color: DANGER }}>
                            <b>{preview.recent_count}</b> {preview.recent_count === 1 ? 'is' : 'are'} from the last {summary.config.minAgeDays} days (after {fmtDay(preview.recent_cutoff)}). Tick to
                            confirm you meant to include {preview.recent_count === 1 ? 'it' : 'them'}.
                          </span>
                        </label>
                      )}

                      <div className="flex flex-col gap-2 pt-4 border-t border-[var(--hairline)]">
                        <div className="text-[13px] font-bold text-slate-800 flex items-center gap-2">
                          {backupTaken ? <CheckCircle2 size={15} style={{ color: OK }} /> : <Download size={15} style={{ color: 'var(--accent)' }} />}
                          Backup first <span className="font-normal text-[11.5px]" style={{ color: HINT }}>(recommended)</span>
                        </div>
                        <button className={`icon-btn justify-center !py-2 disabled:opacity-45 ${FOCUS}`} onClick={doExport} disabled={exporting || running}>
                          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                          {exporting ? 'Building ZIP…' : backupTaken ? 'Download again' : 'Download backup (.zip)'}
                        </button>
                        {backupTaken ? (
                          <span className="text-[11.5px] font-semibold flex items-center gap-1 min-w-0" style={{ color: OK }}>
                            <CheckCircle2 size={13} className="shrink-0" /> <span className="truncate">Saved as {backupName}</span>
                          </span>
                        ) : (
                          <span className="text-[11.5px] font-semibold inline-flex items-center gap-1" style={{ color: DANGER }}>
                            <AlertTriangle size={13} /> No backup taken yet
                          </span>
                        )}
                      </div>

                      <fieldset className="flex flex-col gap-2 pt-4 border-t border-[var(--hairline)]">
                        <legend className="text-[13px] font-bold text-slate-800 mb-2">How to remove</legend>
                        {[
                          { v: true, title: 'Move to Archive', desc: `Can be restored from the Archive tab for ${archiveDays} days.`, icon: <Archive size={15} /> },
                          { v: false, title: 'Delete permanently', desc: 'Removed from disk now. Cannot be restored.', icon: <Trash2 size={15} /> },
                        ].map((o) => {
                          const on = soft === o.v
                          const danger = !o.v
                          return (
                            <label
                              key={o.title}
                              className="flex items-start gap-2.5 rounded-lg border p-2.5 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-indigo-300"
                              style={{
                                borderColor: on ? (danger ? DANGER_LINE : ACCENT_LINE) : 'var(--hairline)',
                                background: on ? (danger ? DANGER_BG : ACCENT_BG) : 'var(--surface)',
                              }}
                            >
                              <input type="radio" name="bc-mode" checked={on} onChange={() => setSoft(o.v)} className={`mt-0.5 w-4 h-4 shrink-0 ${danger ? 'accent-red-600' : 'accent-indigo-600'}`} />
                              <span className="min-w-0">
                                <span className="flex items-center gap-1.5 text-[13px] font-bold" style={{ color: danger && on ? DANGER : 'var(--ink)' }}>
                                  {o.icon} {o.title}
                                  {o.v && (
                                    <span className={chip} style={{ background: OK_BG, color: OK }}>
                                      Safer
                                    </span>
                                  )}
                                </span>
                                <span className="block text-[11.5px] mt-0.5" style={{ color: HINT }}>
                                  {o.desc}
                                </span>
                              </span>
                            </label>
                          )
                        })}
                      </fieldset>

                      <button
                        className={`icon-btn justify-center !py-2.5 !text-[13px] !text-white disabled:opacity-45 disabled:cursor-not-allowed ${FOCUS}`}
                        style={{ background: '#dc2626', borderColor: '#dc2626' }}
                        disabled={!canDelete}
                        onClick={() => setConfirming(true)}
                      >
                        {soft ? <Archive size={15} /> : <Trash2 size={15} />}
                        {soft ? `Archive ${plural(preview.count, 'record')}` : `Delete ${plural(preview.count, 'record')}`}
                      </button>
                    </div>
                  ) : null}
                </section>
              </aside>

              {/* ---- step 3: review ---- */}
              <div className="xl:col-start-1 min-w-0">
                <Card
                  step={3}
                  title="Review the records"
                  sub={hasSelection ? `${plural(itemsTotal, 'record')} match — this is exactly what will be removed.` : 'Records appear here once a period and data types are chosen.'}
                >
                  {!hasSelection ? (
                    <div className="py-8 text-center text-[13px]" style={{ color: HINT }}>
                      {nextHint}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="flex items-center gap-2 rounded-xl border border-[var(--hairline)] px-3 py-2 flex-1 min-w-[200px] focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-200">
                          <Search size={14} style={{ color: HINT }} />
                          <span className="sr-only">Search records</span>
                          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search uploader, file or machine…" className="w-full text-sm outline-none bg-transparent" />
                          {q && (
                            <button className={`p-0.5 rounded ${FOCUS}`} onClick={() => setQ('')} aria-label="Clear search" style={{ color: HINT }}>
                              <X size={14} />
                            </button>
                          )}
                        </label>
                        <label className="sr-only" htmlFor="bc-review-type">
                          Show type
                        </label>
                        <select id="bc-review-type" value={reviewType} onChange={(e) => setReviewType(e.target.value)} className={field}>
                          <option value="all">All chosen types</option>
                          {typeList.map((t) => (
                            <option key={t} value={t}>
                              {labels[t] || t}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="rounded-xl border border-[var(--hairline)] overflow-x-auto scroll-area">
                        <table className="w-full min-w-max text-[12.5px]">
                          <thead>
                            <tr className="text-left" style={{ background: 'var(--surface-2)' }}>
                              {['Date', 'Type', 'Uploaded by', 'Name', 'Size'].map((h) => (
                                <th key={h} scope="col" className={`px-3 py-2 font-bold text-slate-600 whitespace-nowrap ${h === 'Size' ? 'text-right' : ''}`}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className={itemsBusy ? 'opacity-50' : ''}>
                            {items.map((it) => {
                              const Icon = TYPE_ICON[it.type] ?? Database
                              return (
                                <tr key={`${it.type}-${it.id}`} className="border-t border-[var(--hairline)] hover:bg-slate-50">
                                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">{fmtDay(it.date)}</td>
                                  <td className="px-3 py-2 whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                                      <Icon size={13} style={{ color: 'var(--accent)' }} /> {it.typeLabel}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: HINT }}>
                                    {it.by}
                                  </td>
                                  <td className="px-3 py-2 max-w-[340px] truncate" title={it.name}>
                                    {it.name}
                                    {it.files > 0 && <span style={{ color: HINT }}> · {plural(it.files, 'file')}</span>}
                                    {it.photos > 0 && <span style={{ color: HINT }}> · {plural(it.photos, 'photo')}</span>}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap tabular-nums text-right">{humanBytes(it.bytes)}</td>
                                </tr>
                              )
                            })}
                            {items.length === 0 && (
                              <tr>
                                <td colSpan={5} className="px-3 py-8 text-center" style={{ color: HINT }}>
                                  {itemsBusy ? (
                                    <>
                                      <Loader2 size={15} className="inline animate-spin mr-1" /> Loading…
                                    </>
                                  ) : (
                                    'No records match.'
                                  )}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      {pages > 1 && (
                        <div className="flex items-center justify-between gap-2 text-[12px]">
                          <span style={{ color: HINT }}>
                            Page {page} of {pages}
                          </span>
                          <div className="flex gap-2">
                            <button className={`icon-btn disabled:opacity-45 ${FOCUS}`} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                              Previous
                            </button>
                            <button className={`icon-btn disabled:opacity-45 ${FOCUS}`} disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= ARCHIVE ================= */}
      {tab === 'archive' && (
        <div role="tabpanel" id="bc-panel-archive" aria-labelledby="bc-tab-archive">
          <Card title="Archive" sub={`Records moved here stay restorable for ${archiveDays} days, then are removed for good.`}>
            {archive === null ? (
              <div className="py-10 text-center text-sm" style={{ color: HINT }} role="status">
                <Loader2 size={18} className="mx-auto mb-2 animate-spin" /> Loading archive…
              </div>
            ) : archive.length === 0 ? (
              <div className="py-12 text-center text-sm" style={{ color: HINT }}>
                <Archive size={26} className="mx-auto mb-2 opacity-60" />
                Nothing in the archive.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {archive.map((a) => (
                  <div key={a.file} className="flex items-center gap-3 rounded-xl border border-[var(--hairline)] px-4 py-3 flex-wrap">
                    <div className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: ACCENT_BG, color: 'var(--accent)' }}>
                      <Archive size={17} />
                    </div>
                    <div className="min-w-[180px] flex-1">
                      <div className="text-[13.5px] font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                        {plural(a.count, 'record')}
                        {a.expired ? (
                          <span className={chip} style={{ background: DANGER_BG, color: DANGER }}>
                            Restore window passed
                          </span>
                        ) : (
                          <span className={chip} style={{ background: OK_BG, color: OK }}>
                            Restorable until {new Date(a.keepUntil).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                      <div className="text-[11.5px] mt-0.5" style={{ color: HINT }}>
                        Archived by {a.by} · {new Date(a.archivedAt).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <button className={`icon-btn disabled:opacity-45 ${FOCUS}`} disabled={!!restoring} onClick={() => doRestore(a.file)}>
                      {restoring === a.file ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />}
                      {restoring === a.file ? 'Restoring…' : 'Restore'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ================= HISTORY ================= */}
      {tab === 'history' && (
        <div role="tabpanel" id="bc-panel-history" aria-labelledby="bc-tab-history">
          <Card title="History" sub="Every preview, backup, delete and restore — kept even when data is removed.">
            <div className="rounded-xl border border-[var(--hairline)] overflow-x-auto scroll-area">
              <table className="w-full min-w-max text-[12.5px]">
                <thead>
                  <tr className="text-left" style={{ background: 'var(--surface-2)' }}>
                    {['When', 'Admin', 'Action', 'Period', 'Types', 'Records', 'Size', 'Mode', 'Backup', 'Status', 'IP'].map((h) => (
                      <th key={h} scope="col" className="px-3 py-2 font-bold text-slate-600 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history?.map((h) => (
                    <tr key={h.id} className="border-t border-[var(--hairline)] hover:bg-slate-50">
                      <td className="px-3 py-2 whitespace-nowrap">{new Date(h.createdAt).toLocaleString('en-IN')}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-semibold text-slate-700">{h.admin_user}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span
                          className={chip}
                          style={
                            h.action === 'delete'
                              ? { background: DANGER_BG, color: DANGER }
                              : h.action === 'restore'
                                ? { background: OK_BG, color: OK }
                                : { background: ACCENT_BG, color: 'var(--accent)' }
                          }
                        >
                          {h.action}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{h.range_from || h.range_to ? `${h.range_from ?? '…'} → ${h.range_to ?? '…'}` : '—'}</td>
                      <td className="px-3 py-2 max-w-[220px] truncate" title={h.types?.map((t) => labels[t] || t).join(', ')}>
                        {!h.types || h.types.length >= allTypeIds.length ? 'All' : h.types.map((t) => labels[t] || t).join(', ')}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums">{h.record_count ?? '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums">{h.total_bytes ? humanBytes(h.total_bytes) : '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{h.soft_delete === undefined ? '—' : h.soft_delete ? 'Archive' : 'Permanent'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{h.backup_taken === undefined ? '—' : h.backup_taken ? 'Yes' : 'No'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{h.status}</td>
                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: HINT }}>
                        {h.admin_ip || '—'}
                      </td>
                    </tr>
                  ))}
                  {history === null && (
                    <tr>
                      <td colSpan={11} className="px-3 py-8 text-center" style={{ color: HINT }}>
                        <Loader2 size={16} className="inline animate-spin mr-1" /> Loading history…
                      </td>
                    </tr>
                  )}
                  {history?.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-3 py-8 text-center" style={{ color: HINT }}>
                        No Backup Clean actions yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {confirming && preview && (
        <ConfirmDialog
          preview={preview}
          soft={soft}
          backupTaken={backupTaken}
          recentAcknowledged={overrideRecent}
          labels={labels}
          typeNames={typeNames}
          periodText={periodText}
          archiveDays={archiveDays}
          onCancel={() => setConfirming(false)}
          onConfirm={doDelete}
        />
      )}
    </div>
  )
}
