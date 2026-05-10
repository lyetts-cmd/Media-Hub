import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { videosTable } from "@workspace/db/schema";
import { sql, isNotNull, and, eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/genres", async (req, res) => {
  const libraryId = req.query.libraryId ? Number(req.query.libraryId) : undefined;

  const whereClause = libraryId
    ? and(isNotNull(videosTable.genre), eq(videosTable.libraryId, libraryId))
    : isNotNull(videosTable.genre);

  const rows = await db
    .select({
      genre: videosTable.genre,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(videosTable)
    .where(whereClause)
    .groupBy(videosTable.genre)
    .orderBy(sql`lower(${videosTable.genre})`);

  res.json({
    genres: rows.map((r) => ({
      name: r.genre!,
      videoCount: r.count,
    })),
  });
});

export default router;
