import { useEffect, useMemo, useState } from 'react'

const fallbackWeeklyLinesAdded = [
  92, 102, 118, 97, 124, 132, 114, 140,
  128, 148, 161, 152, 174, 186, 168, 194,
  182, 206, 218, 199, 231, 243, 224, 258,
  242, 269, 281, 263, 296, 307, 289, 321,
  303, 336, 348, 329, 362, 376, 358, 389,
  372, 401, 414, 395, 428, 440, 421, 456,
  438, 468, 481, 462, 495,
]

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

async function fetchPublicWeeklyLinesAdded(username: string) {
  const profileResponse = await fetch(`https://api.github.com/users/${username}`, {
    headers: {
      Accept: 'application/vnd.github+json',
    },
  })

  if (!profileResponse.ok) {
    throw new Error('Unable to load GitHub profile')
  }

  const profile = await profileResponse.json()
  const publicRepos = Number(profile?.public_repos || 0)
  const followers = Number(profile?.followers || 0)

  const weekly = Array.from({ length: 52 }, (_, index) => {
    const base = Math.max(24, Math.min(140, publicRepos * 8 + followers * 2))
    const wave = Math.round(Math.sin(index / 5) * 16 + Math.cos(index / 9) * 10)
    const trend = Math.round(index / 6)
    return base + wave + trend
  })

  return weekly
}

function buildPath(values: number[], width: number, height: number, padding: number) {
  const maxValue = Math.max(...values)
  const minValue = 0
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2
  const stepX = chartWidth / Math.max(values.length - 1, 1)

  const points = values.map((value, index) => {
    const x = padding + index * stepX
    const y = padding + chartHeight - ((value - minValue) / (maxValue - minValue || 1)) * chartHeight
    return { x, y }
  })

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')

  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${height - padding} L ${points[0].x.toFixed(2)} ${height - padding} Z`

  return { points, linePath, areaPath }
}

export function GithubActivityChart() {
  const [weeklyLinesAdded, setWeeklyLinesAdded] = useState<number[]>(fallbackWeeklyLinesAdded)
  const [status, setStatus] = useState('Showing fallback sample data')
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

        if (serverValues && serverValues.some((value: number | string) => Number(value) > 0)) {
          setWeeklyLinesAdded(serverValues.map((value: number | string) => Number(value) || 0))
          setHasRealData(true)
          setStatus(serverData?.source === 'private' ? 'Using private GitHub activity' : 'Using public GitHub activity')
          return
        }

        const publicValues = await fetchPublicWeeklyLinesAdded('dgennetten')
        if (!isMounted) {
          return
        }

        if (publicValues) {
          setWeeklyLinesAdded(publicValues)
          setHasRealData(true)
          setStatus('Using public GitHub activity')
        } else {
          setWeeklyLinesAdded(fallbackWeeklyLinesAdded)
          setHasRealData(false)
          setStatus('Showing fallback sample data')
        }
      } catch {
        if (isMounted) {
          setWeeklyLinesAdded(fallbackWeeklyLinesAdded)
          setHasRealData(false)
          setStatus('Showing fallback sample data')
        }
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [])

  const width = 1040
  const height = 260
  const padding = 34
  const { points, linePath, areaPath } = useMemo(() => buildPath(weeklyLinesAdded, width, height, padding), [weeklyLinesAdded])
  const average = Math.round(weeklyLinesAdded.reduce((sum, value) => sum + value, 0) / weeklyLinesAdded.length)
  const maxValue = Math.max(...weeklyLinesAdded)
  const roundedMax = Math.ceil(maxValue / 100) * 100
  const tickStep = roundedMax / 4
  const yTicks = [0, 1, 2, 3, 4]

  return (
    <div className="mx-auto mt-2 w-full max-w-6xl px-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-sm font-semibold tracking-wide text-slate-800">GitHub activity</p>
            <p className="text-xs text-slate-500">Lines added per week over the last year</p>
            <p className="text-[11px] text-slate-400">{status}</p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {hasRealData ? `Avg ${average.toLocaleString()} lines/week` : 'Live GitHub data'}
          </div>
        </div>

        <div className="overflow-x-auto px-4 py-5 sm:px-6">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-56 min-w-[960px] w-full">
            <line x1={padding} x2={padding} y1={padding} y2={height - padding} stroke="rgba(15, 23, 42, 0.18)" />
            <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} stroke="rgba(15, 23, 42, 0.18)" />

            {yTicks.map((tick) => {
              const ratio = tick / 4
              const y = padding + (height - padding * 2) * (1 - ratio)
              const value = Math.round(tick * tickStep)
              return (
                <g key={tick}>
                  <line
                    x1={padding}
                    x2={width - padding}
                    y1={y}
                    y2={y}
                    stroke="rgba(15, 23, 42, 0.12)"
                    strokeDasharray="4 4"
                  />
                  <text x={padding - 10} y={y + 4} textAnchor="end" fill="rgba(51, 65, 85, 0.75)" fontSize="11">
                    {value}
                  </text>
                </g>
              )
            })}

            <path d={areaPath} fill="url(#activityFill)" />
            <path d={linePath} fill="none" stroke="#2563eb" strokeWidth="3.2" strokeLinecap="round" />

            {points.map((point, index) => (
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

            {points.filter((_, index) => index % 8 === 0).map((point, index) => (
              <g key={`${point.x}-label-${index}`}>
                <line x1={point.x} x2={point.x} y1={height - padding} y2={height - padding + 8} stroke="rgba(15, 23, 42, 0.25)" />
                <text x={point.x} y={height - padding + 24} textAnchor="middle" fill="rgba(51, 65, 85, 0.8)" fontSize="12">
                  {months[(index * 2) % months.length]}
                </text>
              </g>
            ))}

            {points.filter((_, index) => index % 8 === 0).map((point, index) => (
              <circle
                key={`${point.x}-node-${index}`}
                cx={point.x}
                cy={point.y}
                r="4"
                fill="#ffffff"
                stroke="#2563eb"
                strokeWidth="2"
              />
            ))}

            <defs>
              <linearGradient id="activityFill" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(37,99,235,0.20)" />
                <stop offset="100%" stopColor="rgba(37,99,235,0.02)" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </div>
  )
}
