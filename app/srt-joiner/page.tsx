"use client"

import type React from "react"
import { useState } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { parseSrt, formatSrt, adjustSrtTimestamps } from "@/lib/srt-utils"
import { getWavDuration } from "@/lib/audio-utils"

export default function SrtJoinerPage() {
  const [srtFiles, setSrtFiles] = useState<File[]>([])
  const [wavFiles, setWavFiles] = useState<File[]>([])
  const [joinedSrtContent, setJoinedSrtContent] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showFilenameDialog, setShowFilenameDialog] = useState<boolean>(false)
  const [filenamePrefix, setFilenamePrefix] = useState<string>("")

  const handleSrtFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSrtFiles(Array.from(event.target.files))
      setJoinedSrtContent("")
      setError(null)
      setSuccessMessage(null)
    }
  }

  const handleWavFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setWavFiles(Array.from(event.target.files))
      setJoinedSrtContent("")
      setError(null)
      setSuccessMessage(null)
    }
  }

  const handleClearAll = () => {
    setSrtFiles([])
    setWavFiles([])
    setJoinedSrtContent("")
    setLoading(false)
    setError(null)
    setSuccessMessage(null)
    setShowFilenameDialog(false)
    setFilenamePrefix("")
    const srtInput = document.getElementById("srt-files") as HTMLInputElement
    if (srtInput) srtInput.value = ""
    const wavInput = document.getElementById("wav-files") as HTMLInputElement
    if (wavInput) wavInput.value = ""
  }

  const handleJoinSrt = async () => {
    setLoading(true)
    setError(null)
    setSuccessMessage(null)
    setJoinedSrtContent("")

    if (srtFiles.length === 0) {
      setError("Please upload at least one SRT file.")
      setLoading(false)
      return
    }

    try {
      let cumulativeWavOffsetMs = 0
      const finalSrtBlocks = []
      let currentSrtIndex = 1

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

        adjustedBlocks.forEach((block) => {
          finalSrtBlocks.push({ ...block, index: currentSrtIndex++ })
        })

        if (wavFiles[i]) {
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

      const finalSrtContent = formatSrt(finalSrtBlocks)
      setJoinedSrtContent(finalSrtContent)
      setSuccessMessage("SRT files joined successfully! You can now download or copy the content.")
    } catch (err) {
      console.error("Error joining SRTs:", err)
      setError(`Failed to join SRTs: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    const filename =
      filenamePrefix && filenamePrefix.trim()
        ? `${filenamePrefix.trim()}${filenamePrefix.trim().endsWith(".srt") ? "" : ".srt"}`
        : `joined_subtitles.srt`

    const blob = new Blob([joinedSrtContent], { type: "text/plain;charset=utf-8" })
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
    <div className="min-h-screen bg-background p-4 md:p-8 lg:p-12 flex flex-col items-center">
      <h1 className="text-4xl font-bold mb-8 text-center">SRT Joiner Utility</h1>

      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>Join Multiple SRT Files</CardTitle>
          <CardDescription>
            Upload multiple SRT files in the desired order. You can also upload WAV files, where each WAV file's
            duration will be used as an offset between consecutive SRT files.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="srt-files">Upload SRT Files (select all in order)</Label>
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
          <div className="flex gap-2 w-full">
            <Button onClick={handleJoinSrt} className="flex-1" disabled={loading || srtFiles.length === 0}>
              {loading ? "Processing..." : "Join SRTs"}
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

          {joinedSrtContent && (
            <div className="space-y-2">
              <Button
                onClick={() => navigator.clipboard.writeText(joinedSrtContent)}
                variant="outline"
                className="w-full"
              >
                Copy Joined SRT
              </Button>
              <Button onClick={() => setShowFilenameDialog(true)} className="w-full mt-2">
                Download Joined SRT
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showFilenameDialog} onOpenChange={setShowFilenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Download SRT File</DialogTitle>
            <DialogDescription>Enter your custom filename</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="filename-prefix">Filename</Label>
              <Input
                id="filename-prefix"
                placeholder="e.g., my_subtitle_file.srt"
                value={filenamePrefix}
                onChange={(e) => setFilenamePrefix(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {filenamePrefix
                  ? `Will download as: ${filenamePrefix.trim().endsWith(".srt") ? filenamePrefix.trim() : filenamePrefix.trim() + ".srt"}`
                  : "Will download as: joined_subtitles.srt"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFilenameDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleDownload}>Download</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
