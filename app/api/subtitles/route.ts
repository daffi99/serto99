import { getDb, isDbConfigured, ensureTableExists } from "@/lib/db"

export async function GET(request: Request) {
  try {
    if (!isDbConfigured()) {
      return Response.json({
        configured: false,
        items: [],
        message: "DATABASE_URL is not configured. Add DATABASE_URL in your .env.local to enable database storage and history.",
      })
    }

    await ensureTableExists()
    const sql = getDb()

    // Retrieve list (exclude full original_srt and translated_srt text from list query for performance, or include preview)
    const items = await sql`
      SELECT 
        id, 
        title, 
        source_language, 
        target_language, 
        subtitles_count, 
        characters_count, 
        files_count, 
        created_at,
        LEFT(original_srt, 500) as original_preview,
        LEFT(translated_srt, 500) as translated_preview
      FROM subtitles_history
      ORDER BY created_at DESC
    `

    return Response.json({
      configured: true,
      items,
    })
  } catch (error: any) {
    console.error("[API /api/subtitles GET error]:", error)
    return Response.json(
      {
        configured: isDbConfigured(),
        error: `Database query failed: ${error instanceof Error ? error.message : String(error)}`,
        items: [],
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    if (!isDbConfigured()) {
      return Response.json(
        {
          error: "DATABASE_URL is not configured. Please add DATABASE_URL in .env.local to save records.",
          configured: false,
        },
        { status: 400 },
      )
    }

    const body = await request.json()
    const {
      title,
      source_language = "english",
      target_language = "Indonesian",
      original_srt,
      translated_srt,
      subtitles_count = 0,
      characters_count = 0,
      files_count = 1,
    } = body

    if (!title || !original_srt || !translated_srt) {
      return Response.json(
        { error: "Missing required fields: title, original_srt, translated_srt" },
        { status: 400 },
      )
    }

    await ensureTableExists()
    const sql = getDb()

    const cleanTitle = title.trim().replace(/\.srt$/i, "")

    const result = await sql`
      INSERT INTO subtitles_history (
        title,
        source_language,
        target_language,
        original_srt,
        translated_srt,
        subtitles_count,
        characters_count,
        files_count,
        created_at,
        updated_at
      ) VALUES (
        ${cleanTitle},
        ${source_language},
        ${target_language},
        ${original_srt},
        ${translated_srt},
        ${subtitles_count},
        ${characters_count},
        ${files_count},
        NOW(),
        NOW()
      )
      RETURNING id, title, source_language, target_language, subtitles_count, characters_count, files_count, created_at
    `

    return Response.json({
      success: true,
      item: result[0],
      message: "Proyek subtitle berhasil disimpan ke database Neon!",
    })
  } catch (error: any) {
    console.error("[API /api/subtitles POST error]:", error)
    return Response.json(
      {
        error: `Failed to save subtitle to Neon DB: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 },
    )
  }
}
