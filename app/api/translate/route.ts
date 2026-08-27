import { GoogleGenAI } from "@google/genai"

interface TranslateItem {
  id: number
  text: string
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { items, text, sourceLanguage = "Auto Detect", targetLanguage = "Indonesian" } = body

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return Response.json(
        {
          error:
            "GEMINI_API_KEY environment variable is not set. Please add GEMINI_API_KEY in your .env.local file.",
        },
        { status: 500 },
      )
    }

    const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash-lite"
    const ai = new GoogleGenAI({ apiKey })

    const isAutoDetect = !sourceLanguage || sourceLanguage.toLowerCase() === "auto" || sourceLanguage.toLowerCase() === "auto detect"
    const langInstruction = isAutoDetect
      ? "Auto-detect the source language of each subtitle item and translate it directly into Indonesian (Bahasa Indonesia)."
      : `Translate the subtitle items from ${sourceLanguage} into ${targetLanguage} (Bahasa Indonesia).`

    // BATCH MODE: array of items [{ id, text }]
    if (items && Array.isArray(items) && items.length > 0) {
      const prompt = `You are a professional subtitle translator for films, series, and videos.
${langInstruction}

CRITICAL RULES:
1. MANDATORY: Every single 'text' in the output JSON MUST be translated into natural, fluent Indonesian (Bahasa Indonesia).
2. DO NOT return the original foreign text untranslated. Every item MUST be in Indonesian.
3. Preserve all punctuation, question marks, exclamation marks, and dialogue dashes (-).
4. Preserve internal line breaks (\\n) if present inside the subtitle text.
5. Return a JSON array with EXACTLY the same number of items, maintaining each item's 'id' (as number) and the translated 'text' in Indonesian.

Example Input:
[
  { "id": 1, "text": "Serena? Was ist los?" },
  { "id": 2, "text": "Alles gut, Schatz?" }
]

Example Output:
[
  { "id": 1, "text": "Serena? Ada apa?" },
  { "id": 2, "text": "Semua baik-baik saja, sayang?" }
]

Input Items to Translate (JSON array):
${JSON.stringify(items, null, 2)}`

      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      })

      const rawResponseText = response.text || ""
      if (!rawResponseText) {
        throw new Error("No response received from Gemini API")
      }

      let parsedResults: any[] = []
      try {
        // Clean possible markdown code fences
        const cleaned = rawResponseText
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim()

        parsedResults = JSON.parse(cleaned)
      } catch (parseErr) {
        console.error("JSON parse error from Gemini output:", rawResponseText, parseErr)
        throw new Error(
          `Failed to parse structured JSON response from Gemini: ${
            parseErr instanceof Error ? parseErr.message : String(parseErr)
          }`,
        )
      }

      if (!Array.isArray(parsedResults)) {
        throw new Error("Gemini returned invalid structure (expected an array)")
      }

      // Normalize and sanitize IDs and text
      const normalizedItems: TranslateItem[] = items.map((inputItem, index) => {
        // Find matching item by ID or by array index
        const matched =
          parsedResults.find((p) => Number(p.id) === Number(inputItem.id)) ||
          parsedResults[index]

        const translatedText =
          matched && typeof matched.text === "string" && matched.text.trim() !== ""
            ? matched.text
            : inputItem.text

        return {
          id: Number(inputItem.id),
          text: translatedText,
        }
      })

      return Response.json({
        translatedItems: normalizedItems,
        model: modelName,
        itemCount: normalizedItems.length,
      })
    }

    // SINGLE TEXT MODE (backward compatibility)
    if (!text) {
      return Response.json({ error: "Missing required fields: items or text" }, { status: 400 })
    }

    const singleResponse = await ai.models.generateContent({
      model: modelName,
      contents: `You are an expert subtitle translator. Translate the following text into Indonesian (Bahasa Indonesia). Only provide the translated Indonesian text, nothing else.\n\nText:\n${text}`,
    })

    const translatedText = singleResponse.text
    if (!translatedText) {
      throw new Error("No translation received from API")
    }

    return Response.json({ translatedText, model: modelName })
  } catch (error: any) {
    console.error("[Translation API error]:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return Response.json(
      {
        error: `Translation failed: ${errorMessage}`,
        details: error?.statusText || undefined,
      },
      { status: error?.status === 429 ? 429 : 500 },
    )
  }
}
