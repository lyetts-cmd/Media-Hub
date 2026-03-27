import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tracksTable, artistsTable, albumsTable } from "@workspace/db/schema";
import { eq, ilike, sql } from "drizzle-orm";

const router: IRouter = Router();

const LIMIT = 10;

router.get("/search", async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  if (!q) {
    res.json({ tracks: [], artists: [], albums: [] });
    return;
  }

  const pattern = `%${q}%`;

  const [tracks, artists, albums] = await Promise.all([
    db
      .select({
        id: tracksTable.id,
        title: tracksTable.title,
        artistId: tracksTable.artistId,
        artistName: artistsTable.name,
        albumId: tracksTable.albumId,
        albumTitle: albumsTable.title,
        albumHasArt: albumsTable.hasArt,
        durationSeconds: tracksTable.durationSeconds,
        filePath: tracksTable.filePath,
        mimeType: tracksTable.mimeType,
      })
      .from(tracksTable)
      .leftJoin(artistsTable, eq(artistsTable.id, tracksTable.artistId))
      .leftJoin(albumsTable, eq(albumsTable.id, tracksTable.albumId))
      .where(ilike(tracksTable.title, pattern))
      .orderBy(sql`lower(${tracksTable.title})`)
      .limit(LIMIT),

    db
      .select({
        id: artistsTable.id,
        name: artistsTable.name,
        albumCount: sql<number>`cast(count(distinct ${albumsTable.id}) as int)`,
        trackCount: sql<number>`cast(count(${tracksTable.id}) as int)`,
        representativeAlbumId: sql<number | null>`min(${albumsTable.id})`,
      })
      .from(artistsTable)
      .leftJoin(albumsTable, eq(albumsTable.artistId, artistsTable.id))
      .leftJoin(tracksTable, eq(tracksTable.artistId, artistsTable.id))
      .where(ilike(artistsTable.name, pattern))
      .groupBy(artistsTable.id, artistsTable.name)
      .orderBy(sql`lower(${artistsTable.name})`)
      .limit(LIMIT),

    db
      .select({
        id: albumsTable.id,
        title: albumsTable.title,
        artistId: albumsTable.artistId,
        artistName: artistsTable.name,
        year: albumsTable.year,
        hasArt: albumsTable.hasArt,
        genre: albumsTable.genre,
        trackCount: sql<number>`cast(count(${tracksTable.id}) as int)`,
      })
      .from(albumsTable)
      .leftJoin(artistsTable, eq(artistsTable.id, albumsTable.artistId))
      .leftJoin(tracksTable, eq(tracksTable.albumId, albumsTable.id))
      .where(ilike(albumsTable.title, pattern))
      .groupBy(albumsTable.id, artistsTable.name)
      .orderBy(sql`lower(${albumsTable.title})`)
      .limit(LIMIT),
  ]);

  res.json({
    tracks: tracks.map((t) => ({
      id: t.id,
      title: t.title,
      artistId: t.artistId ?? null,
      artistName: t.artistName ?? null,
      albumId: t.albumId ?? null,
      albumTitle: t.albumTitle ?? null,
      durationSeconds: t.durationSeconds ?? null,
      filePath: t.filePath,
      mimeType: t.mimeType,
      hasArt: t.albumHasArt ?? false,
    })),
    artists: artists.map((a) => ({
      id: a.id,
      name: a.name,
      albumCount: a.albumCount,
      trackCount: a.trackCount,
      representativeAlbumId: a.representativeAlbumId ?? null,
    })),
    albums: albums.map((a) => ({
      id: a.id,
      title: a.title,
      artistId: a.artistId ?? null,
      artistName: a.artistName ?? null,
      year: a.year ?? null,
      hasArt: a.hasArt,
      genre: a.genre ?? null,
      trackCount: a.trackCount,
    })),
  });
});

export default router;
