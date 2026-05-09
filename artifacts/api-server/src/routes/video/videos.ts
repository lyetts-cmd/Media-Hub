import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { videosTable } from "@workspace/db/schema";
import type { SubtitleTrack } from "@workspace/db/schema";
import { eq, ilike, sql, count, and, isNotNull } from "drizzle-orm";

const router: IRouter = Router();

router.get("/videos", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 50));
  const search = req.query.search as string | undefined;
  const libraryId = req.query.libraryId ? Number(req.query.libraryId) : undefined;
  const genre = req.query.genre as string | undefined;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (search) conditions.push(ilike(videosTable.title, `%${search}%`));
  if (libraryId) conditions.push(eq(videosTable.libraryId, libraryId));
  if (genre) conditions.push(eq(videosTable.genre, genre));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult, videos] = await Promise.all([
    db.select({ count: count() }).from(videosTable).where(whereClause),
    db
      .select({
        id: videosTable.id,
        libraryId: videosTable.libraryId,
        title: videosTable.title,
        filePath: videosTable.filePath,
        durationSeconds: videosTable.durationSeconds,
        width: videosTable.width,
        height: videosTable.height,
        mimeType: videosTable.mimeType,
        genre: videosTable.genre,
        year: videosTable.year,
        transcodingStatus: videosTable.transcodingStatus,
        subtitleTracks: videosTable.subtitleTracks,
      })
      .from(videosTable)
      .where(whereClause)
      .orderBy(sql`lower(${videosTable.title})`)
      .limit(pageSize)
      .offset(offset),
  ]);

  res.json({
    videos: videos.map((v) => ({
      id: v.id,
      libraryId: v.libraryId ?? null,
      title: v.title,
      filePath: v.filePath,
      durationSeconds: v.durationSeconds ?? null,
      width: v.width ?? null,
      height: v.height ?? null,
      mimeType: v.mimeType,
      genre: v.genre ?? null,
      year: v.year ?? null,
      transcodingStatus: v.transcodingStatus,
      subtitleTracks: (v.subtitleTracks ?? []) as SubtitleTrack[],
    })),
    total: Number(totalResult[0].count),
    page,
    pageSize,
  });
});

router.get("/videos/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const videos = await db
    .select()
    .from(videosTable)
    .where(eq(videosTable.id, id))
    .limit(1);

  if (videos.length === 0) {
    res.status(404).json({ error: "Video not found" });
    return;
  }

  const v = videos[0];
  res.json({
    id: v.id,
    libraryId: v.libraryId ?? null,
    title: v.title,
    filePath: v.filePath,
    durationSeconds: v.durationSeconds ?? null,
    width: v.width ?? null,
    height: v.height ?? null,
    videoCodec: v.videoCodec ?? null,
    audioCodec: v.audioCodec ?? null,
    mimeType: v.mimeType,
    genre: v.genre ?? null,
    year: v.year ?? null,
    transcodingStatus: v.transcodingStatus,
    transcodedPath: v.transcodedPath ?? null,
    subtitleTracks: (v.subtitleTracks ?? []) as SubtitleTrack[],
    createdAt: v.createdAt,
  });
});

export default router;
