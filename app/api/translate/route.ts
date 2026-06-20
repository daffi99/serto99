import { GoogleGenAI } from "@google/genai"

export async function POST(request: Request) {
  try {
    const { text, sourceLanguage, targetLanguage } = await request.json()

    if (!text || !sourceLanguage || !targetLanguage) {
      return Response.json({ error: "Missing required fields: text, sourceLanguage, targetLanguage" }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set")
    }

    const ai = new GoogleGenAI({ apiKey })

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: `Translate the following text from ${sourceLanguage} to ${targetLanguage}. Only provide the translation, nothing else.

Text to translate:
${text}`,
    })

    const translatedText = response.text

    if (!translatedText) {
      throw new Error("No translation received from API")
    }

    return Response.json({ translatedText })
  } catch (error) {
    console.error("[v0] Translation API error:", error)
    return Response.json(
      { error: `Translation failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    )
  }
}
