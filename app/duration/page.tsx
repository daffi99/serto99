"use client"

import type React from "react"
import { useState, useRef, useMemo } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Upload,
  Copy,
  Check,
  RotateCcw,
  Clock,
  FileAudio,
  FileVideo,
  X,
  Sparkles,
  Layers,
  History,
  User,
  ArrowLeft,
  Download,
  AlertCircle,
  List,
  FileSpreadsheet,
  Layers2,
  Film,
  CheckCircle2,
  SlidersHorizontal,
} from "lucide-react"

interface ExtractedItem {
  id: string
  file: File
  name: string
  size: number
  type: string
  seconds: number
  formatted: string
}

interface FileGroup {
  id: string
  title: string
  prefix: string
  startPart?: string
  endPart?: string
  items: ExtractedItem[]
  totalSeconds: number
  totalFormatted: string
}

type GroupingMode = "auto" | "prefix" | "flat"

// Parse filename into prefix and sequence number
function parseFilenameParts(filename: string): { prefix: string; seqNum: number | null; seqStr: string | null } {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "")

  // Pattern: "VO_French_092_030" or "EP01_Part02" or "Video_01"
  const trailingNumMatch = nameWithoutExt.match(/^(.*?)(?:[_\-\s]+(?:part|p|ep|eps|seq)?[_\-\s]*|\s*[\(\[])(\d+)[\)\]]?$/i)
  if (trailingNumMatch) {
    const prefix = trailingNumMatch[1].replace(/[_\-\s]+$/, "")
    const seqStr = trailingNumMatch[2]
    const seqNum = parseInt(seqStr, 10)
    return { prefix: prefix || "Files", seqNum, seqStr }
  }

  // Fallback: any trailing digits
  const anyDigitsMatch = nameWithoutExt.match(/^(.*?)(\d+)$/)
  if (anyDigitsMatch) {
    const prefix = anyDigitsMatch[1].replace(/[_\-\s]+$/, "")
    const seqStr = anyDigitsMatch[2]
    const seqNum = parseInt(seqStr, 10)
    return { prefix: prefix || "Files", seqNum, seqStr }
  }

  return { prefix: nameWithoutExt, seqNum: null, seqStr: null }
}

