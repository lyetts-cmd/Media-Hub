import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { artistsTable, albumsTable, tracksTable } from "@workspace/db/schema";
import { eq, sql, ilike, count } from "drizzle-orm";
import { getCached, setCached } from "../../lib/api-cache";

const router: IRouter = Router();

router.get("/artists", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 50));
  const search = req.query.search as string | undefined;
  const offset = (page - 1) * pageSize;

  const cacheKey = `artists:${page}:${pageSize}:${search ?? ""}`;
  const cached = getCached<object>(cacheKey);
  if (cached) { res.json(cached); return; }

  const whereClause = search ? ilike(artistsTable.name, `%${search}%`) : undefined;

  const [totalResult, artists] = await Promise.all([
    db
      .select({ count: count() })
      .from(artistsTable)
      .where(whereClause),
    db
      .select({
        id: artistsTable.id,
        name: artistsTable.name,
        albumCount: sql<number>`cast(count(distinct ${albumsTable.id}) as int)`,
        trackCount: sql<number>`cast(count(distinct ${tracksTable.id}) as int)`,
        representativeAlbumId: sql<number | null>`(
          select id from albums
          where artist_id = ${artistsTable.id} and has_art = true
          order by id asc
          limit 1
        )`,
      })
      .from(artistsTable)
      .leftJoin(albumsTable, eq(albumsTable.artistId, artistsTable.id))
      .leftJoin(tracksTable, eq(tracksTable.artistId, artistsTable.id))
      .where(whereClause)
      .groupBy(artistsTable.id, artistsTable.name)
      .orderBy(sql`lower(${artistsTable.name})`)
      .limit(pageSize)
      .offset(offset),
  ]);

  const result = {
    artists: artists.map(a => ({ ...a, representativeAlbumId: a.representativeAlbumId ?? null })),
    total: Number(totalResult[0].count),
    page,
    pageSize,
  };

  setCached(cacheKey, result);
  res.json(result);
});

router.get("/artists/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const artist = await db
    .select({
      id: artistsTable.id,
      name: artistsTable.name,
      albumCount: sql<number>`cast(count(distinct ${albumsTable.id}) as int)`,
      trackCount: sql<number>`cast(count(distinct ${tracksTable.id}) as int)`,
    })
    .from(artistsTable)
    .leftJoin(albumsTable, eq(albumsTable.artistId, artistsTable.id))
    .leftJoin(tracksTable, eq(tracksTable.artistId, artistsTable.id))
    .where(eq(artistsTable.id, id))
    .groupBy(artistsTable.id, artistsTable.name)
    .limit(1);

  if (artist.length === 0) {
    res.status(404).json({ error: "Artist not found" });
    return;
  }

  const albums = await db
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
    .where(eq(albumsTable.artistId, id))
    .groupBy(albumsTable.id, artistsTable.name)
    .orderBy(albumsTable.year, albumsTable.title);

  res.json({
    ...artist[0],
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
  });
});

router.get("/artists/:id/albums", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const albums = await db
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
    .where(eq(albumsTable.artistId, id))
    .groupBy(albumsTable.id, artistsTable.name)
    .orderBy(albumsTable.year, albumsTable.title);

  res.json({
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
  });
});

export default router;
