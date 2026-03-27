import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { genresTable, tracksTable, artistsTable, albumsTable } from "@workspace/db/schema";
import { eq, sql, count } from "drizzle-orm";

const router: IRouter = Router();

router.get("/genres", async (_req, res) => {
  const genres = await db
    .select({
      name: genresTable.name,
      trackCount: sql<number>`cast(count(${tracksTable.id}) as int)`,
    })
    .from(genresTable)
    .leftJoin(tracksTable, eq(tracksTable.genreId, genresTable.id))
    .groupBy(genresTable.id, genresTable.name)
    .orderBy(genresTable.name);

  res.json({
    genres: genres.map((g) => ({ name: g.name, trackCount: g.trackCount })),
  });
});

router.get("/genres/:name/tracks", async (req, res) => {
  const genreName = decodeURIComponent(req.params.name);
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(500, Math.max(1, Number(req.query.pageSize) || 100));
  const offset = (page - 1) * pageSize;

  const genre = await db
    .select({ id: genresTable.id })
    .from(genresTable)
    .where(eq(genresTable.name, genreName))
    .limit(1);

  if (genre.length === 0) {
    res.json({ tracks: [], total: 0, page, pageSize });
    return;
  }

  const genreId = genre[0].id;

  const [totalResult, tracks] = await Promise.all([
    db.select({ count: count() }).from(tracksTable).where(eq(tracksTable.genreId, genreId)),
    db
      .select({
        id: tracksTable.id,
        title: tracksTable.title,
        artistId: tracksTable.artistId,
        artistName: artistsTable.name,
        albumId: tracksTable.albumId,
        albumTitle: albumsTable.title,
        albumHasArt: albumsTable.hasArt,
        trackNumber: tracksTable.trackNumber,
        discNumber: tracksTable.discNumber,
        durationSeconds: tracksTable.durationSeconds,
        genre: tracksTable.genre,
        year: tracksTable.year,
        filePath: tracksTable.filePath,
        mimeType: tracksTable.mimeType,
      })
      .from(tracksTable)
      .leftJoin(artistsTable, eq(artistsTable.id, tracksTable.artistId))
      .leftJoin(albumsTable, eq(albumsTable.id, tracksTable.albumId))
      .where(eq(tracksTable.genreId, genreId))
      .orderBy(sql`lower(${tracksTable.title})`)
      .limit(pageSize)
      .offset(offset),
  ]);

  res.json({
    tracks: tracks.map((t) => ({
      id: t.id,
      title: t.title,
      artistId: t.artistId ?? null,
      artistName: t.artistName ?? null,
      albumId: t.albumId ?? null,
      albumTitle: t.albumTitle ?? null,
      trackNumber: t.trackNumber ?? null,
      discNumber: t.discNumber ?? null,
      durationSeconds: t.durationSeconds ?? null,
      genre: t.genre ?? null,
      year: t.year ?? null,
      filePath: t.filePath,
      mimeType: t.mimeType,
      hasArt: t.albumHasArt ?? false,
    })),
    total: Number(totalResult[0].count),
    page,
    pageSize,
  });
});

export default router;
