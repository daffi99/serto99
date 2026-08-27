import { getDb, isDbConfigured, ensureTableExists } from "@/lib/db"

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    if (!isDbConfigured()) {
      return Response.json(
        { error: "DATABASE_URL is not configured" },
        { status: 500 },
      )
    }

    await ensureTableExists()
    const sql = getDb()
    const id = Number.parseInt(params.id, 10)

    if (isNaN(id)) {
      return Response.json({ error: "Invalid ID" }, { status: 400 })
    }

    const items = await sql`
      SELECT *
      FROM subtitles_history
      WHERE id = ${id}
      LIMIT 1
    `

    if (items.length === 0) {
      return Response.json({ error: "Subtitle record not found" }, { status: 404 })
    }

    return Response.json({ item: items[0] })
  } catch (error: any) {
    console.error("[API /api/subtitles/[id] GET error]:", error)
    return Response.json(
      {
        error: `Failed to fetch record: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    if (!isDbConfigured()) {
      return Response.json(
        { error: "DATABASE_URL is not configured" },
        { status: 500 },
      )
    }

    await ensureTableExists()
    const sql = getDb()
    const id = Number.parseInt(params.id, 10)

    if (isNaN(id)) {
      return Response.json({ error: "Invalid ID" }, { status: 400 })
    }

    await sql`
      DELETE FROM subtitles_history
      WHERE id = ${id}
    `

    return Response.json({ success: true, message: `Record #${id} berhasil dihapus dari database.` })
  } catch (error: any) {
    console.error("[API /api/subtitles/[id] DELETE error]:", error)
    return Response.json(
      {
        error: `Failed to delete record: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 },
    )
  }
}
