import { useEffect, useMemo, useRef, useState } from 'react'

type Day = { date: string; count: number; level: number; weekday: number }
type ContributionsData = { weeks: Day[][]; total: number; source: string }

// GitHub's contribution-graph palette (light theme).
const LEVEL_COLORS = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_LABELS: Array<[number, string]> = [
  [1, 'Mon'],
  [3, 'Wed'],
  [5, 'Fri'],
]

export function GithubContributionsHeatmap() {
  const [data, setData] = useState<ContributionsData | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(720)

  useEffect(() => {
    let mounted = true
    fetch('/api/github-contributions.php')
      .then((r) => r.json())
      .then((d: ContributionsData) => {
        if (mounted && Array.isArray(d?.weeks) && d.weeks.length > 0) setData(d)
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width
      if (measured) setWidth(Math.round(measured))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [data])

  const layout = useMemo(() => {
    if (!data) return null
    const weeks = data.weeks
    const leftGutter = 28
    const topGutter = 16
    const colPitch = (width - leftGutter) / Math.max(weeks.length, 1)
    const gap = Math.max(1, colPitch * 0.14)
    const size = Math.max(2, colPitch - gap)
    const height = topGutter + 7 * colPitch

    // Label a month at the first week that falls in it.
    const monthLabels: Array<{ x: number; label: string }> = []
    let lastMonth = -1
    weeks.forEach((week, index) => {
      const firstDay = week[0]
      if (!firstDay) return
      const month = new Date(`${firstDay.date}T00:00:00`).getMonth()
      if (month !== lastMonth) {
        monthLabels.push({ x: leftGutter + index * colPitch, label: MONTHS[month] })
        lastMonth = month
      }
    })

    return { weeks, leftGutter, topGutter, colPitch, size, height, monthLabels }
  }, [data, width])

  if (!data || !layout) return null

  const { weeks, leftGutter, topGutter, colPitch, size, height, monthLabels } = layout

  return (
    <div className="border-t border-slate-200 px-4 py-4 sm:px-6">
      <p className="mb-2 text-xs font-medium text-slate-600">
        {data.total.toLocaleString()} contributions in the last year
      </p>
      <div ref={containerRef}>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} className="block">
          {monthLabels.map((month, index) => (
            <text key={`${month.label}-${index}`} x={month.x} y={11} fontSize="10" fill="rgba(51,65,85,0.75)">
              {month.label}
            </text>
          ))}

          {DAY_LABELS.map(([row, label]) => (
            <text
              key={label}
              x={0}
              y={topGutter + row * colPitch + size * 0.8}
              fontSize="9"
              fill="rgba(51,65,85,0.6)"
            >
              {label}
            </text>
          ))}

          {weeks.map((week, weekIndex) =>
            week.map((day) => (
              <rect
                key={day.date}
                x={leftGutter + weekIndex * colPitch}
                y={topGutter + day.weekday * colPitch}
                width={size}
                height={size}
                rx={Math.min(2, size * 0.25)}
                fill={LEVEL_COLORS[day.level] ?? LEVEL_COLORS[0]}
              >
                <title>{`${day.count} contribution${day.count === 1 ? '' : 's'} on ${day.date}`}</title>
              </rect>
            )),
          )}
        </svg>
      </div>
      <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-500">
        <span>Less</span>
        {LEVEL_COLORS.map((color, index) => (
          <span
            key={index}
            className="inline-block h-2.5 w-2.5 rounded-[2px]"
            style={{ backgroundColor: color }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}
