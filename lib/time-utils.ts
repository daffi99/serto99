// Helper to convert HH:MM:SS,ms to milliseconds
export function timeToMs(timeString: string): number {
  const [time, ms] = timeString.split(",")
  const [hours, minutes, seconds] = time.split(":").map(Number)
  // Ensure milliseconds part is parsed correctly, even if it has more than 3 digits or a decimal
  const milliseconds = Number.parseFloat(ms) || 0 // Use parseFloat to handle decimals

  return hours * 3600000 + minutes * 60000 + seconds * 1000 + milliseconds
}

// Helper to convert milliseconds to HH:MM:SS,ms
export function msToTime(ms: number): string {
  // Round the total milliseconds to the nearest integer before breaking down
  const totalMs = Math.round(ms)

  const hours = Math.floor(totalMs / 3600000)
  let remainingMs = totalMs % 3600000
  const minutes = Math.floor(remainingMs / 60000)
  remainingMs %= 60000
  const seconds = Math.floor(remainingMs / 1000)
  const milliseconds = remainingMs % 1000 // This will now be an integer

  return (
    [String(hours).padStart(2, "0"), String(minutes).padStart(2, "0"), String(seconds).padStart(2, "0")].join(":") +
    "," +
    String(milliseconds).padStart(3, "0")
  )
}
