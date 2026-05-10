import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { albumsTable, artistsTable, tracksTable, albumArtTable } from "@workspace/db/schema";
import { eq, sql, ilike, count, and, inArray } from "drizzle-orm";
import { getCached, setCached } from "../../lib/api-cache";

const router: IRouter = Router();

router.get("/albums", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 50));
  const search = req.query.search as string | undefined;
  const artistId = req.query.artistId ? Number(req.query.artistId) : undefined;
  const libraryId = req.query.libraryId ? Number(req.query.libraryId) : undefined;
  const offset = (page - 1) * pageSize;

  const cacheKey = `albums:${page}:${pageSize}:${search ?? ""}:${artistId ?? ""}:${libraryId ?? ""}`;
  const cached = getCached<object>(cacheKey);
  if (cached) { res.json(cached); return; }

  let albumIdFilter: number[] | undefined;
  if (libraryId) {
    const rows = await db
      .selectDistinct({ albumId: tracksTable.albumId })
      .from(tracksTable)
      .where(and(eq(tracksTable.libraryId, libraryId)));
    albumIdFilter = rows.map((r) => r.albumId).filter((id): id is number => id != null);
    if (albumIdFilter.length === 0) {
      res.json({ albums: [], total: 0, page, pageSize });
      return;
    }
  }

  const conditions = [];
  if (search) conditions.push(ilike(albumsTable.title, `%${search}%`));
  if (artistId) conditions.push(eq(albumsTable.artistId, artistId));
  if (albumIdFilter) conditions.push(inArray(albumsTable.id, albumIdFilter));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult, albums] = await Promise.all([
    db.select({ count: count() }).from(albumsTable).where(whereClause),
    db
      .select({
        id: albumsTable.id,
        title: albumsTable.title,
        year: albumsTable.year,
        hasArt: albumsTable.hasArt,
        genre: albumsTable.genre,
        artistId: albumsTable.artistId,
        artistName: artistsTable.name,
        trackCount: sql<number>`cast(count(${tracksTable.id}) as int)`,
      })
      .from(albumsTable)
      .leftJoin(artistsTable, eq(artistsTable.id, albumsTable.artistId))
      .leftJoin(tracksTable, eq(tracksTable.albumId, albumsTable.id))
      .where(whereClause)
      .groupBy(albumsTable.id, artistsTable.name)
      .orderBy(sql`lower(${albumsTable.title})`)
      .limit(pageSize)
      .offset(offset),
  ]);

  const result = {
    albums: albums.map((a) => ({
      id: a.id,
      title: a.title,
      artistId: a.artistId ?? null,
      artistName: a.artistName ?? null,
      year: a.year ?? null,
      trackCount: a.trackCount,
      hasArt: a.hasArt,
      genre: a.genre ?? null,
    })),
    total: Number(totalResult[0].count),
    page,
    pageSize,
  };

  setCached(cacheKey, result);
  res.json(result);
});

