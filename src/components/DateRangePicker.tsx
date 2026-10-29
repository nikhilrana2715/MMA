import { useState } from 'react'
import { CalendarRange, ChevronRight, Sparkles, X } from 'lucide-react'

export interface DateRange {
  from: string
  to: string
}

const PRESETS = [3, 7, 14, 30]

/** Header control: pick a date range to switch the Dashboard into trend-analysis mode. */
export function DateRangePicker({
  value,
  onApply,
  onClear,
  maxDate,
  align = 'left',
  allowFuture = false,
  kpiActive = false,
  onKpiDashboard,
}: {
  value: DateRange | null
  onApply: (r: DateRange) => void
  onClear: () => void
  maxDate: string
  /** Which edge the popover opens from. Use 'right' when the trigger sits at the far right. */
  align?: 'left' | 'right'
  /** Allow picking dates beyond `maxDate` (e.g. future planning). Presets stay relative to maxDate. */
  allowFuture?: boolean
  /** Whether the dashboard is currently showing monthly KPI calculated data */
  kpiActive?: boolean
  /** Action when clicking the stylish KPI Dashboard button in the popover */
  onKpiDashboard?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(value?.from ?? '')
  const [to, setTo] = useState(value?.to ?? maxDate)

  const preset = (days: number) => {
    const end = new Date(maxDate + 'T00:00:00')
    const start = new Date(end)
    start.setDate(start.getDate() - (days - 1))
    const f = start.toLocaleDateString('en-CA')
    setFrom(f)
    setTo(maxDate)
    onApply({ from: f, to: maxDate })
    setOpen(false)
  }

  const apply = () => {
    if (!from || !to) return
    const [f, t] = from <= to ? [from, to] : [to, from]
    onApply({ from: f, to: t })
    setOpen(false)
  }

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`relative flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[13px] font-semibold transition min-w-0 ${
          value
            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
            : 'bg-white border-[var(--hairline)] text-slate-700 hover:bg-slate-50'
        }`}
        title="Analyse a date range or select KPI Dashboard"
      >
        <CalendarRange size={14} className="shrink-0" />
        <span className="truncate">
          {value
            ? `${new Date(value.from + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} → ${new Date(
                value.to + 'T00:00:00',
              ).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`
            : 'Date range'}
        </span>
        {kpiActive && (
          <span className="flex h-2 w-2 relative shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={`absolute z-50 top-full ${
              align === 'right' ? 'right-0' : 'right-0 md:left-0'
            } mt-2 w-80 max-w-[92vw] bg-white rounded-2xl shadow-2xl border border-slate-200 p-3.5 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150`}
          >
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-800">Select Date Range</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Stylish, premium KPI Dashboard button */}
            {onKpiDashboard && (
              <button
                type="button"
                onClick={() => {
                  onKpiDashboard()
                  setOpen(false)
                }}
                className="relative group w-full p-[1.5px] rounded-xl overflow-hidden bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 shadow-md hover:shadow-indigo-500/30 transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] text-left"
              >
                <div className="flex items-center justify-between w-full px-3 py-2.5 rounded-[10px] bg-slate-900/95 group-hover:bg-slate-900 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-tr from-amber-400 to-yellow-300 text-slate-950 shadow-sm shrink-0">
                      <Sparkles size={16} className="animate-pulse" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-bold text-white tracking-wide">
                          KPI Dashboard
                        </span>
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                          LIVE
                        </span>
                      </div>
                      <span className="text-[10.5px] text-indigo-200/90 font-medium truncate">
                        KPI data according to dashboard
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={17} className="text-indigo-300 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </div>
              </button>
            )}

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[11px] font-semibold text-slate-500">From</span>
                <input
                  type="date"
                  value={from}
                  max={allowFuture ? (to || undefined) : to || maxDate}
                  onChange={(e) => setFrom(e.target.value)}
                  className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 transition"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-slate-500">To</span>
                <input
                  type="date"
                  value={to}
                  min={from}
                  max={allowFuture ? undefined : maxDate}
                  onChange={(e) => setTo(e.target.value)}
                  className="mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 transition"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((d) => (
                <button
                  key={d}
                  onClick={() => preset(d)}
                  className="text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg px-2.5 py-1 transition"
                >
                  Last {d}d
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={apply}
                disabled={!from || !to}
                className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold py-2 shadow-sm transition"
              >
                Apply Range
              </button>
              {value && (
                <button
                  onClick={() => {
                    onClear()
                    setOpen(false)
                  }}
                  className="rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold px-3 py-2 hover:bg-slate-50 transition"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
