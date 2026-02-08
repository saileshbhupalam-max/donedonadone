import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "donedonadone - Group Coworking in Bangalore",
  description:
    "Join small groups of 3-5 people to cowork together at curated cafes and coworking spaces in HSR Layout, Bangalore. Book a session, get matched, show up, get stuff done.",
  keywords: [
    "coworking",
    "group coworking",
    "bangalore",
    "hsr layout",
    "remote work",
    "freelancer",
    "cafe coworking",
  ],
  openGraph: {
    title: "donedonadone - Stop Working Alone",
    description:
      "Join small groups of 3-5 people to cowork at curated cafes in HSR Layout, Bangalore.",
    type: "website",
  },
}

export const viewport: Viewport = {
  themeColor: "#F59E0B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}
