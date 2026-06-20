import { timeToMs, msToTime } from "./time-utils"

interface SrtBlock {
  index: number
  startTime: string
  endTime: string
  text: string
}

// Parses an SRT content string into an array of SrtBlock objects
export function parseSrt(srtContent: string): SrtBlock[] {
  const blocks: SrtBlock[] = []
  const rawBlocks = srtContent.trim().split(/\n\s*\n/)

  for (const rawBlock of rawBlocks) {
    const lines = rawBlock
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    if (lines.length < 2) continue

    const index = Number.parseInt(lines[0], 10)
    if (isNaN(index)) continue

    const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/)
    if (!timeMatch) continue

    const startTime = timeMatch[1]
    const endTime = timeMatch[2]
    const text = lines.slice(2).join("\n")

    blocks.push({ index, startTime, endTime, text })
  }
  return blocks
}

// Formats an array of SrtBlock objects back into an SRT content string
export function formatSrt(blocks: SrtBlock[]): string {
  let srtContent = ""
  blocks.forEach((block, i) => {
    srtContent += `${block.index}\n`
    srtContent += `${block.startTime} --> ${block.endTime}\n`
    srtContent += `${block.text}\n`
    if (i < blocks.length - 1) {
      srtContent += "\n"
    }
  })
  return srtContent
}

// Adjusts timestamps of SRT blocks by a given offset in milliseconds
export function adjustSrtTimestamps(blocks: SrtBlock[], offsetMs: number): SrtBlock[] {
  return blocks.map((block) => {
    const startMs = timeToMs(block.startTime) + offsetMs
    const endMs = timeToMs(block.endTime) + offsetMs
    return {
      ...block,
      startTime: msToTime(startMs),
      endTime: msToTime(endMs),
    }
  })
}
