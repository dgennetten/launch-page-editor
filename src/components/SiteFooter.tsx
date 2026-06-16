interface SiteFooterProps {
  text: string
}

export function SiteFooter({ text }: SiteFooterProps) {
  return (
    <footer className="bg-gray-800 py-6 text-center text-white">
      <p className="text-sm">{text}</p>
    </footer>
  )
}
