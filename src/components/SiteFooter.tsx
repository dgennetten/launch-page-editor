import { Link } from 'react-router-dom'
import { GithubActivityChart } from './GithubActivityChart'

interface SiteFooterProps {
  text: string
}

export function SiteFooter({ text }: SiteFooterProps) {
  return (
    <footer className="border-t border-slate-200 bg-gray-50 py-8 text-slate-700">
      <GithubActivityChart />
      <p className="mt-6 text-center text-sm text-slate-500">
        {text}{' '}
        <Link
          to="/admin"
          className="text-slate-400 underline decoration-dotted underline-offset-2 hover:text-slate-600"
        >
          Edit
        </Link>
      </p>
    </footer>
  )
}
