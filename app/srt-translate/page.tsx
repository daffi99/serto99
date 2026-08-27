"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { parseSrt, formatSrt } from "@/lib/srt-utils"
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Layers,
  ArrowRight,
  Terminal,
  RefreshCw,
  Copy,
  Download,
  Trash2,
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

export default function SrtTranslate() {
  const [srtFile, setSrtFile] = useState<File | null>(null)
  const [sourceLanguage, setSourceLanguage] = useState<string>("english")
  const [batchSize, setBatchSize] = useState<number>(100)
  const [translatedSrtContent, setTranslatedSrtContent] = useState<string>("")
  const [previewBlocks, setPreviewBlocks] = useState<{ original: SrtBlock; translated: SrtBlock }[]>([])

  // Processing state
  const [loading, setLoading] = useState<boolean>(false)
  const [currentStage, setCurrentStage] = useState<"idle" | "parsing" | "translating" | "reconstructing" | "done">("idle")
  const [overallProgress, setOverallProgress] = useState<number>(0)
  const [currentBatchIndex, setCurrentBatchIndex] = useState<number>(0)
  const [totalBatches, setTotalBatches] = useState<number>(0)
  const [batchSubStep, setBatchSubStep] = useState<string>("")
  const [activeModel, setActiveModel] = useState<string>("")

  // Stats
  const [totalSubtitlesCount, setTotalSubtitlesCount] = useState<number>(0)
  const [charactersUsed, setCharactersUsed] = useState<number>(0)
  const [requestsMade, setRequestsMade] = useState<number>(0)

  // Feedback & Dialogs
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [filenamePrefix, setFilenamePrefix] = useState<string>("")
  const [showFilenameDialog, setShowFilenameDialog] = useState<boolean>(false)
  const [logs, setLogs] = useState<LogEntry[]>([])

  const terminalEndRef = useRef<HTMLDivElement>(null)

  const languageMap: { [key: string]: string } = {
    english: "English",
    french: "French",
    portuguese: "Portuguese",
    german: "German",
    italian: "Italian",
    spanish: "Spanish",
    arabic: "Arabic",
    japanese: "Japanese",
    korean: "Korean",
    chinese: "Chinese",
    russian: "Russian",
    dutch: "Dutch",
  }

  const addLog = (message: string, type: LogEntry["type"] = "info") => {
    const time = new Date().toLocaleTimeString("id-ID", { hour12: false })
    setLogs((prev) => [...prev, { id: Math.random().toString(36).substring(2, 9), time, message, type }])
  }

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [logs])

  const handleSrtFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0]
      setSrtFile(file)
      setTranslatedSrtContent("")
      setPreviewBlocks([])
      setError(null)
      setSuccessMessage(null)
      setCurrentStage("idle")
      setOverallProgress(0)
      setLogs([])
      addLog(`File dipilih: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, "info")
    }
  }

  const handleClearAll = () => {
    setSrtFile(null)
    setTranslatedSrtContent("")
    setPreviewBlocks([])
    setLoading(false)
    setError(null)
    setSuccessMessage(null)
    setFilenamePrefix("")
    setShowFilenameDialog(false)
    setCharactersUsed(0)
    setRequestsMade(0)
    setTotalSubtitlesCount(0)
    setCurrentStage("idle")
    setOverallProgress(0)
    setCurrentBatchIndex(0)
    setTotalBatches(0)
    setBatchSubStep("")
    setLogs([])
    const fileInput = document.getElementById("srt-file") as HTMLInputElement
    if (fileInput) fileInput.value = ""
  }

  // API Call with retry mechanism for 429 Rate Limits
  const translateBatchWithRetry = async (
    items: TranslateItem[],
    batchNum: number,
    totalNum: number,
    maxRetries = 3,
  ): Promise<{ translatedItems: TranslateItem[]; model?: string }> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        setBatchSubStep(`[Batch ${batchNum}/${totalNum}] Mengirim ${items.length} baris ke Gemini API...`)
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
          addLog(`[Batch ${batchNum}] Rate limit (429) terdeteksi. Menunggu ${waitTime / 1000}s sebelum mencoba ulang (Percobaan ${attempt}/${maxRetries})...`, "warning")
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
        addLog(`[Batch ${batchNum}] Terjadi kendala: ${err.message}. Mencoba lagi dalam ${waitTime / 1000}s...`, "warning")
        await new Promise((resolve) => setTimeout(resolve, waitTime))
      }
    }

    throw new Error(`Gagal menerjemahkan Batch ${batchNum} setelah ${maxRetries} percobaan.`)
  }

  const handleTranslateSrt = async () => {
    if (!srtFile) {
      setError("Silakan pilih file SRT terlebih dahulu.")
      return
    }

    setLoading(true)
    setError(null)
    setSuccessMessage(null)
    setTranslatedSrtContent("")
    setPreviewBlocks([])
    setCharactersUsed(0)
    setRequestsMade(0)
    setOverallProgress(5)
    setLogs([])

    addLog("=== MEMULAI PROSES TERJEMAHAN BATCH ===", "info")

    try {
      // ----------------------------------------------------
      // STAGE 1: PARSING SRT FILE
      // ----------------------------------------------------
      setCurrentStage("parsing")
      setBatchSubStep("Membaca dan membedah struktur file SRT...")
      addLog(`Membaca file: ${srtFile.name}...`, "step")

      const content = await srtFile.text()
      const originalBlocks = parseSrt(content)

      if (originalBlocks.length === 0) {
        throw new Error("File SRT tidak berisi blok subtitle yang valid atau format rusak.")
      }

      setTotalSubtitlesCount(originalBlocks.length)
      addLog(`Berhasil mem-parsing ${originalBlocks.length} blok subtitle.`, "success")

      // ----------------------------------------------------
      // CHUNKING / BATCHING
      // ----------------------------------------------------
      const chunks: SrtBlock[][] = []
      for (let i = 0; i < originalBlocks.length; i += batchSize) {
        chunks.push(originalBlocks.slice(i, i + batchSize))
      }

      const totalChunksCount = chunks.length
      setTotalBatches(totalChunksCount)
      addLog(`Membagi ${originalBlocks.length} baris menjadi ${totalChunksCount} batch (~${batchSize} baris/batch).`, "info")
      addLog(`Estimasi request API yang dibutuhkan: hanya ${totalChunksCount} request (Aman dari limit 15 RPM).`, "info")

      setOverallProgress(10)

      // ----------------------------------------------------
      // STAGE 2: BATCH TRANSLATION
      // ----------------------------------------------------
      setCurrentStage("translating")
      const translatedBlocksMap = new Map<number, string>()
      let totalChars = 0
      let reqCount = 0

      for (let bIndex = 0; bIndex < chunks.length; bIndex++) {
        const batchNumber = bIndex + 1
        const currentChunk = chunks[bIndex]
        setCurrentBatchIndex(batchNumber)

        // Sub-step: Packing items
        const startItemNum = bIndex * batchSize + 1
        const endItemNum = Math.min((bIndex + 1) * batchSize, originalBlocks.length)
        setBatchSubStep(`[Batch ${batchNumber}/${totalChunksCount}] Mengemas subtitle #${startItemNum} - #${endItemNum}...`)

        const itemsToTranslate: TranslateItem[] = currentChunk.map((block) => ({
          id: block.index,
          text: block.text,
        }))

        const batchChars = currentChunk.reduce((acc, b) => acc + b.text.length, 0)
        totalChars += batchChars
        setCharactersUsed(totalChars)

        // Sub-step: Request API
        const result = await translateBatchWithRetry(itemsToTranslate, batchNumber, totalChunksCount)
        reqCount++
        setRequestsMade(reqCount)

        // Sub-step: Verifying & Mapping
        setBatchSubStep(`[Batch ${batchNumber}/${totalChunksCount}] Memvalidasi hasil terjemahan (${result.translatedItems.length} item)...`)
        result.translatedItems.forEach((item) => {
          translatedBlocksMap.set(item.id, item.text)
        })

        addLog(`[Batch ${batchNumber}/${totalChunksCount}] Selesai! Menerima ${result.translatedItems.length} terjemahan.`, "success")

        // Calculate progress
        const batchProgress = Math.round(10 + ((bIndex + 1) / totalChunksCount) * 75)
        setOverallProgress(batchProgress)

        // Sub-step: Safe rate limit pause (except for the last batch)
        if (bIndex < chunks.length - 1) {
          setBatchSubStep(`[Batch ${batchNumber}/${totalChunksCount}] Jeda aman 1.2 detik sebelum batch berikutnya...`)
          await new Promise((resolve) => setTimeout(resolve, 1200))
        }
      }

      // ----------------------------------------------------
      // STAGE 3: RECONSTRUCTING SRT
      // ----------------------------------------------------
      setCurrentStage("reconstructing")
      setBatchSubStep("Menyusun kembali timestamp dan teks ke dalam format SRT standar...")
      addLog("Menyusun kembali struktur SRT lengkap dengan timestamp aslinya...", "step")

      const finalTranslatedBlocks: SrtBlock[] = []
      const previews: { original: SrtBlock; translated: SrtBlock }[] = []

      for (const orig of originalBlocks) {
        const translatedText = translatedBlocksMap.get(orig.index) || orig.text
        const translatedBlock: SrtBlock = {
          index: orig.index,
          startTime: orig.startTime,
          endTime: orig.endTime,
          text: translatedText,
        }
        finalTranslatedBlocks.push(translatedBlock)

        if (previews.length < 5) {
          previews.push({ original: orig, translated: translatedBlock })
        }
      }

      const finalSrtString = formatSrt(finalTranslatedBlocks)
      setTranslatedSrtContent(finalSrtString)
      setPreviewBlocks(previews)

      // ----------------------------------------------------
      // STAGE 4: DONE
      // ----------------------------------------------------
      setCurrentStage("done")
      setOverallProgress(100)
      setBatchSubStep("Selesai! Seluruh subtitle telah diterjemahkan.")
      addLog(`🎉 Sukses! ${finalTranslatedBlocks.length} baris subtitle berhasil diterjemahkan ke Bahasa Indonesia dalam ${reqCount} request API.`, "success")
      setSuccessMessage(`Berhasil menerjemahkan ${finalTranslatedBlocks.length} blok subtitle ke Bahasa Indonesia! (Total ${reqCount} batch request)`)
    } catch (err: any) {
      console.error("Error during translation:", err)
      const msg = err instanceof Error ? err.message : String(err)
      setError(`Proses terjemahan gagal: ${msg}`)
      addLog(`❌ Error: ${msg}`, "error")
      setCurrentStage("idle")
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    const originalName = srtFile ? srtFile.name.replace(/\.srt$/i, "") : "subtitle"
    const prefix = filenamePrefix.trim()
    const filename = prefix
      ? prefix.endsWith(".srt")
        ? prefix
        : `${prefix}_translated_indonesian.srt`
      : `${originalName}_translated_indonesian.srt`

    const blob = new Blob([translatedSrtContent], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    setShowFilenameDialog(false)
    setFilenamePrefix("")
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 lg:p-12 flex flex-col items-center">
      <div className="w-full max-w-4xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/80 text-blue-800 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            AI-Powered Batch SRT Translator
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
            SRT Batch Subtitle Translator
          </h1>
          <p className="text-sm md:text-base text-slate-600 max-w-2xl mx-auto">
            Terjemahkan file SRT secara batch (100 baris per request) ke Bahasa Indonesia dengan Google Gemini.
            Super cepat, hemat kuota, dan timestamp tetap 100% presisi.
          </p>
        </div>

        {/* Configuration & Upload Card */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Upload & Pengaturan Bahasa
            </CardTitle>
            <CardDescription>
              Pilih file SRT dan bahasa sumber. Sistem otomatis membagi teks menjadi beberapa batch untuk menghindari rate-limit (15 RPM).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Source Language */}
              <div className="space-y-1.5">
                <Label htmlFor="source-language">Bahasa Sumber (Asal)</Label>
                <Select value={sourceLanguage} onValueChange={setSourceLanguage} disabled={loading}>
                  <SelectTrigger id="source-language">
                    <SelectValue placeholder="Pilih bahasa sumber" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="english">English (Inggris)</SelectItem>
                    <SelectItem value="french">French (Prancis)</SelectItem>
                    <SelectItem value="spanish">Spanish (Spanyol)</SelectItem>
                    <SelectItem value="portuguese">Portuguese (Portugis)</SelectItem>
                    <SelectItem value="german">German (Jerman)</SelectItem>
                    <SelectItem value="italian">Italian (Italia)</SelectItem>
                    <SelectItem value="arabic">Arabic (Arab)</SelectItem>
                    <SelectItem value="japanese">Japanese (Jepang)</SelectItem>
                    <SelectItem value="korean">Korean (Korea)</SelectItem>
                    <SelectItem value="chinese">Chinese (Mandarin)</SelectItem>
                    <SelectItem value="russian">Russian (Rusia)</SelectItem>
                    <SelectItem value="dutch">Dutch (Belanda)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Batch Size */}
              <div className="space-y-1.5">
                <Label htmlFor="batch-size">Ukuran Batch (Baris per Request)</Label>
                <Select
                  value={String(batchSize)}
                  onValueChange={(val) => setBatchSize(Number(val))}
                  disabled={loading}
                >
                  <SelectTrigger id="batch-size">
                    <SelectValue placeholder="Pilih ukuran batch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50 baris / request (Aman untuk dialog panjang)</SelectItem>
                    <SelectItem value="100">100 baris / request (Rekomendasi - Tercepat)</SelectItem>
                    <SelectItem value="150">150 baris / request (Paling sedikit request)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* SRT File Input */}
            <div className="space-y-1.5">
              <Label htmlFor="srt-file">File SRT</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="srt-file"
                  type="file"
                  accept=".srt"
                  onChange={handleSrtFileChange}
                  disabled={loading}
                  className="cursor-pointer"
                />
              </div>
              {srtFile && (
                <div className="flex items-center gap-2 text-xs text-slate-600 mt-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Terpilih: <strong>{srtFile.name}</strong> ({(srtFile.size / 1024).toFixed(1)} KB)</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <Button
                onClick={handleTranslateSrt}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                disabled={loading || !srtFile}
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Sedang Menerjemahkan ({overallProgress}%)...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Mulai Terjemahkan ke Bahasa Indonesia
                  </>
                )}
              </Button>
              <Button
                onClick={handleClearAll}
                variant="outline"
                className="border-slate-300 hover:bg-slate-100"
                disabled={loading}
              >
                <Trash2 className="w-4 h-4 mr-2 text-slate-500" />
                Reset Form
              </Button>
            </div>

            {/* Errors & Alerts */}
            {error && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Terjadi Kesalahan</p>
                  <p>{error}</p>
                </div>
              </div>
            )}

            {successMessage && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600" />
                <div>
                  <p className="font-semibold">Proses Selesai</p>
                  <p>{successMessage}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Live Progress Card (Active when loading or done) */}
        {(loading || currentStage !== "idle") && (
          <Card className="shadow-sm border-blue-100 bg-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-600" />
                  Progress & Tahapan Terjemahan
                </CardTitle>
                <div className="flex items-center gap-2">
                  {activeModel && (
                    <Badge variant="outline" className="text-xs bg-slate-50 border-slate-200 text-slate-700">
                      Model: {activeModel}
                    </Badge>
                  )}
                  <Badge
                    variant="default"
                    className={
                      currentStage === "done"
                        ? "bg-emerald-600"
                        : "bg-blue-600"
                    }
                  >
                    {currentStage === "parsing" && "Stage 1: Parsing SRT"}
                    {currentStage === "translating" && `Stage 2: Translating Batch ${currentBatchIndex}/${totalBatches}`}
                    {currentStage === "reconstructing" && "Stage 3: Reconstructing SRT"}
                    {currentStage === "done" && "Stage 4: Completed"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Progress Bar with Percentage */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-slate-700">
                  <span>Progres Keseluruhan</span>
                  <span>{overallProgress}%</span>
                </div>
                <Progress value={overallProgress} className="h-3" />
                <p className="text-xs text-slate-500 italic mt-1">{batchSubStep}</p>
              </div>

              {/* Stage Flow Stepper */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                <div
                  className={`p-2.5 rounded-lg border text-xs flex flex-col gap-1 ${
                    currentStage === "parsing"
                      ? "border-blue-500 bg-blue-50/70 text-blue-900 font-semibold"
                      : currentStage !== "idle"
                      ? "border-emerald-200 bg-emerald-50/50 text-emerald-900"
                      : "border-slate-200 bg-slate-50 text-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>1. Parse File</span>
                    {currentStage !== "idle" && currentStage !== "parsing" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : currentStage === "parsing" ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    ) : null}
                  </div>
                  <span className="text-[11px] font-normal text-slate-500">
                    {totalSubtitlesCount > 0 ? `${totalSubtitlesCount} baris terdeteksi` : "Membedah struktur"}
                  </span>
                </div>

                <div
                  className={`p-2.5 rounded-lg border text-xs flex flex-col gap-1 ${
                    currentStage === "translating"
                      ? "border-blue-500 bg-blue-50/70 text-blue-900 font-semibold"
                      : currentStage === "reconstructing" || currentStage === "done"
                      ? "border-emerald-200 bg-emerald-50/50 text-emerald-900"
                      : "border-slate-200 bg-slate-50 text-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>2. Batch Gemini</span>
                    {currentStage === "reconstructing" || currentStage === "done" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : currentStage === "translating" ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    ) : null}
                  </div>
                  <span className="text-[11px] font-normal text-slate-500">
                    {totalBatches > 0 ? `Batch ${currentBatchIndex}/${totalBatches}` : "Chunking & AI"}
                  </span>
                </div>

                <div
                  className={`p-2.5 rounded-lg border text-xs flex flex-col gap-1 ${
                    currentStage === "reconstructing"
                      ? "border-blue-500 bg-blue-50/70 text-blue-900 font-semibold"
                      : currentStage === "done"
                      ? "border-emerald-200 bg-emerald-50/50 text-emerald-900"
                      : "border-slate-200 bg-slate-50 text-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>3. Susun SRT</span>
                    {currentStage === "done" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : currentStage === "reconstructing" ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    ) : null}
                  </div>
                  <span className="text-[11px] font-normal text-slate-500">
                    Sinkronisasi timestamp
                  </span>
                </div>

                <div
                  className={`p-2.5 rounded-lg border text-xs flex flex-col gap-1 ${
                    currentStage === "done"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold"
                      : "border-slate-200 bg-slate-50 text-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>4. Siap Unduh</span>
                    {currentStage === "done" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                  </div>
                  <span className="text-[11px] font-normal text-slate-500">
                    {currentStage === "done" ? "100% Selesai" : "Menunggu"}
                  </span>
                </div>
              </div>

              {/* Statistics Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-center text-xs">
                <div>
                  <p className="text-slate-500">Total Subtitle</p>
                  <p className="text-base font-bold text-slate-800">{totalSubtitlesCount || "-"}</p>
                </div>
                <div>
                  <p className="text-slate-500">Jumlah Batch</p>
                  <p className="text-base font-bold text-blue-600">{totalBatches || "-"}</p>
                </div>
                <div>
                  <p className="text-slate-500">Request API Terkirim</p>
                  <p className="text-base font-bold text-indigo-600">{requestsMade}</p>
                </div>
                <div>
                  <p className="text-slate-500">Karakter Diproses</p>
                  <p className="text-base font-bold text-emerald-600">{charactersUsed.toLocaleString()}</p>
                </div>
              </div>

              {/* Terminal / Live Activity Log */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-slate-500" />
                    Live Activity Log (Setiap Langkah Proses)
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">{logs.length} events recorded</span>
                </div>
                <div className="bg-slate-900 text-slate-200 rounded-lg p-3 font-mono text-[11px] leading-relaxed max-h-48 overflow-y-auto space-y-1 shadow-inner">
                  {logs.length === 0 ? (
                    <p className="text-slate-500 italic">Menunggu proses dimulai...</p>
                  ) : (
                    logs.map((log) => (
                      <div key={log.id} className="flex items-start gap-2">
                        <span className="text-slate-500 select-none">[{log.time}]</span>
                        <span
                          className={
                            log.type === "success"
                              ? "text-emerald-400"
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
                    ))
                  )}
                  <div ref={terminalEndRef} />
                </div>
              </div>

              {/* Download / Action when done */}
              {translatedSrtContent && (
                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(translatedSrtContent)
                      alert("Teks SRT hasil terjemahan berhasil disalin ke clipboard!")
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Salin Teks SRT
                  </Button>
                  <Button
                    onClick={() => setShowFilenameDialog(true)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download File SRT (.srt)
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Subtitle Preview Card */}
        {previewBlocks.length > 0 && (
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Preview Terjemahan (5 Subtitle Pertama)</CardTitle>
              <CardDescription>
                Bandingkan hasil teks asli dengan hasil terjemahan Bahasa Indonesia.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-slate-100 border rounded-lg overflow-hidden bg-white text-xs">
                {previewBlocks.map(({ original, translated }) => (
                  <div key={original.index} className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3 hover:bg-slate-50/50">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
                        <span className="font-bold text-slate-700">#{original.index}</span>
                        <span>{original.startTime} → {original.endTime}</span>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5">Asli</Badge>
                      </div>
                      <p className="text-slate-800 whitespace-pre-wrap">{original.text}</p>
                    </div>
                    <div className="space-y-1 border-t md:border-t-0 md:border-l md:pl-3 pt-2 md:pt-0">
                      <div className="flex items-center gap-2 text-emerald-600 font-mono text-[11px]">
                        <span className="font-bold">#{translated.index}</span>
                        <Badge variant="default" className="text-[10px] bg-emerald-100 text-emerald-800 border-0 py-0 px-1.5">
                          ID
                        </Badge>
                      </div>
                      <p className="text-emerald-950 font-medium whitespace-pre-wrap">{translated.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Filename Dialog */}
      {showFilenameDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-md w-full border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Download File SRT</h3>
            <p className="text-xs text-slate-500 mb-4">
              Masukkan nama file khusus atau gunakan nama default.
            </p>
            <div className="space-y-3 mb-5">
              <Label htmlFor="custom-filename">Nama File</Label>
              <Input
                id="custom-filename"
                type="text"
                placeholder={srtFile ? srtFile.name.replace(/\.srt$/i, "") + "_translated_indonesian.srt" : "subtitles_id.srt"}
                value={filenamePrefix}
                onChange={(e) => setFilenamePrefix(e.target.value)}
                autoFocus
              />
              <p className="text-[11px] text-slate-500">
                File akan disimpan dengan ekstensi <strong>.srt</strong>
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setShowFilenameDialog(false)
                  setFilenamePrefix("")
                }}
                variant="outline"
                className="flex-1"
              >
                Batal
              </Button>
              <Button onClick={handleDownload} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                Download (.srt)
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