export default function DurationPage() {
  const [files, setFiles] = useState<File[]>([])
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentProcessingFile, setCurrentProcessingFile] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  
  // View & Grouping state
  const [activeTab, setActiveTab] = useState<"grouped" | "raw" | "table">("grouped")
  const [groupingMode, setGroupingMode] = useState<GroupingMode>("auto")
  
  // Feedback copy state
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Format seconds to H:MM:SS
  const formatDuration = (seconds: number): string => {
    const s = Math.round(seconds)
    const hours = Math.floor(s / 3600)
    const minutes = Math.floor((s % 3600) / 60)
    const secs = Math.floor(s % 60)
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  // Format file size
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  // Fast WAV binary extraction
  const extractWAVDuration = (arrayBuffer: ArrayBuffer): number => {
    const view = new DataView(arrayBuffer)
    let offset = 12 // Skip RIFF header
    let byteRate = 0
    let dataSize = 0

    const maxScanOffset = Math.min(100000, arrayBuffer.byteLength)

    while (offset + 8 <= maxScanOffset) {
      const chunkId = String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3),
      )
      const chunkSize = view.getUint32(offset + 4, true)

      if (chunkId === "fmt ") {
        byteRate = view.getUint32(offset + 8 + 8, true)
      } else if (chunkId === "data") {
        dataSize = chunkSize
        break
      }

      offset += 8 + chunkSize
      if (offset > maxScanOffset) break
    }

    return byteRate > 0 ? dataSize / byteRate : 0
  }

  // Native media element extraction
  const extractMediaElementDuration = (file: File, isVideo: boolean): Promise<number> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const el = isVideo ? document.createElement("video") : document.createElement("audio")
      el.preload = "metadata"

      const timeout = setTimeout(() => {
        URL.revokeObjectURL(url)
        reject(new Error("Pemuatan metadata file timed out"))
      }, 15000)

      el.onloadedmetadata = () => {
        clearTimeout(timeout)
        URL.revokeObjectURL(url)
        const dur = el.duration
        if (isFinite(dur) && dur > 0) {
          resolve(dur)
        } else {
          reject(new Error("Tidak dapat membaca durasi file"))
        }
      }

      el.onerror = () => {
        clearTimeout(timeout)
        URL.revokeObjectURL(url)
        reject(new Error(`Gagal memuat file ${isVideo ? "video" : "audio"}`))
      }

      el.src = url
    })
  }

  // File dispatcher
  const extractDuration = async (file: File): Promise<number> => {
    const isWav = file.name.toLowerCase().endsWith(".wav") || file.type === "audio/wav"
    const isVideo =
      file.name.toLowerCase().endsWith(".mp4") ||
      file.name.toLowerCase().endsWith(".mov") ||
      file.name.toLowerCase().endsWith(".webm") ||
      file.name.toLowerCase().endsWith(".mkv") ||
      file.type.startsWith("video/")

    if (isWav) {
      try {
        const readSize = Math.min(1 * 1024 * 1024, file.size)
        const blob = file.slice(0, readSize)
        const arrayBuffer = await blob.arrayBuffer()
        const duration = extractWAVDuration(arrayBuffer)
        if (duration > 0) {
          return duration
        }
      } catch {
        // Fallback to HTML5 audio element
      }
      return extractMediaElementDuration(file, false)
    } else if (isVideo) {
      return extractMediaElementDuration(file, true)
    } else {
      return extractMediaElementDuration(file, false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length > 0) {
      selectedFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }))
      setFiles(selectedFiles)
      setExtractedItems([])
      setError(null)
    }
  }

  const handleDragDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const droppedFiles = Array.from(e.dataTransfer.files).filter((file) => {
      const name = file.name.toLowerCase()
      return (
        name.endsWith(".wav") ||
        name.endsWith(".mp4") ||
        name.endsWith(".mp3") ||
        name.endsWith(".m4a") ||
        name.endsWith(".mov") ||
        name.endsWith(".webm") ||
        name.endsWith(".mkv") ||
        file.type.startsWith("audio/") ||
        file.type.startsWith("video/")
      )
    })

    if (droppedFiles.length > 0) {
      droppedFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }))
      setFiles(droppedFiles)
      setExtractedItems([])
      setError(null)
    }
  }

  const handleRemoveFile = (indexToRemove: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove))
    setExtractedItems((prev) => prev.filter((_, idx) => idx !== indexToRemove))
  }

  const handleExtractDurations = async () => {
    if (files.length === 0) return

    setLoading(true)
    setProgress(0)
    setError(null)

    const results: ExtractedItem[] = []

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setCurrentProcessingFile(file.name)
        const seconds = await extractDuration(file)
        results.push({
          id: `${file.name}-${file.size}-${i}`,
          file,
          name: file.name,
          size: file.size,
          type: file.name.split(".").pop()?.toUpperCase() || "FILE",
          seconds,
          formatted: formatDuration(seconds),
        })
        setProgress(Math.round(((i + 1) / files.length) * 100))
      }
      setExtractedItems(results)
    } catch (err) {
      console.error("Error extracting durations:", err)
      setError("Terjadi kesalahan saat mengekstrak durasi. Pastikan file media valid dan dapat diputar.")
    } finally {
      setLoading(false)
      setCurrentProcessingFile("")
    }
  }

  const calculateTotalDuration = (): number => {
    return extractedItems.reduce((acc, curr) => acc + curr.seconds, 0)
  }

  const calculateAverageDuration = (): number => {
    if (extractedItems.length === 0) return 0
    return calculateTotalDuration() / extractedItems.length
  }

  const calculateTotalSize = (): number => {
    return files.reduce((acc, curr) => acc + curr.size, 0)
  }

  // Smart Grouping Calculation
  const fileGroups = useMemo<FileGroup[]>(() => {
    if (extractedItems.length === 0) return []

    if (groupingMode === "flat") {
      const totalSecs = extractedItems.reduce((acc, it) => acc + it.seconds, 0)
      return [
        {
          id: "all",
          title: "All Files",
          prefix: "All",
          items: extractedItems,
          totalSeconds: totalSecs,
          totalFormatted: formatDuration(totalSecs),
        },
      ]
    }

    const groups: FileGroup[] = []
    let currentGroup: FileGroup | null = null
    let prevSeqNum: number | null = null

    for (let i = 0; i < extractedItems.length; i++) {
      const item = extractedItems[i]
      const { prefix, seqNum, seqStr } = parseFilenameParts(item.name)

      let isNewGroup = false
      if (!currentGroup) {
        isNewGroup = true
      } else if (currentGroup.prefix !== prefix) {
        isNewGroup = true
      } else if (groupingMode === "auto" && seqNum !== null && prevSeqNum !== null && seqNum !== prevSeqNum + 1) {
        // Sequence gap detected (e.g. 030 -> 046)
        isNewGroup = true
      }

      if (isNewGroup) {
        if (currentGroup) {
          finalizeGroup(currentGroup)
          groups.push(currentGroup)
        }
        currentGroup = {
          id: `group-${groups.length}-${prefix}-${seqNum || i}`,
          title: prefix,
          prefix,
          startPart: seqStr || undefined,
          endPart: seqStr || undefined,
          items: [item],
          totalSeconds: item.seconds,
          totalFormatted: formatDuration(item.seconds),
        }
      } else if (currentGroup) {
        currentGroup.items.push(item)
        currentGroup.totalSeconds += item.seconds
        if (seqStr) {
          currentGroup.endPart = seqStr
        }
      }

      prevSeqNum = seqNum
    }

    if (currentGroup) {
      finalizeGroup(currentGroup)
      groups.push(currentGroup)
    }

    return groups
  }, [extractedItems, groupingMode])

  function finalizeGroup(group: FileGroup) {
    group.totalFormatted = formatDuration(group.totalSeconds)
    if (group.startPart && group.endPart) {
      if (group.startPart === group.endPart) {
        group.title = `${group.prefix} (Part ${group.startPart})`
      } else {
        group.title = `${group.prefix} (Part ${group.startPart} - ${group.endPart})`
      }
    } else {
      group.title = group.prefix || "Batch"
    }
  }

  // Copy helper
  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    })
  }

  // Copy single group timings
  const handleCopyGroup = (group: FileGroup, withNames: boolean = false) => {
    let text = ""
    if (withNames) {
      text = group.items.map((it) => `${it.name}\t${it.formatted}`).join("\n")
      handleCopyText(text, `${group.id}-names`)
    } else {
      text = group.items.map((it) => it.formatted).join("\n")
      handleCopyText(text, `${group.id}-only`)
    }
  }

  // Copy All Timings (Flat continuous lines)
  const handleCopyAllFlat = () => {
    const text = extractedItems.map((it) => it.formatted).join("\n")
    handleCopyText(text, "all-flat")
  }

  // Copy All Timings with Group Headers
  const handleCopyAllGrouped = () => {
    const blocks = fileGroups.map((g) => {
      const header = `[${g.title}] - Total: ${g.totalFormatted}`
      const lines = g.items.map((it) => it.formatted).join("\n")
      return `${header}\n${lines}`
    })
    handleCopyText(blocks.join("\n\n"), "all-grouped")
  }

  const handleDownloadTxt = () => {
    const header = `# Duration Extractor Report\n# Total Files: ${extractedItems.length}\n# Total Duration: ${formatDuration(calculateTotalDuration())}\n# Total Groups: ${fileGroups.length}\n\n`
    const groupContent = fileGroups
      .map((g) => {
        const title = `=== ${g.title} (${g.items.length} files, Subtotal: ${g.totalFormatted}) ===`
        const list = g.items.map((it) => `${it.formatted}\t${it.name}`).join("\n")
        return `${title}\n${list}`
      })
      .join("\n\n")

    const blob = new Blob([header + groupContent], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "durations_report.txt"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleReset = () => {
    setFiles([])
    setExtractedItems([])
    setProgress(0)
    setError(null)
    setCopiedKey(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="min-h-screen bg-[#f3f6fc] text-slate-900 p-4 sm:p-6 lg:p-8 flex gap-6">
      {/* ============================================================ */}
      {/* 1. LEFT SIDEBAR */}
      {/* ============================================================ */}
      <aside className="w-64 rounded-3xl bg-white p-5 flex flex-col justify-between border border-slate-100 shadow-sm shrink-0 hidden md:flex min-h-[calc(100vh-4rem)]">
        <div className="space-y-6">
          {/* Top Logo */}
          <Link href="/" className="flex items-center gap-3 px-2 group">
            <img
              src="/logo_serto_1.png"
              alt="Translatoo Logo"
              className="h-9 w-auto max-w-[120px] object-contain transition-transform group-hover:scale-105"
              style={{ maxHeight: "36px" }}
            />
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight text-slate-900 leading-tight">
                Translatoo
              </span>
              <span className="text-[10px] text-slate-500 font-medium leading-tight">
                AI Subtitle Suite
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="space-y-1.5 pt-2">
            <Link
              href="/"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            >
              <Sparkles className="w-4 h-4 text-slate-400" />
              <span>New workflow</span>
            </Link>

            <div className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all bg-blue-50/90 text-blue-600 shadow-xs">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Duration Extractor</span>
            </div>

            <Link
              href="/?view=others"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            >
              <Layers className="w-4 h-4 text-slate-400" />
              <span>Other tools</span>
            </Link>

            <Link
              href="/?view=history"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            >
              <History className="w-4 h-4 text-slate-400" />
              <span>History</span>
            </Link>
          </nav>
        </div>

        {/* Bottom Workspace Widget */}
        <div className="space-y-3 pt-6 border-t border-slate-100">
          <div className="p-3 bg-slate-50 rounded-2xl flex items-center gap-3 border border-slate-100/80">
            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
              <User className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-xs text-slate-800 truncate">Your workspace</span>
              <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Smart Grouping Active
              </span>
            </div>
          </div>

          <button
            onClick={handleReset}
            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100/80 text-xs font-semibold transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset file list</span>
          </button>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* 2. MAIN CONTENT AREA */}
      {/* ============================================================ */}
      <div className="flex-1 flex flex-col gap-5 min-w-0">
        {/* Top Breadcrumbs & Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold tracking-wider text-blue-600 uppercase">
                WORKSPACE / DURATION EXTRACTOR
              </p>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-semibold py-0">
                Group By Episodes
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Audio & Video Duration Extractor
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Hitung durasi batch dan pisahkan otomatis berdasarkan episode / lonjakan part agar gampang di-copy.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/">
              <Button
                variant="outline"
                size="sm"
                className="bg-white rounded-xl border-slate-200 text-xs font-semibold gap-1.5 shadow-2xs hover:bg-slate-50 text-slate-700"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Workflow</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
            <div>
              <p className="font-bold">Terjadi Kesalahan</p>
              <p className="text-xs text-rose-700">{error}</p>
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: Upload & File Selection (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Upload Card */}
            <div className="rounded-3xl bg-white p-6 border border-slate-100 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Upload className="w-5 h-5 text-blue-600" />
                    Upload Media Files
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pilih file WAV atau MP4 (bisa multi episode sekaligus).
                  </p>
                </div>
                {files.length > 0 && (
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700 font-bold text-xs">
                    {files.length} file
                  </Badge>
                )}
              </div>

              {/* Drag & Drop Area */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDragDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 bg-slate-50/50 transition-all rounded-2xl p-6 flex flex-col items-center justify-center gap-2.5 cursor-pointer text-center group"
              >
                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform">
                  <Upload className="w-6 h-6 text-blue-600" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs sm:text-sm font-bold text-slate-800">
                    Tarik file ke sini, atau <span className="text-blue-600 underline underline-offset-2">pilih file</span>
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium">
                    WAV, MP4, MP3, M4A, dll.
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".wav,.mp4,.mp3,.m4a,.mov,.webm,.mkv,audio/*,video/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-1 bg-white rounded-xl border-slate-200 text-slate-700 text-xs font-semibold shadow-2xs hover:bg-slate-50"
                  onClick={(e) => {
                    e.stopPropagation()
                    fileInputRef.current?.click()
                  }}
                >
                  Browse Files
                </Button>
              </div>

              {/* Selected Files List */}
              {files.length > 0 && (
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      File Dipilih ({files.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      Hapus Semua
                    </button>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-50">
                    {files.map((file, idx) => {
                      const isWav = file.name.toLowerCase().endsWith(".wav")
                      const isVideo = file.name.toLowerCase().endsWith(".mp4") || file.type.startsWith("video/")
                      const extracted = extractedItems[idx]

                      return (
                        <div
                          key={idx}
                          className="pt-1.5 first:pt-0 flex items-center justify-between gap-2.5 text-xs bg-slate-50/80 hover:bg-slate-100 p-2 rounded-xl border border-slate-100 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                                isVideo
                                  ? "bg-purple-100 text-purple-600"
                                  : isWav
                                  ? "bg-amber-100 text-amber-600"
                                  : "bg-blue-100 text-blue-600"
                              }`}
                            >
                              {isVideo ? <FileVideo className="w-3.5 h-3.5" /> : <FileAudio className="w-3.5 h-3.5" />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 truncate text-[11px]">{file.name}</p>
                              <p className="text-[9px] text-slate-400 font-medium">
                                {formatBytes(file.size)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {extracted ? (
                              <span className="font-mono font-bold text-[11px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                {extracted.formatted}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium italic">Siap</span>
                            )}
                            <button
                              onClick={() => handleRemoveFile(idx)}
                              disabled={loading}
                              className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors"
                              title="Hapus file"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Extract Action Button */}
              {files.length > 0 && (
                <div className="space-y-3 pt-1">
                  <Button
                    onClick={handleExtractDurations}
                    disabled={loading}
                    className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-sm text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Clock className="w-4 h-4 animate-spin" />
                        <span>Mengekstrak Durasi... ({progress}%)</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4" />
                        <span>Ekstrak Durasi ({files.length} File)</span>
                      </>
                    )}
                  </Button>

                  {loading && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold text-slate-600">
                        <span className="truncate max-w-[220px]">
                          Memproses: <span className="text-blue-600">{currentProcessingFile}</span>
                        </span>
                        <span>{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-2 rounded-full" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Grouped Results & Super Easy Copy (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {extractedItems.length > 0 ? (
              <div className="space-y-5">
                {/* Grand Total Duration Banner */}
                <div className="rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 p-5 sm:p-6 text-white shadow-md space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider font-semibold text-blue-100 flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      Grand Total Durasi
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Badge className="bg-white/20 hover:bg-white/25 text-white border-0 text-[10px]">
                        {extractedItems.length} File
                      </Badge>
                      <Badge className="bg-emerald-500/80 text-white border-0 text-[10px] font-bold">
                        {fileGroups.length} Grup Episode
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                    <div className="text-3xl sm:text-4xl font-extrabold tracking-tight font-mono">
                      {formatDuration(calculateTotalDuration())}
                    </div>
                    <div className="text-xs text-blue-100 flex items-center gap-3">
                      <span>Rata-rata: {formatDuration(calculateAverageDuration())}</span>
                      <span>•</span>
                      <span>Total: {formatBytes(calculateTotalSize())}</span>
                    </div>
                  </div>

                  {/* Top Fast Action Buttons */}
                  <div className="pt-2 border-t border-white/15 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleCopyAllFlat}
                      className="bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs h-8 px-3 rounded-xl shadow-xs gap-1.5 cursor-pointer"
                    >
                      {copiedKey === "all-flat" ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Copied All ({extractedItems.length} baris)!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-blue-600" />
                          <span>Copy Semua (Flat Lines)</span>
                        </>
                      )}
                    </Button>

                    <Button
                      size="sm"
                      onClick={handleCopyAllGrouped}
                      className="bg-blue-800/80 hover:bg-blue-800 text-white font-semibold text-xs h-8 px-3 rounded-xl gap-1.5 cursor-pointer border border-white/20"
                    >
                      {copiedKey === "all-grouped" ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied with Headers!</span>
                        </>
                      ) : (
                        <>
                          <Layers2 className="w-3.5 h-3.5" />
                          <span>Copy dengan Header Grup</span>
                        </>
                      )}
                    </Button>

                    <Button
                      size="sm"
                      onClick={handleDownloadTxt}
                      className="bg-white/10 hover:bg-white/20 text-white font-semibold text-xs h-8 px-3 rounded-xl gap-1.5 cursor-pointer ml-auto"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>.txt Report</span>
                    </Button>
                  </div>
                </div>

                {/* View Switcher & Grouping Settings Bar */}
                <div className="rounded-2xl bg-white p-3 border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* View Tabs */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => setActiveTab("grouped")}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        activeTab === "grouped"
                          ? "bg-white text-blue-600 shadow-xs font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Layers2 className="w-3.5 h-3.5" />
                      Group by Episode ({fileGroups.length})
                    </button>
                    <button
                      onClick={() => setActiveTab("raw")}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        activeTab === "raw"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <List className="w-3.5 h-3.5" />
                      All in 1 Text Box
                    </button>
                    <button
                      onClick={() => setActiveTab("table")}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        activeTab === "table"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      Table View
                    </button>
                  </div>

                  {/* Grouping Mode Dropdown */}
                  {activeTab === "grouped" && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
                        <SlidersHorizontal className="w-3 h-3 text-slate-400" />
                        Mode Pisah:
                      </span>
                      <select
                        value={groupingMode}
                        onChange={(e) => setGroupingMode(e.target.value as GroupingMode)}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                      >
                        <option value="auto">Auto (Episode & Lonjakan Part)</option>
                        <option value="prefix">Berdasarkan Episode/Prefix Saja</option>
                        <option value="flat">Gabung Semua (Tanpa Pisah)</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* ============================================================ */}
                {/* TAB 1: GROUPED BY EPISODE (Super Easy 1-Click Copy per Box) */}
                {/* ============================================================ */}
                {activeTab === "grouped" && (
                  <div className="space-y-4">
                    {fileGroups.map((group, gIdx) => {
                      const groupTimingsText = group.items.map((it) => it.formatted).join("\n")
                      const isCopiedOnly = copiedKey === `${group.id}-only`
                      const isCopiedNames = copiedKey === `${group.id}-names`

                      return (
                        <div
                          key={group.id}
                          className="rounded-3xl bg-white p-5 border border-slate-200/90 shadow-sm space-y-3 hover:border-blue-200 transition-colors"
                        >
                          {/* Group Card Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                                  <Film className="w-4 h-4 text-blue-600 shrink-0" />
                                  {group.title}
                                </span>
                                <Badge
                                  variant="secondary"
                                  className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold"
                                >
                                  {group.items.length} file
                                </Badge>
                              </div>
                              <p className="text-xs text-slate-500 font-medium">
                                Subtotal Durasi:{" "}
                                <span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                  {group.totalFormatted}
                                </span>
                              </p>
                            </div>

                            {/* Group 1-Click Copy Buttons */}
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                size="sm"
                                onClick={() => handleCopyGroup(group, false)}
                                className={`font-bold text-xs h-8 px-3 rounded-xl shadow-xs gap-1.5 transition-all cursor-pointer ${
                                  isCopiedOnly
                                    ? "bg-emerald-600 text-white"
                                    : "bg-blue-600 hover:bg-blue-700 text-white"
                                }`}
                              >
                                {isCopiedOnly ? (
                                  <>
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Tercopy ({group.items.length} baris)!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copy Episode Ini</span>
                                  </>
                                )}
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCopyGroup(group, true)}
                                className={`font-semibold text-xs h-8 px-2.5 rounded-xl shadow-2xs gap-1 transition-all cursor-pointer ${
                                  isCopiedNames
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                    : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                                }`}
                                title="Copy timing beserta nama file"
                              >
                                {isCopiedNames ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                                    <span>+ Nama</span>
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>

                          {/* Group Timing Textarea (Click to Select All) */}
                          <div className="relative group">
                            <textarea
                              readOnly
                              rows={Math.min(Math.max(group.items.length, 3), 7)}
                              value={groupTimingsText}
                              onClick={(e) => e.currentTarget.select()}
                              className="w-full bg-slate-50/80 hover:bg-slate-50 border border-slate-200/80 rounded-2xl p-3 font-mono text-xs text-slate-800 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer transition-colors shadow-inner"
                              title="Klik di sini untuk langsung SELECT ALL"
                            />
                            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5 px-1">
                              <span className="italic">
                                💡 Klik dalam kotak untuk otomatis <b>Select All</b> baris di atas
                              </span>
                              <span>{group.items.length} baris timing</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* ============================================================ */}
                {/* TAB 2: RAW TEXT BOX (All in One) */}
                {/* ============================================================ */}
                {activeTab === "raw" && (
                  <div className="rounded-3xl bg-white p-6 border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">Semua Durasi dalam Satu Box</h4>
                        <p className="text-xs text-slate-500">Format satu baris per timing (H:MM:SS).</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={handleCopyAllFlat}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-8 px-3 rounded-xl gap-1.5"
                      >
                        {copiedKey === "all-flat" ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Semua</span>
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <textarea
                        readOnly
                        rows={12}
                        value={extractedItems.map((it) => it.formatted).join("\n")}
                        onClick={(e) => e.currentTarget.select()}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-mono text-xs text-slate-800 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer shadow-inner"
                        title="Klik untuk select all"
                      />
                      <p className="text-[11px] text-slate-400 italic">
                        💡 Klik kotak untuk langsung menyeleksi seluruh teks ({extractedItems.length} baris).
                      </p>
                    </div>
                  </div>
                )}

                {/* ============================================================ */}
                {/* TAB 3: TABLE VIEW */}
                {/* ============================================================ */}
                {activeTab === "table" && (
                  <div className="rounded-3xl bg-white p-6 border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-slate-900">Detail File & Durasi</h4>
                      <span className="text-xs text-slate-500">{extractedItems.length} total file</span>
                    </div>

                    <div className="bg-slate-50 rounded-2xl border border-slate-200 max-h-96 overflow-y-auto divide-y divide-slate-100">
                      {extractedItems.map((item, idx) => (
                        <div key={item.id} className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-100/70 transition-colors">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-[10px] font-mono font-bold text-slate-400 w-6 shrink-0">
                              #{idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 truncate">{item.name}</p>
                              <p className="text-[10px] text-slate-400 font-medium">{formatBytes(item.size)}</p>
                            </div>
                          </div>
                          <span className="font-mono font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md shrink-0">
                            {item.formatted}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Empty State Placeholder */
              <div className="rounded-3xl bg-white p-8 border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center space-y-3 min-h-[380px]">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
                  <Clock className="w-8 h-8" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h4 className="font-bold text-sm sm:text-base text-slate-800">
                    Hasil Durasi & Group Episode
                  </h4>
                  <p className="text-xs text-slate-500">
                    Pilih file audio/video di sebelah kiri dan klik <b>Ekstrak Durasi</b>. Hasil akan otomatis dipisahkan per episode lengkap dengan tombol 1-Click Copy.
                  </p>
                </div>
                <div className="pt-2 flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Otomatis mendeteksi lompatan part / beda episode
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
