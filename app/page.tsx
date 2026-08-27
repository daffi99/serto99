"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import JSZip from "jszip"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { parseSrt, formatSrt, adjustSrtTimestamps } from "@/lib/srt-utils"
import { getWavDuration } from "@/lib/audio-utils"
import {
  Sparkles,
  Layers,
  Upload,
  CheckCircle2,
  AlertCircle,
  Clock,
  Terminal,
  RefreshCw,
  Download,
  Trash2,
  Database,
  History,
  Archive,
  Eye,
  Search,
  FileText,
  Music,
  ArrowRight,
  Copy,
  ExternalLink,
  Workflow,
  X,
  FileUp,
  Sliders,
  Folder,
  Check,
  Languages,
  BookOpen,
  Split,
  FileCode,
  LogOut,
  User,
  Settings,
  MoreVertical,
  Activity,
  CloudUpload,
  Headphones,
} from "lucide-react"

interface SrtBlock {
  index: number
  startTime: string
  endTime: string
  text: string
}

interface TranslateItem {
  id: number
  text: string
}

interface LogEntry {
  id: string
  time: string
  message: string
  type: "info" | "success" | "warning" | "error" | "step"
}

interface HistoryItem {
  id: number
  title: string
  source_language: string
  target_language: string
  subtitles_count: number
  characters_count: number
  files_count: number
  created_at: string
  original_preview?: string
  translated_preview?: string
}

