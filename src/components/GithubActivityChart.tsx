import { useEffect, useMemo, useRef, useState } from 'react'
import { GithubContributionsHeatmap } from './GithubContributionsHeatmap'

const fallbackWeeklyLinesAdded = [
  92, 102, 118, 97, 124, 132, 114, 140,
  128, 148, 161, 152, 174, 186, 168, 194,
  182, 206, 218, 199, 231, 243, 224, 258,
  242, 269, 281, 263, 296, 307, 289, 321,
  303, 336, 348, 329, 362, 376, 358, 389,
  372, 401, 414, 395, 428, 440, 421, 456,
  438, 468, 481, 462, 495,
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEK_SECONDS = 7 * 86400

const SAMPLE_STATUS = 'Showing sample data — add a GitHub token for live activity'

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${value % 1_000_000 === 0 ? value / 1_000_000 : (value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${value % 1_000 === 0 ? value / 1_000 : (value / 1_000).toFixed(1)}K`
  return String(value)
}

/** Sunday UTC start of the week containing `date`, matching GitHub's week buckets. */
function githubWeekStartUnix(date = new Date()): number {
  const day = date.getUTCDay()
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day) / 1000)
}

function buildMonthTicks(
  weekCount: number,
  endUnix: number,
  width: number,
  padding: number,
): Array<{ x: number; label: string; weekIndex: number }> {
  if (weekCount <= 0) return []
  const chartWidth = width - padding * 2
  const stepX = chartWidth / Math.max(weekCount - 1, 1)
  const ticks: Array<{ x: number; label: string; weekIndex: number }> = []
  let lastMonth = -1

  for (let i = 0; i < weekCount; i++) {
    const ts = endUnix - (weekCount - 1 - i) * WEEK_SECONDS
    const month = new Date(ts * 1000).getUTCMonth()
    if (month === lastMonth) continue
    ticks.push({ x: padding + i * stepX, label: MONTHS[month], weekIndex: i })
    lastMonth = month
  }

  return ticks
}

function buildChart(values: number[], width: number, height: number, padding: number) {
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2
  const stepX = chartWidth / Math.max(values.length - 1, 1)

  // Log scale: weekly line counts span several orders of magnitude (a huge
  // initial commit can dwarf a typical week), so a linear axis flattens
  // everything. The axis runs from 1 (bottom) to the next power of 10 above
  // the max; values of 0/1 clamp to the baseline.
  const maxValue = Math.max(...values, 1)
  const maxExp = Math.max(1, Math.ceil(Math.log10(maxValue)))
  const logOf = (value: number) => Math.log10(Math.max(value, 1))
  const yFor = (value: number) => padding + chartHeight - (logOf(value) / maxExp) * chartHeight

  const points = values.map((value, index) => ({
    x: padding + index * stepX,
    y: yFor(value),
  }))

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')

  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${height - padding} L ${points[0].x.toFixed(2)} ${height - padding} Z`

  const yTicks = Array.from({ length: maxExp + 1 }, (_, exp) => ({
    value: 10 ** exp,
    y: yFor(10 ** exp),
  }))

  return { points, linePath, areaPath, yTicks }
}

export function GithubActivityChart() {
  const [weeklyLinesAdded, setWeeklyLinesAdded] = useState<number[]>(fallbackWeeklyLinesAdded)
  const [weekEndUnix, setWeekEndUnix] = useState(() => githubWeekStartUnix())
  const [status, setStatus] = useState(SAMPLE_STATUS)
  const [hasRealData, setHasRealData] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      try {
        const serverResponse = await fetch('/api/github-stats.php')
        const serverData = await serverResponse.json()
        const serverValues = Array.isArray(serverData?.values) ? serverData.values : null

        if (!isMounted) {
          return
        }

        // Only ever show real server data; otherwise keep the clearly-labeled sample.
        if (serverValues && serverValues.some((value: number | string) => Number(value) > 0)) {
          setWeeklyLinesAdded(serverValues.map((value: number | string) => Number(value) || 0))
          setHasRealData(true)
          setStatus(serverData?.source === 'private' ? 'Using private GitHub activity' : 'Using public GitHub activity')
          const end = Number(serverData?.end)
          setWeekEndUnix(end > 0 ? end : githubWeekStartUnix())
          return
        }

        setWeeklyLinesAdded(fallbackWeeklyLinesAdded)
        setHasRealData(false)
        setStatus(SAMPLE_STATUS)
        setWeekEndUnix(githubWeekStartUnix())
      } catch {
        if (isMounted) {
          setWeeklyLinesAdded(fallbackWeeklyLinesAdded)
          setHasRealData(false)
          setStatus(SAMPLE_STATUS)
          setWeekEndUnix(githubWeekStartUnix())
        }
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [])

  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(960)
  const height = 260
  const padding = 34

  // Render the SVG at the container's actual width (1:1 pixels) instead of
  // scaling a fixed 1040px viewBox down, which forced a min-width and sideways
  // scroll on mobile and shrank the labels to nothing.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width
      if (measured) setWidth(Math.round(measured))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const { points, linePath, areaPath, yTicks } = useMemo(
    () => buildChart(weeklyLinesAdded, width, height, padding),
    [weeklyLinesAdded, width],
  )
  const monthTicks = useMemo(
    () => buildMonthTicks(weeklyLinesAdded.length, weekEndUnix, width, padding),
    [weeklyLinesAdded.length, weekEndUnix, width],
  )
  const average = Math.round(weeklyLinesAdded.reduce((sum, value) => sum + value, 0) / weeklyLinesAdded.length)

  return (
    <div className="mx-auto mt-2 w-full max-w-6xl px-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-sm font-semibold tracking-wide text-slate-800">GitHub activity</p>
            <p className="text-xs text-slate-500">Lines added per week over the last year (log scale)</p>
            <p className="text-[11px] text-slate-400">{status}</p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {hasRealData ? `Avg ${average.toLocaleString()} lines/week` : 'Sample data'}
          </div>
        </div>

        <div ref={containerRef} className="px-4 py-5 sm:px-6">
          <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} className="block">
            <line x1={padding} x2={padding} y1={padding} y2={height - padding} stroke="rgba(15, 23, 42, 0.18)" />
            <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} stroke="rgba(15, 23, 42, 0.18)" />

            {yTicks.map((tick) => (
              <g key={tick.value}>
                <line
                  x1={padding}
                  x2={width - padding}
                  y1={tick.y}
                  y2={tick.y}
                  stroke="rgba(15, 23, 42, 0.12)"
                  strokeDasharray="4 4"
                />
                <text x={padding - 10} y={tick.y + 4} textAnchor="end" fill="rgba(51, 65, 85, 0.75)" fontSize="11">
                  {formatCompact(tick.value)}
                </text>
              </g>
            ))}

            <path d={areaPath} fill="url(#activityFill)" />
            <path d={linePath} fill="none" stroke="#2563eb" strokeWidth="3.2" strokeLinecap="round" />

            {width >= 560 &&
              points.map((point, index) => (
                <circle
                  key={`${point.x}-${point.y}`}
                  cx={point.x}
                  cy={point.y}
                  r={index === points.length - 1 ? 5 : 3.5}
                  fill={index === points.length - 1 ? '#ffffff' : '#2563eb'}
                  stroke="#1e293b"
                  strokeWidth="1.5"
                />
              ))}

            {points.length > 0 && (
              <circle
                cx={points[points.length - 1].x}
                cy={points[points.length - 1].y}
                r={5}
                fill="#ffffff"
                stroke="#1e293b"
                strokeWidth="1.5"
              />
            )}

            {monthTicks.map((tick) => (
              <g key={`${tick.label}-${tick.weekIndex}`}>
                <line x1={tick.x} x2={tick.x} y1={height - padding} y2={height - padding + 8} stroke="rgba(15, 23, 42, 0.25)" />
                <text x={tick.x} y={height - padding + 24} textAnchor="middle" fill="rgba(51, 65, 85, 0.8)" fontSize="12">
                  {tick.label}
                </text>
              </g>
            ))}

            <defs>
              <linearGradient id="activityFill" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(37,99,235,0.20)" />
                <stop offset="100%" stopColor="rgba(37,99,235,0.02)" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <GithubContributionsHeatmap />
      </div>
    </div>
  )
}
