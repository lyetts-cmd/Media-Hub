import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { videosTable } from "@workspace/db/schema";
import { sql, isNotNull } from "drizzle-orm";

const router: IRouter = Router();

router.get("/genres", async (_req, res) => {
  const rows = await db
    .select({
      genre: videosTable.genre,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(videosTable)
    .where(isNotNull(videosTable.genre))
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
