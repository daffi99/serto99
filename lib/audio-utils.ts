export async function getWavDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = async (e) => {
      if (!e.target?.result) {
        return reject(new Error("Failed to read WAV file."))
      }
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      try {
        const audioBuffer = await audioContext.decodeAudioData(e.target.result as ArrayBuffer)
        resolve(audioBuffer.duration * 1000) // duration in milliseconds
      } catch (error) {
        reject(new Error(`Error decoding audio data: ${error instanceof Error ? error.message : String(error)}`))
      } finally {
        audioContext.close() // Close the context to release resources
      }
    }

    reader.onerror = (error) => {
      reject(new Error(`FileReader error: ${error instanceof Error ? error.message : String(error)}`))
    }

    reader.readAsArrayBuffer(file)
  })
}
