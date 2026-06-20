"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface DialogState {
  isOpen: boolean
  filename: string
}

export default function SrtLbInsertPage() {
  const [files, setFiles] = useState<File[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [processedContent, setProcessedContent] = useState<string>("")
  const [dialog, setDialog] = useState<DialogState>({ isOpen: false, filename: "" })
  const [error, setError] = useState<string>("")
  const [successMessage, setSuccessMessage] = useState<string>("")

  // Detect and fix missing line breaks in SRT
  function fixSrtLineBreaks(srtContent: string): string {
    const lines = srtContent.split("\n")
    const fixedLines: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const currentLine = lines[i]
      const currentTrimmed = currentLine.trim()
      const nextTrimmed = i + 1 < lines.length ? lines[i + 1].trim() : ""

      fixedLines.push(currentLine)

      // Check if current line is a subtitle number (only digits)
      const isCurrentLineNumber = /^\d+$/.test(currentTrimmed)

      // Check if current line is a timestamp (contains -->)
      const isCurrentLineTimestamp = currentTrimmed.includes("-->")

      // Check if next line is a subtitle number (only digits)
      const isNextLineNumber = /^\d+$/.test(nextTrimmed)

      // Current line is text if it's not empty, not a number, and not a timestamp
      const isCurrentLineText = currentTrimmed.length > 0 && !isCurrentLineNumber && !isCurrentLineTimestamp

      // If current line is text and next line is a number, insert blank line
      if (isCurrentLineText && isNextLineNumber) {
        fixedLines.push("")
      }
    }

    return fixedLines.join("\n")
  }

  async function handleProcessSrt() {
    if (files.length === 0) {
      setError("Please select an SRT file")
      return
    }

    setIsProcessing(true)
    setError("")
    setSuccessMessage("")

    try {
      const file = files[0]
      const content = await file.text()
      const fixed = fixSrtLineBreaks(content)
      setProcessedContent(fixed)
      setSuccessMessage("Line breaks fixed successfully!")
    } catch (err) {
      setError(`Error processing file: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setIsProcessing(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
      setError("")
    }
  }

  function handleDownload() {
    if (!processedContent || files.length === 0) {
      setError("No processed content to download")
      return
    }

    const originalFile = files[0]
    const originalName = originalFile.name.replace(".srt", "")
    const filename = `${dialog.filename || originalName}_fixLB.srt`

    const blob = new Blob([processedContent], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>SRT Line Break Insert</CardTitle>
          <CardDescription>
            Detect and fix missing line breaks between subtitle text and the next subtitle number
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Upload */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Upload SRT File</label>
            <input
              type="file"
              accept=".srt"
              multiple={false}
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {files.length > 0 && <p className="text-sm text-green-600">✓ {files[0].name} selected</p>}
          </div>

          {/* Error Message */}
          {error && <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>}

          {/* Success Message */}
          {successMessage && <div className="rounded-md bg-green-50 p-4 text-sm text-green-700">{successMessage}</div>}

          {/* Process Button */}
          <Button onClick={handleProcessSrt} disabled={files.length === 0 || isProcessing} className="w-full">
            {isProcessing ? "Processing..." : "Fix Line Breaks"}
          </Button>

          {/* Preview */}
          {processedContent && (
            <div className="space-y-2">
              <label className="block text-sm font-medium">Preview (First 500 characters)</label>
              <div className="rounded-md border bg-slate-50 p-4 font-mono text-sm max-h-64 overflow-y-auto whitespace-pre-wrap break-words">
                {processedContent.substring(0, 500)}
                {processedContent.length > 500 && "..."}
              </div>
            </div>
          )}

          {/* Download Button */}
          {processedContent && (
            <Button onClick={() => setDialog({ isOpen: true, filename: "" })} variant="default" className="w-full">
              Download Processed SRT
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Custom Filename Dialog */}
      {dialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle>Download File</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium">Filename</label>
                <input
                  type="text"
                  value={dialog.filename}
                  onChange={(e) => setDialog({ ...dialog, filename: e.target.value })}
                  placeholder="fixed_subtitles"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <p className="text-xs text-slate-500">Final filename: {dialog.filename || "fixed_subtitles"}.srt</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setDialog({ isOpen: false, filename: "" })} variant="outline" className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleDownload} className="flex-1">
                  Download
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
