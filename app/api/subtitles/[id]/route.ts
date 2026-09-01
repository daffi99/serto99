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

export async function PATCH(
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

    const body = await request.json()
    const { title } = body

    if (!title || typeof title !== "string" || !title.trim()) {
      return Response.json({ error: "Nama proyek (title) tidak boleh kosong" }, { status: 400 })
    }

    const cleanTitle = title.trim().replace(/\.srt$/i, "")

    const updated = await sql`
      UPDATE subtitles_history
      SET title = ${cleanTitle}
      WHERE id = ${id}
      RETURNING *
    `

    if (updated.length === 0) {
      return Response.json({ error: "Record tidak ditemukan" }, { status: 404 })
    }

    return Response.json({
      success: true,
      item: updated[0],
      message: "Nama proyek berhasil diubah di database.",
    })
  } catch (error: any) {
    console.error("[API /api/subtitles/[id] PATCH error]:", error)
    return Response.json(
      {
        error: `Gagal memperbarui nama di database: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 },
    )
  }
}
