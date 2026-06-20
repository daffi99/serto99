"use client"

import type React from "react"
import { useState } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { parseSrt, formatSrt, adjustSrtTimestamps } from "@/lib/srt-utils"
import { getWavDuration } from "@/lib/audio-utils"
import {
  extractArabicText,
  transliterateArabic,
  // translateArabicToIndonesian,
  replaceArabicInText,
} from "@/lib/arabic-utils"

export default function ArabicTranslator() {
  const [srtFiles, setSrtFiles] = useState<File[]>([])
  const [wavFiles, setWavFiles] = useState<File[]>([])
  const [processedSrtContent, setProcessedSrtContent] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  // const [charactersUsed, setCharactersUsed] = useState<number>(0)
  const [processingStatus, setProcessingStatus] = useState<string>("")
  const [filenamePrefix, setFilenamePrefix] = useState<string>("")
  const [showFilenameDialog, setShowFilenameDialog] = useState<boolean>(false)

  const handleSrtFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSrtFiles(Array.from(event.target.files))
      setProcessedSrtContent("")
      setError(null)
      setSuccessMessage(null)
      // setCharactersUsed(0)
      setProcessingStatus("")
    }
  }

  const handleWavFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setWavFiles(Array.from(event.target.files))
      setProcessedSrtContent("")
      setError(null)
      setSuccessMessage(null)
      // setCharactersUsed(0)
      setProcessingStatus("")
    }
  }

  const handleClearAll = () => {
    setSrtFiles([])
    setWavFiles([])
    setProcessedSrtContent("")
    setLoading(false)
    setError(null)
    setSuccessMessage(null)
    // setCharactersUsed(0)
    setProcessingStatus("")
    setFilenamePrefix("")
    setShowFilenameDialog(false)
    // Reset file inputs
    const srtInput = document.getElementById("srt-files") as HTMLInputElement
    if (srtInput) srtInput.value = ""
    const wavInput = document.getElementById("wav-files") as HTMLInputElement
    if (wavInput) wavInput.value = ""
  }

  const handleProcessArabicSrt = async () => {
    setLoading(true)
    setError(null)
    setSuccessMessage(null)
    setProcessedSrtContent("")
    // setCharactersUsed(0)
    setProcessingStatus("Starting processing...")

    if (srtFiles.length === 0) {
      setError("Please upload at least one SRT file.")
      setLoading(false)
      return
    }

    try {
      let cumulativeWavOffsetMs = 0
      const finalSrtBlocks = []
      let currentSrtIndex = 1
      // let totalCharactersUsed = 0
      let processedBlocks = 0

      setProcessingStatus("Parsing SRT files...")

      for (let i = 0; i < srtFiles.length; i++) {
        const file = srtFiles[i]
        const content = await file.text()
        const blocks = parseSrt(content)

        if (blocks.length === 0) {
          console.warn(`SRT file ${file.name} contains no valid subtitle blocks and will be skipped.`)
          continue
        }

        const offsetForCurrentSrt = cumulativeWavOffsetMs
        const adjustedBlocks = adjustSrtTimestamps(blocks, offsetForCurrentSrt)

        setProcessingStatus(`Processing file ${i + 1}/${srtFiles.length}: ${file.name}`)

        // Process each block for Arabic transliteration only
        for (const block of adjustedBlocks) {
          processedBlocks++
          setProcessingStatus(`Processing subtitle ${processedBlocks}/${adjustedBlocks.length} in ${file.name}`)

          const originalText = block.text
          const arabicText = extractArabicText(originalText)

          if (arabicText.length > 0) {
            // Count characters for API usage tracking
            // const arabicCharCount = arabicText.join("").length
            // totalCharactersUsed += arabicCharCount

            // Transliterate Arabic to Latin (ALA-LC)
            const transliteratedText = replaceArabicInText(originalText, arabicText.map(transliterateArabic))

            // Create 2-line subtitle (original + transliteration only)
            const multiLineText = `${originalText}\n${transliteratedText}`

            finalSrtBlocks.push({ ...block, index: currentSrtIndex++, text: multiLineText })
          } else {
            // No Arabic text, keep original
            finalSrtBlocks.push({ ...block, index: currentSrtIndex++ })
          }
        }

        if (wavFiles[i]) {
          setProcessingStatus(`Processing WAV file: ${wavFiles[i].name}`)
          try {
            const wavDuration = await getWavDuration(wavFiles[i])
            cumulativeWavOffsetMs += wavDuration
            console.log(`WAV file ${wavFiles[i].name} duration: ${wavDuration} ms added to cumulative offset.`)
          } catch (wavError) {
            console.warn(
              `Could not get WAV duration for ${wavFiles[i].name}. Proceeding without this WAV offset.`,
              wavError,
            )
          }
        }
      }

      setProcessingStatus("Finalizing SRT content...")
      const finalSrtContent = formatSrt(finalSrtBlocks)
      setProcessedSrtContent(finalSrtContent)
      // setCharactersUsed(totalCharactersUsed)
      setProcessingStatus("")
      setSuccessMessage(
        `Arabic SRT files processed successfully! Processed ${finalSrtBlocks.length} subtitles with transliteration.`,
      )
    } catch (err) {
      console.error("Error processing Arabic SRTs:", err)
      setError(`Failed to process Arabic SRTs: ${err instanceof Error ? err.message : String(err)}`)
      setProcessingStatus("")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 lg:p-12 flex flex-col items-center">
      <h1 className="text-4xl font-bold mb-8 text-center">Arabic SRT Translator</h1>

      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>Join & Translate Arabic SRT Files</CardTitle>
          <CardDescription>
            Upload Arabic SRT files and WAV files. Each subtitle will show: Original Arabic and ALA-LC transliteration
            only. Translation is not available due to API restrictions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="srt-files">Upload Arabic SRT Files (select all in order)</Label>
            <Input id="srt-files" type="file" accept=".srt" multiple onChange={handleSrtFilesChange} />
            {srtFiles.length > 0 && (
              <p className="text-sm text-muted-foreground">Selected: {srtFiles.map((f) => f.name).join(", ")}</p>
            )}
          </div>
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="wav-files">Upload WAV Files (one for each SRT, in order)</Label>
            <Input id="wav-files" type="file" accept=".wav" multiple onChange={handleWavFilesChange} />
            {wavFiles.length > 0 && (
              <p className="text-sm text-muted-foreground">Selected: {wavFiles.map((f) => f.name).join(", ")}</p>
            )}
          </div>

          {/* {charactersUsed > 0 && (
            <div className="text-sm text-blue-600 p-2 bg-blue-50 rounded-md">
              Translation API Usage: {charactersUsed} / 5,000 characters used today
            </div>
          )} */}

          {processingStatus && (
            <div className="text-sm text-orange-600 p-2 bg-orange-50 rounded-md">Status: {processingStatus}</div>
          )}

          <div className="flex gap-2 w-full">
            <Button onClick={handleProcessArabicSrt} className="flex-1" disabled={loading || srtFiles.length === 0}>
              {loading ? "Processing..." : "Process Arabic SRTs"}
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

          {processedSrtContent && (
            <div className="space-y-2">
              <Button
                onClick={() => navigator.clipboard.writeText(processedSrtContent)}
                variant="outline"
                className="w-full"
              >
                Copy Processed SRT
              </Button>
              <Button onClick={() => setShowFilenameDialog(true)} className="w-full mt-2">
                Download Processed SRT
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
                    // Generate filename based on SRT files
                    const generateFilename = () => {
                      if (srtFiles.length === 0) return "arabic_transliteration.srt"

                      // Extract numbers from filenames
                      const numbers = srtFiles
                        .map((file) => {
                          const match = file.name.match(/(\d+)/)
                          return match ? Number.parseInt(match[1], 10) : null
                        })
                        .filter((num) => num !== null)
                        .sort((a, b) => a! - b!)

                      if (numbers.length === 0) {
                        return `Arab_${filenamePrefix.trim()}_transliteration.srt`
                      }

                      const min = numbers[0]!.toString().padStart(3, "0")
                      const max = numbers[numbers.length - 1]!.toString().padStart(3, "0")
                      const range = min === max ? min : `${min}-${max}`

                      return `Arab_${filenamePrefix.trim()}_${range}_transliteration.srt`
                    }

                    const filename = generateFilename()
                    const blob = new Blob([processedSrtContent], { type: "text/plain;charset=utf-8" })
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
