"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import {
  ChevronDown,
  Languages,
  Layers,
  BookOpen,
  Split,
  FileCode,
} from "lucide-react"

export default function Navbar() {
  const pathname = usePathname()

  const otherPages = [
    {
      href: "/srt-translate",
      label: "SRT Translate (AI)",
      desc: "Terjemahan SRT batch mandiri",
      icon: Languages,
    },
    {
      href: "/srt-joiner",
      label: "SRT Joiner",
      desc: "Gabung beberapa file SRT + WAV offset",
      icon: Layers,
    },
    {
      href: "/arabic",
      label: "Arabic Translator",
      desc: "Transliterasi Arab ALA-LC",
      icon: BookOpen,
    },
    {
      href: "/joiner-translated",
      label: "Joiner Translated",
      desc: "Kombinasi SRT asli & hasil translate",
      icon: Split,
    },
    {
      href: "/srt-lb-insert",
      label: "SRT LB Insert",
      desc: "Perbaiki baris pemisah SRT yang rusak",
      icon: FileCode,
    },
  ]

  const isOtherActive = otherPages.some((p) => pathname === p.href)

  if (pathname === "/" || pathname === "/workflow") {
    return null
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Logo & Brand */}
        <Link href="/" className="flex items-center gap-3 shrink-0 group">
          <img
            src="/logo_serto_1.png"
            alt="Translatoo Logo"
            className="h-8 w-auto max-w-[120px] object-contain transition-transform group-hover:scale-105"
            style={{ maxHeight: "32px" }}
          />
          <div className="flex flex-col">
            <span className="font-bold text-base tracking-tight text-slate-900 leading-none">
              Translatoo
            </span>
            <span className="text-[10px] text-slate-500 font-medium leading-tight">
              AI Subtitle Suite
            </span>
          </div>
        </Link>

        {/* Navigation Items */}
        <nav className="flex items-center gap-2">
          {/* Others Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={isOtherActive ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "gap-1.5 text-xs sm:text-sm font-medium border border-transparent",
                  isOtherActive
                    ? "bg-slate-100 text-slate-900 border-slate-200 font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
                )}
              >
                <span>Others</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-1.5 shadow-lg border-slate-200">
              <DropdownMenuLabel className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-2 py-1">
                Tools & Halaman Lainnya
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {otherPages.map((item) => {
                const IconComponent = item.icon
                const isActive = pathname === item.href
                return (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-start gap-2.5 px-2.5 py-2 rounded-md cursor-pointer transition-colors",
                        isActive
                          ? "bg-slate-100 text-slate-900 font-semibold"
                          : "hover:bg-slate-50 text-slate-700",
                      )}
                    >
                      <IconComponent className={cn("w-4 h-4 mt-0.5 shrink-0", isActive ? "text-blue-600" : "text-slate-400")} />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium leading-none">{item.label}</span>
                        <span className="text-[10px] text-slate-500 font-normal leading-tight">
                          {item.desc}
                        </span>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </div>
    </header>
  )
}
