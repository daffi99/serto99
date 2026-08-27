import { neon } from "@neondatabase/serverless"

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== "")
}

export function getDb() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl || databaseUrl.trim() === "") {
    throw new Error(
      "DATABASE_URL environment variable is not configured. Please add DATABASE_URL=postgresql://... in your .env.local file.",
    )
  }
  return neon(databaseUrl)
}

let isInitialized = false

export async function ensureTableExists() {
  if (isInitialized) return
  if (!isDbConfigured()) return

  try {
    const sql = getDb()
    await sql`
      CREATE TABLE IF NOT EXISTS subtitles_history (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        source_language VARCHAR(50) NOT NULL,
        target_language VARCHAR(50) NOT NULL DEFAULT 'Indonesian',
        original_srt TEXT NOT NULL,
        translated_srt TEXT NOT NULL,
        subtitles_count INTEGER DEFAULT 0,
        characters_count INTEGER DEFAULT 0,
        files_count INTEGER DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `
    isInitialized = true
  } catch (error) {
    console.error("[Neon DB] Failed to auto-initialize table:", error)
    throw error
  }
}