router.get("/albums/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const albumRows = await db
    .select({
      id: albumsTable.id,
      title: albumsTable.title,
      year: albumsTable.year,
      hasArt: albumsTable.hasArt,
      genre: albumsTable.genre,
      artistId: albumsTable.artistId,
      artistName: artistsTable.name,
    })
    .from(albumsTable)
    .leftJoin(artistsTable, eq(artistsTable.id, albumsTable.artistId))
    .where(eq(albumsTable.id, id))
    .limit(1);

  if (albumRows.length === 0) {
    res.status(404).json({ error: "Album not found" });
    return;
  }

  const album = albumRows[0];

  const tracks = await db
    .select({
      id: tracksTable.id,
      title: tracksTable.title,
      artistId: tracksTable.artistId,
      artistName: artistsTable.name,
      albumId: tracksTable.albumId,
      trackNumber: tracksTable.trackNumber,
      discNumber: tracksTable.discNumber,
      durationSeconds: tracksTable.durationSeconds,
      genre: tracksTable.genre,
      year: tracksTable.year,
      filePath: tracksTable.filePath,
      mimeType: tracksTable.mimeType,
      liked: tracksTable.liked,
    })
    .from(tracksTable)
    .leftJoin(artistsTable, eq(artistsTable.id, tracksTable.artistId))
    .where(eq(tracksTable.albumId, id))
    .orderBy(tracksTable.discNumber, tracksTable.trackNumber, tracksTable.title);

  res.json({
    id: album.id,
    title: album.title,
    artistId: album.artistId ?? null,
    artistName: album.artistName ?? null,
    year: album.year ?? null,
    trackCount: tracks.length,
    hasArt: album.hasArt,
    genre: album.genre ?? null,
    tracks: tracks.map((t) => ({
      id: t.id,
      title: t.title,
      artistId: t.artistId ?? null,
      artistName: t.artistName ?? null,
      albumId: t.albumId ?? null,
      albumTitle: album.title,
      trackNumber: t.trackNumber ?? null,
      discNumber: t.discNumber ?? null,
      durationSeconds: t.durationSeconds ?? null,
      genre: t.genre ?? null,
      year: t.year ?? null,
      filePath: t.filePath,
      mimeType: t.mimeType,
      hasArt: album.hasArt,
      liked: t.liked ?? false,
    })),
  });
});

router.get("/albums/:id/tracks", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const albumRows = await db
    .select({ id: albumsTable.id, title: albumsTable.title, hasArt: albumsTable.hasArt })
    .from(albumsTable)
    .where(eq(albumsTable.id, id))
    .limit(1);

  if (albumRows.length === 0) {
    res.status(404).json({ error: "Album not found" });
    return;
  }

  const album = albumRows[0];

  const tracks = await db
    .select({
      id: tracksTable.id,
      title: tracksTable.title,
      artistId: tracksTable.artistId,
      artistName: artistsTable.name,
      albumId: tracksTable.albumId,
      trackNumber: tracksTable.trackNumber,
      discNumber: tracksTable.discNumber,
      durationSeconds: tracksTable.durationSeconds,
      genre: tracksTable.genre,
      year: tracksTable.year,
      filePath: tracksTable.filePath,
      mimeType: tracksTable.mimeType,
      liked: tracksTable.liked,
    })
    .from(tracksTable)
    .leftJoin(artistsTable, eq(artistsTable.id, tracksTable.artistId))
    .where(eq(tracksTable.albumId, id))
    .orderBy(tracksTable.discNumber, tracksTable.trackNumber, tracksTable.title);

  res.json({
    tracks: tracks.map((t) => ({
      id: t.id,
      title: t.title,
      artistId: t.artistId ?? null,
      artistName: t.artistName ?? null,
      albumId: t.albumId ?? null,
      albumTitle: album.title,
      trackNumber: t.trackNumber ?? null,
      discNumber: t.discNumber ?? null,
      durationSeconds: t.durationSeconds ?? null,
      genre: t.genre ?? null,
      year: t.year ?? null,
      filePath: t.filePath,
      mimeType: t.mimeType,
      hasArt: album.hasArt,
      liked: t.liked ?? false,
    })),
  });
});

router.get("/art/:albumId", async (req, res) => {
  const albumId = Number(req.params.albumId);
  if (isNaN(albumId)) {
    res.status(400).json({ error: "Invalid albumId" });
    return;
  }

  const art = await db
    .select({ data: albumArtTable.data, mimeType: albumArtTable.mimeType })
    .from(albumArtTable)
    .where(eq(albumArtTable.albumId, albumId))
    .limit(1);

  if (art.length === 0) {
    res.status(404).json({ error: "No album art found" });
    return;
  }

  const { data, mimeType } = art[0];
  res.setHeader("Content-Type", mimeType);
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.end(data);
});

export default router;
