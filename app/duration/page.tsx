"use client"

import type React from "react"
import { useState, useRef } from "react"
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

export default function DurationPage() {
  const [files, setFiles] = useState<File[]>([])
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentProcessingFile, setCurrentProcessingFile] = useState<string>("")
  const [copiedOnly, setCopiedOnly] = useState(false)
  const [copiedWithNames, setCopiedWithNames] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"list" | "table">("list")
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
      // Natural sort by filename
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

  const handleCopyToClipboard = (withNames: boolean = false) => {
    let text = ""
    if (withNames) {
      text = extractedItems.map((item) => `${item.name}\t${item.formatted}`).join("\n")
      setCopiedWithNames(true)
      setTimeout(() => setCopiedWithNames(false), 2000)
    } else {
      text = extractedItems.map((item) => item.formatted).join("\n")
      setCopiedOnly(true)
      setTimeout(() => setCopiedOnly(false), 2000)
    }
    navigator.clipboard.writeText(text)
  }

  const handleDownloadTxt = () => {
    const header = `# Duration Extractor Report\n# Total Files: ${extractedItems.length}\n# Total Duration: ${formatDuration(calculateTotalDuration())}\n\n`
    const content = header + extractedItems.map((item) => `${item.formatted}\t${item.name}`).join("\n")
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
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
    setCopiedOnly(false)
    setCopiedWithNames(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="min-h-screen bg-[#f3f6fc] text-slate-900 p-4 sm:p-6 lg:p-8 flex gap-6">
      {/* ============================================================ */}
      {/* 1. LEFT SIDEBAR (Consistent with Main Translatoo Dashboard) */}
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
                Light Mode Active
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
                Light Mode
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Audio & Video Duration Extractor
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Hitung dan ekstrak durasi file WAV, MP4, MP3, atau media lainnya secara batch dengan cepat dan akurat.
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
          {/* LEFT COLUMN: Upload & File Selection (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Upload Card */}
            <div className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-100 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Upload className="w-5 h-5 text-blue-600" />
                    Upload Media Files
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pilih atau drag & drop file WAV atau MP4 yang ingin dihitung durasinya.
                  </p>
                </div>
                {files.length > 0 && (
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700 font-bold text-xs">
                    {files.length} file dipilih
                  </Badge>
                )}
              </div>

              {/* Drag & Drop Area */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDragDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 bg-slate-50/50 transition-all rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer text-center group"
              >
                <div className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform">
                  <Upload className="w-7 h-7 text-blue-600" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-800">
                    Tarik file ke sini, atau <span className="text-blue-600 underline underline-offset-2">pilih file</span>
                  </p>
                  <p className="text-xs text-slate-400 font-medium">
                    Mendukung format WAV, MP4, MP3, M4A, MOV, dll. (Bisa pilih banyak file sekaligus)
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
                  className="mt-2 bg-white rounded-xl border-slate-200 text-slate-700 font-semibold shadow-2xs hover:bg-slate-50"
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
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Daftar File Terpilih ({files.length})
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

                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-50">
                    {files.map((file, idx) => {
                      const isWav = file.name.toLowerCase().endsWith(".wav")
                      const isVideo = file.name.toLowerCase().endsWith(".mp4") || file.type.startsWith("video/")
                      const extracted = extractedItems[idx]

                      return (
                        <div
                          key={idx}
                          className="pt-2 first:pt-0 flex items-center justify-between gap-3 text-xs bg-slate-50/70 hover:bg-slate-100/70 p-2.5 rounded-xl border border-slate-100 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                isVideo
                                  ? "bg-purple-100 text-purple-600"
                                  : isWav
                                  ? "bg-amber-100 text-amber-600"
                                  : "bg-blue-100 text-blue-600"
                              }`}
                            >
                              {isVideo ? <FileVideo className="w-4 h-4" /> : <FileAudio className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 truncate">{file.name}</p>
                              <p className="text-[10px] text-slate-400 font-medium">
                                {formatBytes(file.size)} • {file.name.split(".").pop()?.toUpperCase()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {extracted ? (
                              <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                                {extracted.formatted}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium italic">Siap</span>
                            )}
                            <button
                              onClick={() => handleRemoveFile(idx)}
                              disabled={loading}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition-colors"
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
                <div className="space-y-3 pt-2">
                  <Button
                    onClick={handleExtractDurations}
                    disabled={loading}
                    className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-sm text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
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
                        <span className="truncate max-w-[280px]">
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

          {/* RIGHT COLUMN: Results & Copy Panel (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {extractedItems.length > 0 ? (
              <div className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-100 shadow-sm space-y-5">
                {/* Total Duration Banner Card */}
                <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white shadow-md space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider font-semibold text-blue-100 flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      Total Durasi Keseluruhan
                    </span>
                    <Badge className="bg-white/20 hover:bg-white/25 text-white border-0 text-[10px]">
                      {extractedItems.length} File
                    </Badge>
                  </div>
                  <div className="text-3xl sm:text-4xl font-extrabold tracking-tight font-mono">
                    {formatDuration(calculateTotalDuration())}
                  </div>
                  <div className="pt-1 border-t border-white/15 flex items-center justify-between text-xs text-blue-100">
                    <span>Rata-rata: {formatDuration(calculateAverageDuration())}</span>
                    <span>Total Size: {formatBytes(calculateTotalSize())}</span>
                  </div>
                </div>

                {/* View Switcher Tabs */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => setActiveTab("list")}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        activeTab === "list"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <List className="w-3.5 h-3.5" />
                      Text Box
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

                  <span className="text-[11px] text-slate-400 font-medium">
                    {extractedItems.length} baris durasi
                  </span>
                </div>

                {/* Tab 1: Raw Text Box (Matching original daffi99/duration copy behavior) */}
                {activeTab === "list" ? (
                  <div className="space-y-2">
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 max-h-60 overflow-y-auto">
                      <pre className="text-slate-800 font-mono text-xs leading-relaxed whitespace-pre-wrap select-all">
                        {extractedItems.map((item) => item.formatted).join("\n")}
                      </pre>
                    </div>
                    <p className="text-[11px] text-slate-400 italic">
                      Format baris tunggal per durasi (H:MM:SS), langsung kompatibel untuk di-copy ke spreadsheet atau tool joiner.
                    </p>
                  </div>
                ) : (
                  /* Tab 2: Detailed Table View */
                  <div className="space-y-2">
                    <div className="bg-slate-50 rounded-2xl border border-slate-200 max-h-60 overflow-y-auto divide-y divide-slate-100">
                      {extractedItems.map((item) => (
                        <div key={item.id} className="p-2.5 flex items-center justify-between gap-2 text-xs">
                          <div className="min-w-0 pr-2">
                            <p className="font-semibold text-slate-800 truncate">{item.name}</p>
                            <p className="text-[10px] text-slate-400">{formatBytes(item.size)}</p>
                          </div>
                          <span className="font-mono font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md shrink-0">
                            {item.formatted}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => handleCopyToClipboard(false)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2.5 rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {copiedOnly ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Durations</span>
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={() => handleCopyToClipboard(true)}
                      variant="outline"
                      className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-semibold text-xs py-2.5 rounded-xl shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {copiedWithNames ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy + Names</span>
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={handleDownloadTxt}
                      variant="outline"
                      className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 font-semibold text-xs py-2 rounded-xl shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      <span>Download .txt</span>
                    </Button>

                    <Button
                      onClick={handleReset}
                      variant="outline"
                      className="bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 border-rose-200 font-semibold text-xs py-2 rounded-xl shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Semua</span>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              /* Empty State Placeholder */
              <div className="rounded-3xl bg-white p-8 border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center space-y-3 min-h-[320px]">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Clock className="w-7 h-7" />
                </div>
                <div className="space-y-1 max-w-xs">
                  <h4 className="font-bold text-sm text-slate-800">Hasil Durasi Akan Muncul Di Sini</h4>
                  <p className="text-xs text-slate-400">
                    Pilih file media di samping dan klik tombol <b>Ekstrak Durasi</b> untuk melihat total waktu dan daftar durasi.
                  </p>
                </div>
                <div className="pt-2 flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                  Ekstraksi lokal di browser tanpa upload ke server
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
