"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export default function Navbar() {
  const pathname = usePathname()

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-center space-x-8 overflow-x-auto">
        <Link href="/" className="flex items-center space-x-2 shrink-0">
          <img src="/logo_serto_1.png" alt="Logo" className="h-8 w-auto object-contain" />
          <span className="font-bold">SRT Tools</span>
        </Link>
        <nav className="flex items-center space-x-6 text-sm font-medium shrink-0">
          <Link
            href="/"
            className={cn(
              "transition-colors hover:text-foreground/80",
              pathname === "/" ? "text-foreground" : "text-foreground/60",
            )}
          >
            SRT Joiner
          </Link>
          <Link
            href="/arabic"
            className={cn(
              "transition-colors hover:text-foreground/80",
              pathname === "/arabic" ? "text-foreground" : "text-foreground/60",
            )}
          >
            Arabic Translator
          </Link>
          <Link
            href="/joiner-translated"
            className={cn(
              "transition-colors hover:text-foreground/80",
              pathname === "/joiner-translated" ? "text-foreground" : "text-foreground/60",
            )}
          >
            Joiner Translated
          </Link>
          <Link
            href="/srt-lb-insert"
            className={cn(
              "transition-colors hover:text-foreground/80",
              pathname === "/srt-lb-insert" ? "text-foreground" : "text-foreground/60",
            )}
          >
            SRT LB Insert
          </Link>
        </nav>
      </div>
    </nav>
  )
}