export default function HomePage() {
  // Navigation View: 'workflow' | 'history' | 'others'
  const [currentView, setCurrentView] = useState<"workflow" | "history" | "others">("workflow")
  const [workflowStep, setWorkflowStep] = useState<"config" | "running" | "completed">("config")

  // Form Inputs
  const [projectTitle, setProjectTitle] = useState<string>("")
  const [srtFiles, setSrtFiles] = useState<File[]>([])
  const [wavFiles, setWavFiles] = useState<File[]>([])
  const [sourceLanguage, setSourceLanguage] = useState<string>("auto")
  const [batchSize, setBatchSize] = useState<number>(100)

  // Drag & Drop State
  const [isDraggingSrt, setIsDraggingSrt] = useState<boolean>(false)
  const [isDraggingWav, setIsDraggingWav] = useState<boolean>(false)
  const srtInputRef = useRef<HTMLInputElement>(null)
  const wavInputRef = useRef<HTMLInputElement>(null)

  // Output State
  const [originalJoinedSrt, setOriginalJoinedSrt] = useState<string>("")
  const [translatedIndoSrt, setTranslatedIndoSrt] = useState<string>("")
  const [previewBlocks, setPreviewBlocks] = useState<{ original: SrtBlock; translated: SrtBlock }[]>([])
  const [savedDbId, setSavedDbId] = useState<number | null>(null)

  // Execution Progress & Logs
  const [loading, setLoading] = useState<boolean>(false)
  const [currentStage, setCurrentStage] = useState<
    "idle" | "joining" | "translating" | "reconstructing" | "saving" | "done"
  >("idle")
  const [overallProgress, setOverallProgress] = useState<number>(0)
  const [currentBatchIndex, setCurrentBatchIndex] = useState<number>(0)
  const [totalBatches, setTotalBatches] = useState<number>(0)
  const [batchSubStep, setBatchSubStep] = useState<string>("")
  const [activeModel, setActiveModel] = useState<string>("")

  // Stats
  const [totalSubtitlesCount, setTotalSubtitlesCount] = useState<number>(0)
  const [charactersUsed, setCharactersUsed] = useState<number>(0)
  const [requestsMade, setRequestsMade] = useState<number>(0)

  // Alerts & Logs
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const terminalEndRef = useRef<HTMLDivElement>(null)

  // History State
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false)
  const [dbConfigured, setDbConfigured] = useState<boolean>(true)
  const [searchQuery, setSearchQuery] = useState<string>("")

  // Preview Modal
  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false)
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null)
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false)

  const languageMap: { [key: string]: string } = {
    auto: "Auto Detect",
    german: "German",
    english: "English",
    french: "French",
    spanish: "Spanish",
    portuguese: "Portuguese",
    italian: "Italian",
    arabic: "Arabic",
    japanese: "Japanese",
    korean: "Korean",
    chinese: "Chinese",
    russian: "Russian",
    dutch: "Dutch",
  }

  const addLog = (message: string, type: LogEntry["type"] = "info") => {
    const time = new Date().toLocaleTimeString("id-ID", { hour12: false })
    setLogs((prev) => [
      ...prev,
      { id: Math.random().toString(36).substring(2, 9), time, message, type },
    ])
  }

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [logs])

  // Fetch history from DB
  const fetchHistory = async () => {
    setLoadingHistory(true)
    try {
      const res = await fetch("/api/subtitles")
      const data = await res.json()
      setDbConfigured(data.configured)
      if (data.items) {
        setHistoryItems(data.items)
      }
    } catch (err) {
      console.error("Failed to fetch history:", err)
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  // Process selected SRT files
  const processSrtFiles = (newFiles: File[]) => {
    const validSrts = newFiles.filter((f) => f.name.toLowerCase().endsWith(".srt"))
    if (validSrts.length === 0) return

    setSrtFiles((prev) => {
      const combined = [...prev, ...validSrts]
      if (!projectTitle && combined.length > 0) {
        const cleanName = combined[0].name.replace(/\.srt$/i, "").replace(/[-_]part\d+/i, "")
        setProjectTitle(cleanName)
      }
      addLog(`Menambahkan ${validSrts.length} file SRT: ${validSrts.map((f) => f.name).join(", ")}`, "info")
      return combined
    })
  }

  // Process selected WAV files
  const processWavFiles = (newFiles: File[]) => {
    const validWavs = newFiles.filter((f) => f.name.toLowerCase().endsWith(".wav"))
    if (validWavs.length === 0) return

    setWavFiles((prev) => {
      const combined = [...prev, ...validWavs]
      addLog(`Menambahkan ${validWavs.length} file WAV audio: ${validWavs.map((f) => f.name).join(", ")}`, "info")
      return combined
    })
  }

  // Robust Drag & Drop Handlers for SRT
  const handleSrtDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingSrt(true)
  }

  const handleSrtDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingSrt(true)
  }

  const handleSrtDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingSrt(false)
  }

  const handleSrtDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingSrt(false)
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processSrtFiles(Array.from(e.dataTransfer.files))
    }
  }

  // Robust Drag & Drop Handlers for WAV
  const handleWavDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingWav(true)
  }

  const handleWavDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingWav(true)
  }

  const handleWavDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingWav(false)
  }

  const handleWavDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingWav(false)
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processWavFiles(Array.from(e.dataTransfer.files))
    }
  }

  const removeSrtFile = (index: number) => {
    setSrtFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const removeWavFile = (index: number) => {
    setWavFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleResetForm = () => {
    setProjectTitle("")
    setSrtFiles([])
    setWavFiles([])
    setOriginalJoinedSrt("")
    setTranslatedIndoSrt("")
    setPreviewBlocks([])
    setSavedDbId(null)
    setLoading(false)
    setError(null)
    setSuccessMessage(null)
    setCurrentStage("idle")
    setOverallProgress(0)
    setCurrentBatchIndex(0)
    setTotalBatches(0)
    setBatchSubStep("")
    setLogs([])
    setWorkflowStep("config")
    if (srtInputRef.current) srtInputRef.current.value = ""
    if (wavInputRef.current) wavInputRef.current.value = ""
  }

  // API Call Batch Translate with retry
  const translateBatchWithRetry = async (
    items: TranslateItem[],
    batchNum: number,
    totalNum: number,
    maxRetries = 3,
  ): Promise<{ translatedItems: TranslateItem[]; model?: string }> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        setBatchSubStep(`[Batch ${batchNum}/${totalNum}] Mengirim ${items.length} baris ke Gemini AI...`)
        addLog(`[Batch ${batchNum}/${totalNum}] Mengirim request ke Gemini (${items.length} item subtitle)...`, "step")

        const response = await fetch("/api/translate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            items,
            sourceLanguage: languageMap[sourceLanguage] || sourceLanguage,
            targetLanguage: "Indonesian",
          }),
        })

        const data = await response.json()

        if (response.status === 429) {
          const waitTime = attempt * 3000
          addLog(
            `[Batch ${batchNum}] Rate limit (429) terdeteksi. Menunggu ${waitTime / 1000}s sebelum retry (Percobaan ${attempt}/${maxRetries})...`,
            "warning",
          )
          setBatchSubStep(`[Batch ${batchNum}] Kena rate limit. Menunggu ${waitTime / 1000}s (Retry ${attempt})...`)
          await new Promise((resolve) => setTimeout(resolve, waitTime))
          continue
        }

        if (!response.ok || data.error) {
          throw new Error(data.error || `HTTP error ${response.status}`)
        }

        if (!data.translatedItems || !Array.isArray(data.translatedItems)) {
          throw new Error("Respon dari Gemini tidak berisi array translatedItems yang valid")
        }

        if (data.model) {
          setActiveModel(data.model)
        }

        return data
      } catch (err: any) {
        if (attempt === maxRetries) {
          throw err
        }
        const waitTime = attempt * 2500
        addLog(
          `[Batch ${batchNum}] Terjadi kendala: ${err.message}. Mencoba lagi dalam ${waitTime / 1000}s...`,
          "warning",
        )
        await new Promise((resolve) => setTimeout(resolve, waitTime))
      }
    }

    throw new Error(`Gagal menerjemahkan Batch ${batchNum} setelah ${maxRetries} percobaan.`)
  }

  // Save to Neon DB
  const saveToNeonDb = async (
    title: string,
    origSrt: string,
    transSrt: string,
    subCount: number,
    charCount: number,
    filesCount: number,
  ) => {
    try {
      addLog("Menghubungkan ke Neon Database...", "step")
      const response = await fetch("/api/subtitles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          source_language: languageMap[sourceLanguage] || sourceLanguage,
          target_language: "Indonesian",
          original_srt: origSrt,
          translated_srt: transSrt,
          subtitles_count: subCount,
          characters_count: charCount,
          files_count: filesCount,
        }),
      })

      const data = await response.json()
      if (response.ok && data.success) {
        setSavedDbId(data.item.id)
        addLog(`🎉 Berhasil disimpan ke Neon DB! Record ID: #${data.item.id}`, "success")
        fetchHistory()
        return data.item.id
      } else {
        addLog(`⚠️ Info DB: ${data.error || "Gagal menyimpan ke database (periksa DATABASE_URL di .env.local)"}`, "warning")
        return null
      }
    } catch (err: any) {
      console.warn("DB save failed:", err)
      addLog(`⚠️ Database error: ${err.message}`, "warning")
      return null
    }
  }

  // Main Unified Workflow Handler
  const handleExecuteWorkflow = async () => {
    if (!projectTitle.trim()) {
      setError("Silakan masukkan Judul / Nama File Proyek terlebih dahulu.")
      return
    }

    if (srtFiles.length === 0) {
      setError("Silakan unggah minimal 1 file SRT.")
      return
    }

    setLoading(true)
    setWorkflowStep("running")
    setError(null)
    setSuccessMessage(null)
    setOriginalJoinedSrt("")
    setTranslatedIndoSrt("")
    setPreviewBlocks([])
    setSavedDbId(null)
    setCharactersUsed(0)
    setRequestsMade(0)
    setOverallProgress(5)
    setLogs([])

    const cleanTitle = projectTitle.trim().replace(/\.srt$/i, "")
    addLog(`=== MEMULAI AI SUBTITLE WORKFLOW: "${cleanTitle}" ===`, "info")

    try {
      // ----------------------------------------------------
      // STAGE 1: SRT JOINER + WAV OFFSET
      // ----------------------------------------------------
      setCurrentStage("joining")
      setBatchSubStep("Menggabungkan file SRT dan menghitung offset durasi WAV...")
      addLog(`[STAGE 1] Membaca ${srtFiles.length} file SRT dan ${wavFiles.length} file WAV...`, "step")

      let cumulativeWavOffsetMs = 0
      const joinedOriginalBlocks: SrtBlock[] = []
      let currentSrtIndex = 1

      for (let i = 0; i < srtFiles.length; i++) {
        const file = srtFiles[i]
        const content = await file.text()
        const blocks = parseSrt(content)

        if (blocks.length === 0) {
          addLog(`Peringatan: File ${file.name} tidak memiliki subtitle valid, dilewati.`, "warning")
          continue
        }

        const offsetForCurrentSrt = cumulativeWavOffsetMs
        const adjustedBlocks = adjustSrtTimestamps(blocks, offsetForCurrentSrt)

        adjustedBlocks.forEach((block) => {
          joinedOriginalBlocks.push({ ...block, index: currentSrtIndex++ })
        })

        addLog(`File [${i + 1}/${srtFiles.length}] ${file.name}: ${blocks.length} baris digabungkan (Offset: +${(offsetForCurrentSrt / 1000).toFixed(2)}s).`, "info")

        if (wavFiles[i]) {
          try {
            const wavDuration = await getWavDuration(wavFiles[i])
            cumulativeWavOffsetMs += wavDuration
            addLog(`Audio WAV ${wavFiles[i].name} durasi: ${(wavDuration / 1000).toFixed(2)} detik (Offset kumulatif bertambah).`, "info")
          } catch (wavErr) {
            addLog(`Gagal membaca durasi WAV ${wavFiles[i].name}, lanjut tanpa offset audio ini.`, "warning")
          }
        }
      }

      if (joinedOriginalBlocks.length === 0) {
        throw new Error("Tidak ada blok subtitle valid yang berhasil digabungkan dari file yang diunggah.")
      }

      const formattedOriginalSrt = formatSrt(joinedOriginalBlocks)
      setOriginalJoinedSrt(formattedOriginalSrt)
      setTotalSubtitlesCount(joinedOriginalBlocks.length)

      addLog(`✔️ [STAGE 1 SELESAI] Berhasil menggabungkan ${joinedOriginalBlocks.length} total blok subtitle.`, "success")
      setOverallProgress(20)

      // ----------------------------------------------------
      // STAGE 2: BATCH TRANSLATION TO INDONESIAN
      // ----------------------------------------------------
      setCurrentStage("translating")
      addLog(`[STAGE 2] Memulai Batch Translation ke Bahasa Indonesia (${languageMap[sourceLanguage]} ➔ Indonesian)...`, "step")

      const chunks: SrtBlock[][] = []
      for (let i = 0; i < joinedOriginalBlocks.length; i += batchSize) {
        chunks.push(joinedOriginalBlocks.slice(i, i + batchSize))
      }

      const totalChunksCount = chunks.length
      setTotalBatches(totalChunksCount)
      addLog(`Membagi ${joinedOriginalBlocks.length} baris menjadi ${totalChunksCount} batch (~${batchSize} baris/request).`, "info")

      const translatedBlocksMap = new Map<number, string>()
      let totalChars = 0
      let reqCount = 0

      for (let bIndex = 0; bIndex < chunks.length; bIndex++) {
        const batchNumber = bIndex + 1
        const currentChunk = chunks[bIndex]
        setCurrentBatchIndex(batchNumber)

        const startNum = bIndex * batchSize + 1
        const endNum = Math.min((bIndex + 1) * batchSize, joinedOriginalBlocks.length)
        setBatchSubStep(`[Batch ${batchNumber}/${totalChunksCount}] Menerjemahkan subtitle #${startNum} - #${endNum}...`)

        const itemsToTranslate: TranslateItem[] = currentChunk.map((block) => ({
          id: block.index,
          text: block.text,
        }))

        const batchChars = currentChunk.reduce((acc, b) => acc + b.text.length, 0)
        totalChars += batchChars
        setCharactersUsed(totalChars)

        const result = await translateBatchWithRetry(itemsToTranslate, batchNumber, totalChunksCount)
        reqCount++
        setRequestsMade(reqCount)

        result.translatedItems.forEach((item, itemIdx) => {
          const idNum = Number(item.id) || (currentChunk[itemIdx] ? currentChunk[itemIdx].index : null)
          if (idNum !== null) {
            translatedBlocksMap.set(idNum, item.text)
          }
        })

        addLog(`[Batch ${batchNumber}/${totalChunksCount}] Selesai diterima (${result.translatedItems.length} item).`, "success")

        const batchProgress = Math.round(20 + ((bIndex + 1) / totalChunksCount) * 60)
        setOverallProgress(batchProgress)

        if (bIndex < chunks.length - 1) {
          setBatchSubStep(`[Batch ${batchNumber}/${totalChunksCount}] Jeda aman rate limit 1.2 detik...`)
          await new Promise((resolve) => setTimeout(resolve, 1200))
        }
      }

      addLog(`✔️ [STAGE 2 SELESAI] Seluruh ${joinedOriginalBlocks.length} baris berhasil diterjemahkan via ${reqCount} batch request!`, "success")

      // ----------------------------------------------------
      // STAGE 3: RECONSTRUCTING INDONESIAN SRT
      // ----------------------------------------------------
      setCurrentStage("reconstructing")
      setBatchSubStep("Menyusun kembali struktur dan timestamp file SRT Bahasa Indonesia...")
      addLog("[STAGE 3] Menyusun ulang file SRT Indonesia dengan timestamp yang sinkron...", "step")

      const finalTranslatedBlocks: SrtBlock[] = []
      const previews: { original: SrtBlock; translated: SrtBlock }[] = []

      for (const orig of joinedOriginalBlocks) {
        const translatedText = translatedBlocksMap.get(Number(orig.index)) || orig.text
        const translatedBlock: SrtBlock = {
          index: orig.index,
          startTime: orig.startTime,
          endTime: orig.endTime,
          text: translatedText,
        }
        finalTranslatedBlocks.push(translatedBlock)

        if (previews.length < 8) {
          previews.push({ original: orig, translated: translatedBlock })
        }
      }

      const formattedTranslatedSrt = formatSrt(finalTranslatedBlocks)
      setTranslatedIndoSrt(formattedTranslatedSrt)
      setPreviewBlocks(previews)
      setOverallProgress(88)

      // ----------------------------------------------------
      // STAGE 4: SAVING TO NEON DATABASE
      // ----------------------------------------------------
      setCurrentStage("saving")
      setBatchSubStep("Menyimpan kedua file (Original Joined & Translated) ke database Neon...")
      addLog("[STAGE 4] Menyimpan rekaman proyek ke Neon PostgreSQL Database...", "step")

      const dbId = await saveToNeonDb(
        cleanTitle,
        formattedOriginalSrt,
        formattedTranslatedSrt,
        finalTranslatedBlocks.length,
        totalChars,
        srtFiles.length,
      )

      // ----------------------------------------------------
      // STAGE 5: DONE
      // ----------------------------------------------------
      setCurrentStage("done")
      setWorkflowStep("completed")
      setOverallProgress(100)
      setBatchSubStep("Workflow Selesai! Kedua file siap diunduh.")

      const successMsg = `Workflow berhasil diselesaikan! 2 file (${cleanTitle}_original_joined.srt & ${cleanTitle}_translated_indonesian.srt) siap diunduh.`
      setSuccessMessage(successMsg)
      addLog(`✨ WORKFLOW SELESAI 100%! ${joinedOriginalBlocks.length} baris subtitle berhasil diproses.`, "success")
    } catch (err: any) {
      console.error("Workflow error:", err)
      const msg = err instanceof Error ? err.message : String(err)
      setError(`Workflow gagal: ${msg}`)
      addLog(`❌ ERROR: ${msg}`, "error")
      setCurrentStage("idle")
    } finally {
      setLoading(false)
    }
  }

  // Download Helpers
  const downloadSingleFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const downloadBothAsZip = async (title: string, origSrt: string, transSrt: string) => {
    try {
      const cleanTitle = title.trim().replace(/\.srt$/i, "") || "subtitles"
      const zip = new JSZip()

      zip.file(`${cleanTitle}_original_joined.srt`, origSrt)
      zip.file(`${cleanTitle}_translated_indonesian.srt`, transSrt)

      const zipBlob = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${cleanTitle}_subtitles_bundle.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (zipErr) {
      console.error("ZIP creation error:", zipErr)
      alert("Gagal membuat file ZIP. Anda tetap dapat mengunduh masing-masing file SRT.")
    }
  }

  // Open Preview Detail from History
  const openHistoryDetail = async (id: number) => {
    setLoadingDetail(true)
    setPreviewModalOpen(true)
    try {
      const res = await fetch(`/api/subtitles/${id}`)
      const data = await res.json()
      if (data.item) {
        setSelectedHistoryItem(data.item)
      }
    } catch (err) {
      console.error("Failed to load item detail:", err)
    } finally {
      setLoadingDetail(false)
    }
  }

  // Delete from History
  const deleteHistoryItem = async (id: number, title: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus "${title}" dari database Neon?`)) {
      return
    }

    try {
      const res = await fetch(`/api/subtitles/${id}`, { method: "DELETE" })
      if (res.ok) {
        setHistoryItems((prev) => prev.filter((item) => item.id !== id))
        if (selectedHistoryItem?.id === id) {
          setPreviewModalOpen(false)
        }
      }
    } catch (err) {
      alert("Gagal menghapus entri dari database.")
    }
  }

  const filteredHistory = historyItems.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.source_language.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const cleanProjectTitle = projectTitle.trim().replace(/\.srt$/i, "")

  return (
    <div className="min-h-screen bg-[#f3f6fc] text-slate-900 p-4 sm:p-6 lg:p-8 flex gap-6">
      {/* ============================================================ */}
      {/* 1. LEFT SIDEBAR (Pixel Matched UI) */}
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
            <button
              onClick={() => setCurrentView("workflow")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
                currentView === "workflow"
                  ? "bg-blue-50/90 text-blue-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>New workflow</span>
            </button>

            <button
              onClick={() => setCurrentView("others")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all ${
                currentView === "others"
                  ? "bg-blue-50/90 text-blue-600 font-semibold shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <Layers className="w-4 h-4 text-slate-400" />
              <span>Other tools</span>
            </button>

            <button
              onClick={() => {
                setCurrentView("history")
                fetchHistory()
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all ${
                currentView === "history"
                  ? "bg-blue-50/90 text-blue-600 font-semibold shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <History className="w-4 h-4 text-slate-400" />
              <span>History</span>
              {historyItems.length > 0 && (
                <span className="ml-auto text-[11px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">
                  {historyItems.length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Bottom Workspace / Profile Widget */}
        <div className="space-y-3 pt-6 border-t border-slate-100">
          <div className="p-3 bg-slate-50 rounded-2xl flex items-center gap-3 border border-slate-100/80">
            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
              <User className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-xs text-slate-800 truncate">Your workspace</span>
              <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Neon DB Active
              </span>
            </div>
          </div>

          <button
            onClick={() => handleResetForm()}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Reset session</span>
          </button>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* 2. MAIN CONTENT AREA */}
      {/* ============================================================ */}
      <div className="flex-1 flex flex-col gap-5 min-w-0">
        {/* Top Breadcrumbs & Title Bar */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-[11px] font-bold tracking-wider text-blue-600 uppercase">
              WORKSPACE / {currentView === "workflow" ? "NEW WORKFLOW" : currentView === "history" ? "FILE HISTORY" : "OTHER TOOLS"}
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              AI Subtitle Workflow
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setCurrentView(currentView === "workflow" ? "history" : "workflow")}
              variant="outline"
              size="sm"
              className="bg-white rounded-xl border-slate-200 text-xs font-semibold gap-1.5 shadow-2xs hover:bg-slate-50"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-500" />
              {currentView === "workflow" ? "Preferences / History" : "New Workflow"}
            </Button>
          </div>
        </div>

        {/* Dynamic View: Workflow vs History vs Tools */}
        {currentView === "history" ? (
          /* ============================================================ */
          /* HISTORY VIEW */
          /* ============================================================ */
          <div className="space-y-5">
            <div className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-100 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Database className="w-5 h-5 text-indigo-600" />
                    Daftar Riwayat File di Database Neon
                  </h2>
                  <p className="text-xs text-slate-500">
                    Semua proyek subtitle yang pernah diinput dan diproses tersimpan aman di database PostgreSQL.
                  </p>
                </div>
                <Button
                  onClick={fetchHistory}
                  variant="outline"
                  size="sm"
                  className="rounded-xl gap-1.5 text-xs font-semibold"
                  disabled={loadingHistory}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                <Input
                  placeholder="Cari berdasarkan nama file / judul proyek..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-11 bg-slate-50/50 rounded-xl border-slate-200 text-xs sm:text-sm"
                />
              </div>

              {/* Loading State */}
              {loadingHistory && (
                <div className="text-center py-12 space-y-3">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                  <p className="text-xs text-slate-500">Memuat riwayat dari database Neon...</p>
                </div>
              )}

              {/* Empty State */}
              {!loadingHistory && filteredHistory.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed rounded-2xl border-slate-200 space-y-3">
                  <Database className="w-10 h-10 text-slate-300 mx-auto" />
                  <div className="space-y-1">
                    <h4 className="font-semibold text-slate-700 text-sm">Belum ada riwayat subtitle</h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Jalankan proses pertama Anda di tab New Workflow untuk menyimpannya ke database.
                    </p>
                  </div>
                  <Button
                    onClick={() => setCurrentView("workflow")}
                    size="sm"
                    className="bg-blue-600 text-white rounded-xl mt-2"
                  >
                    Mulai Workflow Baru
                  </Button>
                </div>
              )}

              {/* History Items List */}
              {!loadingHistory && filteredHistory.length > 0 && (
                <div className="divide-y divide-slate-100 border rounded-2xl overflow-hidden bg-white">
                  {filteredHistory.map((item) => {
                    const formattedDate = new Date(item.created_at).toLocaleString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })

                    return (
                      <div
                        key={item.id}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm sm:text-base truncate">
                              {item.title}
                            </span>
                            <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 font-semibold">
                              {item.source_language} ➔ {item.target_language}
                            </Badge>
                            <span className="text-[11px] text-slate-400">#{item.id}</span>
                          </div>

                          <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              {formattedDate}
                            </span>
                            <span>•</span>
                            <span>{item.subtitles_count} baris subtitle</span>
                            <span>•</span>
                            <span>{item.files_count} file sumber</span>
                            {item.characters_count > 0 && (
                              <>
                                <span>•</span>
                                <span>{item.characters_count.toLocaleString()} karakter</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          <Button
                            onClick={() => openHistoryDetail(item.id)}
                            variant="outline"
                            size="sm"
                            className="rounded-xl text-xs gap-1.5 font-semibold"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                            Preview & Unduh
                          </Button>
                          <Button
                            onClick={() => deleteHistoryItem(item.id, item.title)}
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl p-2"
                            title="Hapus dari database"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : currentView === "others" ? (
          /* ============================================================ */
          /* OTHER TOOLS VIEW */
          /* ============================================================ */
          <div className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-100 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Alat & Fitur Tambahan Lainnya</h2>
              <p className="text-xs text-slate-500">Akses modul subtitle individual secara mandiri.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link href="/srt-translate" className="p-4 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 transition-all flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-blue-100 text-blue-600"><Languages className="w-5 h-5" /></div>
                <div>
                  <h4 className="font-bold text-sm text-slate-800">SRT Translate (AI)</h4>
                  <p className="text-xs text-slate-500">Menerjemahkan file SRT tunggal secara batch.</p>
                </div>
              </Link>

              <Link href="/srt-joiner" className="p-4 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 transition-all flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-600"><Layers className="w-5 h-5" /></div>
                <div>
                  <h4 className="font-bold text-sm text-slate-800">SRT Joiner Mandiri</h4>
                  <p className="text-xs text-slate-500">Menggabungkan beberapa SRT dengan offset durasi WAV.</p>
                </div>
              </Link>

              <Link href="/arabic" className="p-4 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 transition-all flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-600"><BookOpen className="w-5 h-5" /></div>
                <div>
                  <h4 className="font-bold text-sm text-slate-800">Arabic Translator</h4>
                  <p className="text-xs text-slate-500">Transliterasi huruf Arab ke Latin standar ALA-LC.</p>
                </div>
              </Link>

              <Link href="/joiner-translated" className="p-4 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 transition-all flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-purple-100 text-purple-600"><Split className="w-5 h-5" /></div>
                <div>
                  <h4 className="font-bold text-sm text-slate-800">Joiner Translated</h4>
                  <p className="text-xs text-slate-500">Kombinasi SRT asli dengan hasil terjemahan.</p>
                </div>
              </Link>

              <Link href="/srt-lb-insert" className="p-4 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 transition-all flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-rose-100 text-rose-600"><FileCode className="w-5 h-5" /></div>
                <div>
                  <h4 className="font-bold text-sm text-slate-800">SRT LB Insert</h4>
                  <p className="text-xs text-slate-500">Memperbaiki baris pemisah antar nomor subtitle yang hilang.</p>
                </div>
              </Link>
            </div>
          </div>
        ) : (
          /* ============================================================ */
          /* WORKFLOW VIEW (Main 2-Column Layout Matched with Screenshot) */
          /* ============================================================ */
          <div className="flex flex-col xl:flex-row gap-6 items-start">
            {/* Center Main Step Container */}
            <div className="flex-1 w-full space-y-6">
              {workflowStep === "config" ? (
                /* ============================================================ */
                /* STEP 1: CONFIGURATION & UPLOAD FORM */
                /* ============================================================ */
                <div className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-100 shadow-sm space-y-6">
                  {/* Card Top Title */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <h2 className="text-lg sm:text-xl font-bold text-slate-900">Create a new workflow</h2>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-500">
                        Join subtitle files, offset audio, translate in batches, and save your results automatically.
                      </p>
                    </div>
                    <button className="text-slate-400 hover:text-slate-600 p-1">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </div>

                  {/* 1. Project Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="project-name-input" className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1">
                      Project name <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="project-name-input"
                      type="text"
                      value={projectTitle}
                      onChange={(e) => setProjectTitle(e.target.value)}
                      disabled={loading}
                      placeholder="e.g. documentary_episode_01"
                      className="h-12 bg-white rounded-2xl border-slate-200 font-medium px-4 text-xs sm:text-sm shadow-2xs"
                    />
                    <p className="text-[11px] text-slate-400 font-medium">
                      Used as the database title and export filename.
                    </p>
                  </div>

                  {/* 2. Side-by-Side Large Dropzones */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* SRT Dropzone */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-blue-600" />
                          Subtitle files <span className="text-rose-500">*</span>
                        </Label>
                        {srtFiles.length > 0 && (
                          <span className="text-[11px] font-bold text-blue-600">
                            {srtFiles.length} file dipilih
                          </span>
                        )}
                      </div>

                      <input
                        ref={srtInputRef}
                        type="file"
                        accept=".srt,.SRT"
                        multiple
                        onChange={(e) => e.target.files && processSrtFiles(Array.from(e.target.files))}
                        className="hidden"
                        disabled={loading}
                      />

                      <div
                        onDragEnter={handleSrtDragEnter}
                        onDragOver={handleSrtDragOver}
                        onDragLeave={handleSrtDragLeave}
                        onDrop={handleSrtDrop}
                        onClick={() => !loading && srtInputRef.current?.click()}
                        className={`relative border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center min-h-[160px] ${
                          isDraggingSrt
                            ? "border-blue-500 bg-blue-100/70 scale-[1.02] shadow-md shadow-blue-500/10"
                            : "border-blue-200/90 bg-blue-50/20 hover:bg-blue-50/50 hover:border-blue-400"
                        }`}
                      >
                        <div className="w-12 h-12 rounded-full bg-white shadow-xs text-blue-600 flex items-center justify-center mb-3">
                          <CloudUpload className="w-6 h-6" />
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-slate-800">
                          {isDraggingSrt ? "Lepaskan file SRT di sini..." : "Drop SRT files here"}
                        </p>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                          or click to browse · files stay ordered
                        </p>
                      </div>

                      {/* Selected SRT Chips */}
                      {srtFiles.length > 0 && (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {srtFiles.map((file, idx) => (
                            <div
                              key={`${file.name}-${idx}`}
                              className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50/60 border border-blue-100 text-xs"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>
                                <span className="font-semibold text-slate-800 truncate" title={file.name}>
                                  {file.name}
                                </span>
                                <span className="text-[10px] text-slate-400 shrink-0">
                                  ({(file.size / 1024).toFixed(1)} KB)
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  removeSrtFile(idx)
                                }}
                                disabled={loading}
                                className="text-slate-400 hover:text-rose-600 p-1"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* WAV Dropzone */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                          <Headphones className="w-4 h-4 text-amber-500" />
                          Audio WAV <span className="text-[11px] text-slate-400 font-normal">Optional</span>
                        </Label>
                        {wavFiles.length > 0 && (
                          <span className="text-[11px] font-bold text-amber-600">
                            {wavFiles.length} file dipilih
                          </span>
                        )}
                      </div>

                      <input
                        ref={wavInputRef}
                        type="file"
                        accept=".wav,.WAV"
                        multiple
                        onChange={(e) => e.target.files && processWavFiles(Array.from(e.target.files))}
                        className="hidden"
                        disabled={loading}
                      />

                      <div
                        onDragEnter={handleWavDragEnter}
                        onDragOver={handleWavDragOver}
                        onDragLeave={handleWavDragLeave}
                        onDrop={handleWavDrop}
                        onClick={() => !loading && wavInputRef.current?.click()}
                        className={`relative border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center min-h-[160px] ${
                          isDraggingWav
                            ? "border-amber-500 bg-amber-100/70 scale-[1.02] shadow-md shadow-amber-500/10"
                            : "border-amber-200/90 bg-amber-50/20 hover:bg-amber-50/50 hover:border-amber-400"
                        }`}
                      >
                        <div className="w-12 h-12 rounded-full bg-white shadow-xs text-amber-500 flex items-center justify-center mb-3">
                          <Upload className="w-6 h-6" />
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-slate-800">
                          {isDraggingWav ? "Lepaskan file WAV di sini..." : "Drop WAV file here"}
                        </p>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                          Optional · used for audio offset
                        </p>
                      </div>

                      {/* Selected WAV Chips */}
                      {wavFiles.length > 0 && (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {wavFiles.map((file, idx) => (
                            <div
                              key={`${file.name}-${idx}`}
                              className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/60 border border-amber-100 text-xs"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="w-5 h-5 rounded-full bg-amber-500 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>
                                <span className="font-semibold text-slate-800 truncate" title={file.name}>
                                  {file.name}
                                </span>
                                <span className="text-[10px] text-slate-400 shrink-0">
                                  ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  removeWavFile(idx)
                                }}
                                disabled={loading}
                                className="text-slate-400 hover:text-rose-600 p-1"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. Dropdowns (Language & Batch Size) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="source-lang-select" className="text-xs sm:text-sm font-bold text-slate-800">
                        Source language
                      </Label>
                      <Select value={sourceLanguage} onValueChange={setSourceLanguage} disabled={loading}>
                        <SelectTrigger id="source-lang-select" className="h-12 bg-white rounded-2xl border-slate-200 text-xs sm:text-sm">
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl shadow-xl">
                          <SelectItem value="auto">✨ Auto Detect (Otomatis Deteksi Bahasa)</SelectItem>
                          <SelectItem value="german">German (German)</SelectItem>
                          <SelectItem value="english">English (English)</SelectItem>
                          <SelectItem value="french">French (French)</SelectItem>
                          <SelectItem value="spanish">Spanish (Spanish)</SelectItem>
                          <SelectItem value="portuguese">Portuguese (Portuguese)</SelectItem>
                          <SelectItem value="italian">Italian (Italian)</SelectItem>
                          <SelectItem value="arabic">Arabic (Arabic)</SelectItem>
                          <SelectItem value="japanese">Japanese (Japanese)</SelectItem>
                          <SelectItem value="korean">Korean (Korean)</SelectItem>
                          <SelectItem value="chinese">Chinese (Chinese)</SelectItem>
                          <SelectItem value="russian">Russian (Russian)</SelectItem>
                          <SelectItem value="dutch">Dutch (Dutch)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="batch-size-select" className="text-xs sm:text-sm font-bold text-slate-800">
                        Batch size
                      </Label>
                      <Select
                        value={String(batchSize)}
                        onValueChange={(val) => setBatchSize(Number(val))}
                        disabled={loading}
                      >
                        <SelectTrigger id="batch-size-select" className="h-12 bg-white rounded-2xl border-slate-200 text-xs sm:text-sm">
                          <SelectValue placeholder="Select batch size" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl shadow-xl">
                          <SelectItem value="50">50 lines / request</SelectItem>
                          <SelectItem value="100">100 lines / request (Recommended)</SelectItem>
                          <SelectItem value="150">150 lines / request</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* 4. Action Buttons (Pixel Matched with Image) */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <Button
                      onClick={handleResetForm}
                      variant="outline"
                      className="h-12 px-6 rounded-2xl border-slate-200 text-slate-700 font-bold text-xs sm:text-sm gap-2 hover:bg-slate-50"
                      disabled={loading}
                    >
                      <RefreshCw className="w-4 h-4 text-slate-400" />
                      Reset
                    </Button>

                    <Button
                      onClick={handleExecuteWorkflow}
                      className="h-12 px-7 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm gap-2 shadow-lg shadow-blue-500/25"
                      disabled={loading || !projectTitle.trim() || srtFiles.length === 0}
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      Run AI subtitle workflow
                    </Button>
                  </div>

                  {/* Feedback Alerts */}
                  {error && (
                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm">
                      <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
                      <div>
                        <p className="font-bold">Terjadi Kesalahan</p>
                        <p>{error}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* ============================================================ */
                /* STEP 2: WORKFLOW STATUS, LIVE PROGRESS & RESULTS */
                /* ============================================================ */
                <div className="space-y-6">
                  <div className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-100 shadow-sm space-y-6">
                    {/* Header with Back Button */}
                    <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <Button
                          onClick={() => setWorkflowStep("config")}
                          variant="outline"
                          size="sm"
                          className="rounded-xl text-xs font-bold gap-1.5 border-slate-200 hover:bg-slate-50"
                          disabled={loading}
                        >
                          <ArrowRight className="w-3.5 h-3.5 rotate-180 text-slate-500" />
                          {workflowStep === "completed" ? "Edit / Upload Ulang" : "Kembali ke Form"}
                        </Button>
                        <div className="flex flex-col">
                          <span className="font-bold text-base text-slate-900 leading-tight">
                            {cleanProjectTitle}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {srtFiles.length} file SRT · {wavFiles.length} audio WAV
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {activeModel && (
                          <Badge variant="outline" className="text-xs bg-slate-50 text-slate-700 font-semibold">
                            AI: {activeModel}
                          </Badge>
                        )}
                        <Badge
                          className={`text-xs font-bold py-1 px-3 ${
                            currentStage === "done"
                              ? "bg-emerald-600 text-white"
                              : "bg-blue-600 text-white animate-pulse"
                          }`}
                        >
                          {currentStage === "joining" && "1. Joining SRT & WAV"}
                          {currentStage === "translating" && `2. Translating (${currentBatchIndex}/${totalBatches})`}
                          {currentStage === "reconstructing" && "3. Reconstructing"}
                          {currentStage === "saving" && "4. Saving to DB"}
                          {currentStage === "done" && "✨ Completed 100%"}
                        </Badge>
                      </div>
                    </div>

                    {/* Overall Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold text-slate-700">
                        <span>Progres Eksekusi</span>
                        <span className="text-blue-600 font-extrabold">{overallProgress}%</span>
                      </div>
                      <Progress value={overallProgress} className="h-3 rounded-full" />
                      <p className="text-xs text-slate-500 italic font-medium">{batchSubStep}</p>
                    </div>

                    {/* 4-Stage Visual Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div
                        className={`p-3 rounded-2xl border transition-all ${
                          overallProgress >= 20
                            ? "bg-blue-50/70 border-blue-200 text-blue-900 font-bold"
                            : "bg-slate-50/50 border-slate-100 text-slate-400"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <Layers className="w-3.5 h-3.5 text-blue-600" />
                          <span>1. Join & Offset</span>
                        </div>
                        <span className="text-[10px] font-normal block">
                          {overallProgress >= 20 ? "Selesai" : "Menunggu..."}
                        </span>
                      </div>

                      <div
                        className={`p-3 rounded-2xl border transition-all ${
                          overallProgress >= 80
                            ? "bg-blue-50/70 border-blue-200 text-blue-900 font-bold"
                            : currentStage === "translating"
                            ? "bg-amber-50/70 border-amber-200 text-amber-900 font-bold animate-pulse"
                            : "bg-slate-50/50 border-slate-100 text-slate-400"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>2. AI Translate</span>
                        </div>
                        <span className="text-[10px] font-normal block">
                          {overallProgress >= 80
                            ? "Selesai"
                            : currentStage === "translating"
                            ? `Batch ${currentBatchIndex}/${totalBatches}`
                            : "Menunggu..."}
                        </span>
                      </div>

                      <div
                        className={`p-3 rounded-2xl border transition-all ${
                          overallProgress >= 90
                            ? "bg-blue-50/70 border-blue-200 text-blue-900 font-bold"
                            : "bg-slate-50/50 border-slate-100 text-slate-400"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <FileText className="w-3.5 h-3.5 text-indigo-600" />
                          <span>3. Reconstruct</span>
                        </div>
                        <span className="text-[10px] font-normal block">
                          {overallProgress >= 90 ? "Selesai" : "Menunggu..."}
                        </span>
                      </div>

                      <div
                        className={`p-3 rounded-2xl border transition-all ${
                          overallProgress === 100
                            ? "bg-emerald-50/70 border-emerald-200 text-emerald-900 font-bold"
                            : "bg-slate-50/50 border-slate-100 text-slate-400"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <Database className="w-3.5 h-3.5 text-emerald-600" />
                          <span>4. Save to DB</span>
                        </div>
                        <span className="text-[10px] font-normal block">
                          {overallProgress === 100 ? "Tersimpan" : "Menunggu..."}
                        </span>
                      </div>
                    </div>

                    {/* Live Terminal Log */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5 text-slate-500" />
                          Live Terminal Activity Log
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">{logs.length} events</span>
                      </div>
                      <div className="bg-slate-900 text-slate-200 rounded-2xl p-4 font-mono text-[11px] leading-relaxed max-h-52 overflow-y-auto space-y-1 shadow-inner">
                        {logs.map((log) => (
                          <div key={log.id} className="flex items-start gap-2">
                            <span className="text-slate-500 select-none">[{log.time}]</span>
                            <span
                              className={
                                log.type === "success"
                                  ? "text-emerald-400 font-semibold"
                                  : log.type === "warning"
                                  ? "text-amber-400"
                                  : log.type === "error"
                                  ? "text-rose-400 font-semibold"
                                  : log.type === "step"
                                  ? "text-cyan-300"
                                  : "text-slate-300"
                              }
                            >
                              {log.message}
                            </span>
                          </div>
                        ))}
                        <div ref={terminalEndRef} />
                      </div>
                    </div>

                    {/* Success Download Banner */}
                    {workflowStep === "completed" && originalJoinedSrt && translatedIndoSrt && (
                      <div className="p-5 bg-emerald-50/80 border border-emerald-200 rounded-3xl space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <h4 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            File Hasil Berhasil Diproses & Siap Diunduh:
                          </h4>
                          {savedDbId && (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                              Tersimpan di DB: #{savedDbId}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <Button
                            onClick={() =>
                              downloadSingleFile(originalJoinedSrt, `${cleanProjectTitle}_original_joined.srt`)
                            }
                            variant="outline"
                            className="bg-white border-slate-300 text-slate-800 text-xs font-bold py-5 rounded-2xl hover:bg-slate-50"
                          >
                            <Download className="w-4 h-4 mr-1.5 text-blue-600" />
                            1. Original Joined (.srt)
                          </Button>

                          <Button
                            onClick={() =>
                              downloadSingleFile(translatedIndoSrt, `${cleanProjectTitle}_translated_indonesian.srt`)
                            }
                            variant="outline"
                            className="bg-white border-emerald-300 text-emerald-900 text-xs font-bold py-5 rounded-2xl hover:bg-emerald-50/50"
                          >
                            <Download className="w-4 h-4 mr-1.5 text-emerald-600" />
                            2. Indonesian SRT (.srt)
                          </Button>

                          <Button
                            onClick={() => downloadBothAsZip(cleanProjectTitle, originalJoinedSrt, translatedIndoSrt)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-5 rounded-2xl shadow-sm"
                          >
                            <Archive className="w-4 h-4 mr-1.5" />
                            Download Both (.zip)
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Bottom Actions */}
                    <div className="flex items-center justify-between pt-2">
                      <Button
                        onClick={() => {
                          handleResetForm()
                          setWorkflowStep("config")
                        }}
                        variant="outline"
                        className="h-11 px-5 rounded-2xl border-slate-200 text-xs font-bold gap-2"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        + Buat Workflow Baru
                      </Button>

                      <Button
                        onClick={() => {
                          setCurrentView("history")
                          fetchHistory()
                        }}
                        className="h-11 px-5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold gap-2"
                      >
                        <History className="w-3.5 h-3.5" />
                        Lihat Riwayat di Database
                      </Button>
                    </div>
                  </div>

                  {/* Preview Comparison Card (Below Progress in Step 2) */}
                  {previewBlocks.length > 0 && (
                    <div className="rounded-3xl bg-white p-6 sm:p-8 border border-slate-100 shadow-sm space-y-4">
                      <h3 className="font-bold text-base text-slate-900">
                        Pratinjau Hasil Subtitle (Teks Asli vs Indonesia)
                      </h3>
                      <div className="divide-y divide-slate-100 border rounded-2xl overflow-hidden bg-white text-xs">
                        {previewBlocks.map(({ original, translated }) => (
                          <div key={original.index} className="p-3.5 grid grid-cols-1 md:grid-cols-2 gap-3 hover:bg-slate-50/50">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
                                <span className="font-bold text-slate-700">#{original.index}</span>
                                <span>{original.startTime} → {original.endTime}</span>
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-semibold">Original</Badge>
                              </div>
                              <p className="text-slate-800 whitespace-pre-wrap">{original.text}</p>
                            </div>
                            <div className="space-y-1 border-t md:border-t-0 md:border-l md:pl-3.5 pt-2 md:pt-0">
                              <div className="flex items-center gap-2 text-emerald-600 font-mono text-[11px]">
                                <span className="font-bold">#{translated.index}</span>
                                <Badge variant="default" className="text-[10px] bg-emerald-100 text-emerald-800 border-0 py-0 px-1.5 font-semibold">
                                  Indonesian
                                </Badge>
                              </div>
                              <p className="text-emerald-950 font-bold whitespace-pre-wrap">{translated.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ============================================================ */}
            {/* 3. RIGHT SIDEBAR WIDGETS (Pixel Matched with Screenshot) */}
            {/* ============================================================ */}
            <div className="w-80 shrink-0 hidden xl:flex flex-col gap-5">
              {/* Recent Files Card */}
              <div className="rounded-3xl bg-white p-6 border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Recent files</h3>
                    <p className="text-[11px] text-slate-400 font-medium">Your latest workflows</p>
                  </div>
                  <Folder className="w-4 h-4 text-slate-300" />
                </div>

                {/* Items List */}
                <div className="space-y-3">
                  {historyItems.length > 0 ? (
                    historyItems.slice(0, 4).map((item) => (
                      <div
                        key={item.id}
                        onClick={() => openHistoryDetail(item.id)}
                        className="flex items-center gap-3 p-2 rounded-2xl hover:bg-slate-50 cursor-pointer transition-colors group"
                      >
                        <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="font-bold text-xs text-slate-800 truncate" title={item.title}>
                            {item.title}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(item.created_at).toLocaleDateString("id-ID", { month: "short", day: "numeric" })} · {item.subtitles_count} subs
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-2 rounded-2xl bg-slate-50/60">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-xs text-slate-700 truncate">my_project_original_joi...</span>
                          <span className="text-[10px] text-slate-400">Today · 3.5 MB</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-2 rounded-2xl bg-slate-50/60">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-xs text-slate-700 truncate">my_project_translated_i...</span>
                          <span className="text-[10px] text-slate-400">Yesterday · 2.1 MB</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-2 rounded-2xl bg-slate-50/60">
                        <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
                          <Headphones className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-xs text-slate-700 truncate">voiceover_mix.wav</span>
                          <span className="text-[10px] text-slate-400">Aug 24 · 18.4 MB</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* View History Button */}
                <Button
                  onClick={() => {
                    setCurrentView("history")
                    fetchHistory()
                  }}
                  className="w-full h-11 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs gap-2"
                >
                  <History className="w-3.5 h-3.5" />
                  View file history
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detail & Download Modal for History Item */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold">
              <Database className="w-5 h-5 text-indigo-600" />
              Detail Proyek: {selectedHistoryItem?.title}
            </DialogTitle>
            <DialogDescription>
              Disimpan pada{" "}
              {selectedHistoryItem?.created_at &&
                new Date(selectedHistoryItem.created_at).toLocaleString("id-ID")}
            </DialogDescription>
          </DialogHeader>

          {loadingDetail ? (
            <div className="py-12 text-center">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
              <p className="text-xs text-slate-500">Mengambil teks subtitle dari database...</p>
            </div>
          ) : selectedHistoryItem ? (
            <div className="space-y-5 py-2">
              <div className="p-3 bg-slate-50 rounded-2xl border flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={() =>
                    downloadSingleFile(
                      selectedHistoryItem.original_srt,
                      `${selectedHistoryItem.title}_original_joined.srt`,
                    )
                  }
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs rounded-xl font-bold"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                  Download Original (.srt)
                </Button>
                <Button
                  onClick={() =>
                    downloadSingleFile(
                      selectedHistoryItem.translated_srt,
                      `${selectedHistoryItem.title}_translated_indonesian.srt`,
                    )
                  }
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs rounded-xl font-bold"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                  Download Indonesian (.srt)
                </Button>
                <Button
                  onClick={() =>
                    downloadBothAsZip(
                      selectedHistoryItem.title,
                      selectedHistoryItem.original_srt,
                      selectedHistoryItem.translated_srt,
                    )
                  }
                  size="sm"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-xl font-bold"
                >
                  <Archive className="w-3.5 h-3.5 mr-1.5" />
                  Download Both (.zip)
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <span className="font-bold text-slate-700">Teks Original Joined:</span>
                  <div className="p-3 bg-slate-100/70 border rounded-2xl font-mono text-[11px] max-h-60 overflow-y-auto whitespace-pre-wrap">
                    {selectedHistoryItem.original_srt}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="font-bold text-emerald-800">Teks Translated (Indonesian):</span>
                  <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-2xl font-mono text-[11px] max-h-60 overflow-y-auto whitespace-pre-wrap font-semibold">
                    {selectedHistoryItem.translated_srt}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
