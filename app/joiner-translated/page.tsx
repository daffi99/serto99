"use client"

import type React from "react"
import { useState } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { parseSrt, formatSrt } from "@/lib/srt-utils"

interface SrtBlock {
  index: number
  startTime: string
  endTime: string
  text: string
}

export default function JoinerTranslated() {
  const [originalSrtFile, setOriginalSrtFile] = useState<File | null>(null)
  const [translatedSrtFile, setTranslatedSrtFile] = useState<File | null>(null)
  const [combinedSrtContent, setCombinedSrtContent] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [filenamePrefix, setFilenamePrefix] = useState<string>("")
  const [showFilenameDialog, setShowFilenameDialog] = useState<boolean>(false)
  const [splitMode, setSplitMode] = useState<string>("auto") // auto, half, custom

  const handleOriginalSrtChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setOriginalSrtFile(event.target.files[0])
      setCombinedSrtContent("")
      setError(null)
      setSuccessMessage(null)
    }
  }

  const handleTranslatedSrtChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setTranslatedSrtFile(event.target.files[0])
      setCombinedSrtContent("")
      setError(null)
      setSuccessMessage(null)
    }
  }

  const handleClearAll = () => {
    setOriginalSrtFile(null)
    setTranslatedSrtFile(null)
    setCombinedSrtContent("")
    setLoading(false)
    setError(null)
    setSuccessMessage(null)
    setFilenamePrefix("")
    setShowFilenameDialog(false)
    setSplitMode("auto")
    // Reset file inputs
    const originalInput = document.getElementById("original-srt") as HTMLInputElement
    if (originalInput) originalInput.value = ""
    const translatedInput = document.getElementById("translated-srt") as HTMLInputElement
    if (translatedInput) translatedInput.value = ""
  }

  const splitOriginalLines = (originalText: string): { arabicLines: string[]; transliterationLines: string[] } => {
    const lines = originalText.split("\n").filter((line) => line.trim() !== "")

    if (splitMode === "half") {
      // Split exactly in half
      const midPoint = Math.ceil(lines.length / 2)
      return {
        arabicLines: lines.slice(0, midPoint),
        transliterationLines: lines.slice(midPoint),
      }
    } else {
      // Auto mode: assume alternating or equal halves
      if (lines.length === 2) {
        return {
          arabicLines: [lines[0]],
          transliterationLines: [lines[1]],
        }
      } else if (lines.length === 4) {
        return {
          arabicLines: [lines[0], lines[1]],
          transliterationLines: [lines[2], lines[3]],
        }
      } else if (lines.length % 2 === 0) {
        // Even number of lines - split in half
        const midPoint = lines.length / 2
        return {
          arabicLines: lines.slice(0, midPoint),
          transliterationLines: lines.slice(midPoint),
        }
      } else {
        // Odd number - assume first half+1 is Arabic, rest is transliteration
        const midPoint = Math.ceil(lines.length / 2)
        return {
          arabicLines: lines.slice(0, midPoint),
          transliterationLines: lines.slice(midPoint),
        }
      }
    }
  }

  const handleCombineSrts = async () => {
    setLoading(true)
    setError(null)
    setSuccessMessage(null)
    setCombinedSrtContent("")

    if (!originalSrtFile || !translatedSrtFile) {
      setError("Please upload both original and translated SRT files.")
      setLoading(false)
      return
    }

    try {
      // Read both files
      const originalContent = await originalSrtFile.text()
      const translatedContent = await translatedSrtFile.text()

      // Parse both SRT files
      const originalBlocks = parseSrt(originalContent)
      const translatedBlocks = parseSrt(translatedContent)

      if (originalBlocks.length === 0) {
        setError("Original SRT file contains no valid subtitle blocks.")
        setLoading(false)
        return
      }

      if (translatedBlocks.length === 0) {
        setError("Translated SRT file contains no valid subtitle blocks.")
        setLoading(false)
        return
      }

      if (originalBlocks.length !== translatedBlocks.length) {
        setError(
          `Subtitle count mismatch: Original has ${originalBlocks.length} subtitles, Translated has ${translatedBlocks.length} subtitles.`,
        )
        setLoading(false)
        return
      }

      // Combine the subtitles
      const combinedBlocks: SrtBlock[] = []

      for (let i = 0; i < originalBlocks.length; i++) {
        const originalBlock = originalBlocks[i]
        const translatedBlock = translatedBlocks[i]

        // Split original text into Arabic and transliteration
        const { arabicLines, transliterationLines } = splitOriginalLines(originalBlock.text)

        // Get Indonesian translation lines
        const indonesianLines = translatedBlock.text.split("\n").filter((line) => line.trim() !== "")

        // Combine all lines
        const allLines = [...arabicLines, ...transliterationLines, ...indonesianLines]
        const combinedText = allLines.join("\n")

        combinedBlocks.push({
          index: originalBlock.index,
          startTime: originalBlock.startTime,
          endTime: originalBlock.endTime,
          text: combinedText,
        })
      }

      const finalSrtContent = formatSrt(combinedBlocks)
      setCombinedSrtContent(finalSrtContent)
      setSuccessMessage(
        `Successfully combined ${combinedBlocks.length} subtitles with Arabic, transliteration, and Indonesian translation.`,
      )
    } catch (err) {
      console.error("Error combining SRTs:", err)
      setError(`Failed to combine SRTs: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 lg:p-12 flex flex-col items-center">
      <h1 className="text-4xl font-bold mb-8 text-center">Joiner Translated</h1>

      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>Combine Original & Translated SRT Files</CardTitle>
          <CardDescription>
            Upload your original SRT file (Arabic + transliteration) and translated SRT file (Indonesian). The output
            will combine them with Arabic lines first, then transliteration lines, then Indonesian translation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="original-srt">Original SRT File (Arabic + Transliteration)</Label>
            <Input id="original-srt" type="file" accept=".srt" onChange={handleOriginalSrtChange} />
            {originalSrtFile && <p className="text-sm text-muted-foreground">Selected: {originalSrtFile.name}</p>}
          </div>

          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="translated-srt">Translated SRT File (Indonesian)</Label>
            <Input id="translated-srt" type="file" accept=".srt" onChange={handleTranslatedSrtChange} />
            {translatedSrtFile && <p className="text-sm text-muted-foreground">Selected: {translatedSrtFile.name}</p>}
          </div>

          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="split-mode">Line Split Mode</Label>
            <Select value={splitMode} onValueChange={setSplitMode}>
              <SelectTrigger>
                <SelectValue placeholder="Select how to split original lines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (Smart Detection)</SelectItem>
                <SelectItem value="half">Half Split (Equal Halves)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Auto: 2 lines → 1+1, 4 lines → 2+2, etc. | Half: Always split exactly in half
            </p>
          </div>

          <div className="flex gap-2 w-full">
            <Button
              onClick={handleCombineSrts}
              className="flex-1"
              disabled={loading || !originalSrtFile || !translatedSrtFile}
            >
              {loading ? "Combining..." : "Combine SRTs"}
            </Button>
            <Button onClick={handleClearAll} variant="outline" className="flex-1 bg-transparent" disabled={loading}>
              Clear All
            </Button>
          </div>

          {error && (
            <div className="text-red-500 text-sm mt-4 p-3 bg-red-50 rounded-md border border-red-200">
              Error: {error}
            </div>
          )}

          {successMessage && (
            <div className="text-green-600 text-sm mt-4 p-3 bg-green-50 rounded-md border border-green-200">
              {successMessage}
            </div>
          )}

          {combinedSrtContent && (
            <div className="space-y-2">
              <Button
                onClick={() => navigator.clipboard.writeText(combinedSrtContent)}
                variant="outline"
                className="w-full"
              >
                Copy Combined SRT
              </Button>
              <Button onClick={() => setShowFilenameDialog(true)} className="w-full mt-2">
                Download Combined SRT
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {showFilenameDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Enter Filename Prefix</h3>
            <Input
              type="text"
              placeholder="e.g., 004"
              value={filenamePrefix}
              onChange={(e) => setFilenamePrefix(e.target.value)}
              className="mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  if (filenamePrefix.trim()) {
                    const filename = `Arab_${filenamePrefix.trim()}_combined_translated.srt`
                    const blob = new Blob([combinedSrtContent], { type: "text/plain;charset=utf-8" })
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
                }}
                className="flex-1"
                disabled={!filenamePrefix.trim()}
              >
                Download
              </Button>
              <Button
                onClick={() => {
                  setShowFilenameDialog(false)
                  setFilenamePrefix("")
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
