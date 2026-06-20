import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import Navbar from "@/components/navbar"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "SRT Tools",
  description: "Join SRT files and translate Arabic subtitles",
  generator: "v0.app",
  icons: {
    icon: "/logo_serto_1.png",
    shortcut: "/logo_serto_1.png",
    apple: "/logo_serto_1.png",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Navbar />
        {children}
      </body>
    </html>
  )
}
