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

export default function SrtTranslate() {
  const [srtFile, setSrtFile] = useState<File | null>(null)
  const [sourceLanguage, setSourceLanguage] = useState<string>("french")
  const [translatedSrtContent, setTranslatedSrtContent] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [filenamePrefix, setFilenamePrefix] = useState<string>("")
  const [showFilenameDialog, setShowFilenameDialog] = useState<boolean>(false)
  const [charactersUsed, setCharactersUsed] = useState<number>(0)

  const languageMap: { [key: string]: string } = {
    french: "French",
    portuguese: "Portuguese",
    german: "German",
    italian: "Italian",
    spanish: "Spanish",
  }

  const handleSrtFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSrtFile(event.target.files[0])
      setTranslatedSrtContent("")
      setError(null)
      setSuccessMessage(null)
      setCharactersUsed(0)
    }
  }

  const handleClearAll = () => {
    setSrtFile(null)
    setTranslatedSrtContent("")
    setLoading(false)
    setError(null)
    setSuccessMessage(null)
    setFilenamePrefix("")
    setShowFilenameDialog(false)
    setCharactersUsed(0)
    const fileInput = document.getElementById("srt-file") as HTMLInputElement
    if (fileInput) fileInput.value = ""
  }

  const translateTextWithGemini = async (text: string): Promise<string> => {
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        sourceLanguage: languageMap[sourceLanguage],
        targetLanguage: "Indonesian",
      }),
    })

    if (!response.ok) {
      throw new Error(`Translation API error: ${response.status}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(data.error)
    }

    return data.translatedText
  }

  const handleTranslateSrt = async () => {
    setLoading(true)
    setError(null)
    setSuccessMessage(null)
    setTranslatedSrtContent("")
    setCharactersUsed(0)

    if (!srtFile) {
      setError("Please upload an SRT file.")
      setLoading(false)
      return
    }

    try {
      const content = await srtFile.text()
      const blocks = parseSrt(content)

      if (blocks.length === 0) {
        setError("SRT file contains no valid subtitle blocks.")
        setLoading(false)
        return
      }

      let totalCharactersUsed = 0
      const translatedBlocks: SrtBlock[] = []

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i]
        const textToTranslate = block.text

        console.log(`[v0] Translating subtitle ${i + 1}/${blocks.length}`)

        try {
          const translatedText = await translateTextWithGemini(textToTranslate)
          totalCharactersUsed += textToTranslate.length

          translatedBlocks.push({
            index: block.index,
            startTime: block.startTime,
            endTime: block.endTime,
            text: translatedText,
          })

          // Rate limiting: wait 200ms between requests
          await new Promise((resolve) => setTimeout(resolve, 200))
        } catch (translationError) {
          console.error(`[v0] Translation error for subtitle ${i + 1}:`, translationError)
          setError(
            `Failed to translate subtitle ${i + 1}: ${translationError instanceof Error ? translationError.message : String(translationError)}`,
          )
          setLoading(false)
          return
        }
      }

      const finalSrtContent = formatSrt(translatedBlocks)
      setTranslatedSrtContent(finalSrtContent)
      setCharactersUsed(totalCharactersUsed)
      setSuccessMessage(`Successfully translated ${translatedBlocks.length} subtitles to Indonesian!`)
    } catch (err) {
      console.error("Error translating SRT:", err)
      setError(`Failed to translate SRT: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 lg:p-12 flex flex-col items-center">
      <h1 className="text-4xl font-bold mb-8 text-center">SRT Translate</h1>

      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>Translate SRT Files to Indonesian</CardTitle>
          <CardDescription>
            Upload an SRT file in French, Portuguese, German, Italian, or Spanish. It will be translated to Indonesian
            using Gemini Pro API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="source-language">Source Language</Label>
            <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
              <SelectTrigger>
                <SelectValue placeholder="Select source language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="french">French</SelectItem>
                <SelectItem value="portuguese">Portuguese</SelectItem>
                <SelectItem value="german">German</SelectItem>
                <SelectItem value="italian">Italian</SelectItem>
                <SelectItem value="spanish">Spanish</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="srt-file">Upload SRT File</Label>
            <Input id="srt-file" type="file" accept=".srt" onChange={handleSrtFileChange} />
            {srtFile && <p className="text-sm text-muted-foreground">Selected: {srtFile.name}</p>}
          </div>

          {charactersUsed > 0 && (
            <div className="text-sm text-blue-600 p-2 bg-blue-50 rounded-md">
              Translation API Usage: {charactersUsed} characters processed
            </div>
          )}

          <div className="flex gap-2 w-full">
            <Button onClick={handleTranslateSrt} className="flex-1" disabled={loading || !srtFile}>
              {loading ? "Translating..." : "Translate to Indonesian"}
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

          {translatedSrtContent && (
            <div className="space-y-2">
              <Button
                onClick={() => navigator.clipboard.writeText(translatedSrtContent)}
                variant="outline"
                className="w-full"
              >
                Copy Translated SRT
              </Button>
              <Button onClick={() => setShowFilenameDialog(true)} className="w-full mt-2">
                Download Translated SRT
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
                    const filename = `${filenamePrefix.trim()}_translated_indonesian.srt`
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
