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

    const ai = new GoogleGenAI({ apiKey })

    // PRIORITY MODEL CHAIN:
    // 1. gemini-3.1-flash-lite (15 RPM, 500 RPD - high quota primary)
    // 2. gemini-3.5-flash (5 RPM, 20 RPD fallback)
    // 3. gemini-3.6-flash (5 RPM, 20 RPD fallback)
    // 4. gemini-3.5-flash-lite
    // 5. gemini-2.5-flash
    const primaryModel = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite"
    const candidateModels = [
      primaryModel,
      "gemini-3.1-flash-lite",
      "gemini-3.5-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash-lite",
      "gemini-2.5-flash",
    ]
    const MODEL_CHAIN = Array.from(new Set(candidateModels.filter(Boolean)))

    const isAutoDetect =
      !sourceLanguage ||
      sourceLanguage.toLowerCase() === "auto" ||
      sourceLanguage.toLowerCase() === "auto detect"
    const langInstruction = isAutoDetect
      ? "Auto-detect the source language of each subtitle item and translate it directly into Indonesian (Bahasa Indonesia)."
      : `Translate the subtitle items from ${sourceLanguage} into ${targetLanguage} (Bahasa Indonesia).`

    // Robust JSON Parser with Auto-Repair for truncated or malformed responses
    function safeParseJsonArray(raw: string): any[] {
      const cleaned = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim()

      try {
        const parsed = JSON.parse(cleaned)
        if (Array.isArray(parsed)) return parsed
        if (parsed && Array.isArray((parsed as any).items)) return (parsed as any).items
      } catch (initialErr) {
        // Attempt 1: Repair truncated unclosed JSON array
        try {
          let repaired = cleaned
          if (!repaired.endsWith("]")) {
            repaired = repaired.replace(/,\s*$/, "").replace(/\"[^"]*$/, "")
            if (!repaired.endsWith("}")) repaired += "}"
            if (!repaired.endsWith("]")) repaired += "]"
            const parsed = JSON.parse(repaired)
            if (Array.isArray(parsed)) return parsed
          }
        } catch (_) {}

        // Attempt 2: Extract individual valid JSON objects using regex
        try {
          const extracted: any[] = []
          const regex = /\{\s*"id"\s*:\s*(\d+)\s*,\s*"text"\s*:\s*"((?:\\.|[^"\\])*)"\s*\}/g
          let match
          while ((match = regex.exec(cleaned)) !== null) {
            extracted.push({
              id: Number(match[1]),
              text: match[2].replace(/\\"/g, '"').replace(/\\n/g, "\n"),
            })
          }
          if (extracted.length > 0) {
            return extracted
          }
        } catch (_) {}

        throw initialErr
      }

      return []
    }

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

      let rawResponseText = ""
      let usedModel = MODEL_CHAIN[0]
      let lastError: any = null

      // Loop through model chain with automatic fallback if overloaded (503), rate limited (429), or error
      for (let i = 0; i < MODEL_CHAIN.length; i++) {
        const currentModel = MODEL_CHAIN[i]
        try {
          const response = await ai.models.generateContent({
            model: currentModel,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              temperature: 0.2,
            },
          })

          rawResponseText = response.text || ""
          if (rawResponseText) {
            usedModel = currentModel
            lastError = null
            break
          }
        } catch (err: any) {
          lastError = err
          const errMsg = err?.message || ""
          const isOverloadOrLimit =
            err?.status === 503 ||
            err?.status === 429 ||
            err?.status === 404 ||
            errMsg.includes("503") ||
            errMsg.includes("high demand") ||
            errMsg.includes("429") ||
            errMsg.includes("RESOURCE_EXHAUSTED") ||
            errMsg.includes("UNAVAILABLE") ||
            errMsg.includes("overloaded")

          console.warn(
            `[Gemini API] Model ${currentModel} failed (${errMsg.slice(0, 120)}). Fallback available: ${
              i < MODEL_CHAIN.length - 1
            }`,
          )

          if (isOverloadOrLimit && i < MODEL_CHAIN.length - 1) {
            await new Promise((r) => setTimeout(r, 1000))
            continue
          }

          if (i === MODEL_CHAIN.length - 1) {
            break
          }
        }
      }

      if (!rawResponseText && lastError) {
        throw lastError
      }

      let parsedResults: any[] = []
      try {
        parsedResults = safeParseJsonArray(rawResponseText)
      } catch (parseErr) {
        console.error("JSON parse error from Gemini output:", rawResponseText.slice(0, 300), parseErr)
        throw new Error(
          `Failed to parse structured JSON response from Gemini: ${
            parseErr instanceof Error ? parseErr.message : String(parseErr)
          }`,
        )
      }

      if (!Array.isArray(parsedResults) || parsedResults.length === 0) {
        throw new Error("Gemini returned invalid or empty structure (expected an array)")
      }

      // Normalize and sanitize IDs and text
      const normalizedItems: TranslateItem[] = items.map((inputItem, index) => {
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
        model: usedModel,
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
