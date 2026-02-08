import { Coffee } from "lucide-react"
import Link from "next/link"

const links = [
  {
    title: "Product",
    items: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Pricing", href: "#pricing" },
      { label: "Venues", href: "#venues" },
    ],
  },
  {
    title: "Company",
    items: [
      { label: "About", href: "#" },
      { label: "FAQ", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
  {
    title: "Partners",
    items: [
      { label: "Partner with us", href: "#" },
      { label: "Venue dashboard", href: "/auth/login" },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 py-12 lg:px-6">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2">
              <Coffee className="h-5 w-5 text-primary" />
              <span className="text-lg font-bold tracking-tight text-foreground">
                donedonadone
              </span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Group coworking for the solo workers of HSR Layout.
            </p>
          </div>

          {/* Link columns */}
          {links.map((group) => (
            <div key={group.title}>
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                {group.title}
              </h3>
              <ul className="flex flex-col gap-2">
                {group.items.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-border pt-6 text-center">
          <p className="text-xs text-muted-foreground">
            Made with coffee in HSR Layout, Bangalore
          </p>
        </div>
      </div>
    </footer>
  )
}
