import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  playlistsTable,
  playlistTracksTable,
  tracksTable,
  artistsTable,
  albumsTable,
} from "@workspace/db/schema";
import { eq, asc, desc, sql } from "drizzle-orm";

const router: IRouter = Router();

async function fetchFullTrack(trackId: number) {
  const rows = await db
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
      liked: tracksTable.liked,
    })
    .from(tracksTable)
    .leftJoin(artistsTable, eq(artistsTable.id, tracksTable.artistId))
    .leftJoin(albumsTable, eq(albumsTable.id, tracksTable.albumId))
    .where(eq(tracksTable.id, trackId))
    .limit(1);
  return rows[0] ?? null;
}

function formatTrack(t: {
  id: number; title: string; artistId: number | null; artistName: string | null;
  albumId: number | null; albumTitle: string | null; albumHasArt: boolean | null;
  trackNumber: number | null; discNumber: number | null; durationSeconds: number | null;
  genre: string | null; year: number | null; filePath: string; mimeType: string; liked: boolean;
}) {
  return {
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
    liked: t.liked ?? false,
  };
}

async function getPlaylistDetail(playlistId: number) {
  const pl = await db
    .select()
    .from(playlistsTable)
    .where(eq(playlistsTable.id, playlistId))
    .limit(1);
  if (pl.length === 0) return null;

  const rows = await db
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
      liked: tracksTable.liked,
    })
    .from(playlistTracksTable)
    .innerJoin(tracksTable, eq(tracksTable.id, playlistTracksTable.trackId))
    .leftJoin(artistsTable, eq(artistsTable.id, tracksTable.artistId))
    .leftJoin(albumsTable, eq(albumsTable.id, tracksTable.albumId))
    .where(eq(playlistTracksTable.playlistId, playlistId))
    .orderBy(asc(playlistTracksTable.position));

  const tracks = rows.map(formatTrack);
  const totalDuration = tracks.reduce((sum, t) => sum + (t.durationSeconds ?? 0), 0);
  const coverAlbumId = tracks.find((t) => t.albumId && t.hasArt)?.albumId ?? null;

  return {
    id: pl[0].id,
    name: pl[0].name,
    trackCount: tracks.length,
    totalDuration: totalDuration || null,
    coverAlbumId,
    createdAt: pl[0].createdAt,
    updatedAt: pl[0].updatedAt,
    tracks,
  };
}

// ── Liked Songs ────────────────────────────────────────────────────────────

router.get("/liked", async (_req, res) => {
  const rows = await db
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
      liked: tracksTable.liked,
    })
    .from(tracksTable)
    .leftJoin(artistsTable, eq(artistsTable.id, tracksTable.artistId))
    .leftJoin(albumsTable, eq(albumsTable.id, tracksTable.albumId))
    .where(eq(tracksTable.liked, true))
    .orderBy(desc(tracksTable.likedAt));

  res.json({ tracks: rows.map(formatTrack), total: rows.length, page: 1, pageSize: rows.length });
});

router.post("/liked/:trackId", async (req, res) => {
  const trackId = Number(req.params.trackId);
  if (isNaN(trackId)) { res.status(400).json({ error: "Invalid trackId" }); return; }

  const updated = await db
    .update(tracksTable)
    .set({ liked: true, likedAt: new Date() })
    .where(eq(tracksTable.id, trackId))
    .returning({ id: tracksTable.id });

  if (updated.length === 0) { res.status(404).json({ error: "Track not found" }); return; }

  const track = await fetchFullTrack(trackId);
  res.json(formatTrack(track!));
});

router.delete("/liked/:trackId", async (req, res) => {
  const trackId = Number(req.params.trackId);
  if (isNaN(trackId)) { res.status(400).json({ error: "Invalid trackId" }); return; }

  const updated = await db
    .update(tracksTable)
    .set({ liked: false, likedAt: null })
    .where(eq(tracksTable.id, trackId))
    .returning({ id: tracksTable.id });

  if (updated.length === 0) { res.status(404).json({ error: "Track not found" }); return; }

  const track = await fetchFullTrack(trackId);
  res.json(formatTrack(track!));
});

// ── Playlists ──────────────────────────────────────────────────────────────

router.get("/playlists", async (_req, res) => {
  const playlists = await db
    .select({
      id: playlistsTable.id,
      name: playlistsTable.name,
      trackCount: sql<number>`cast(count(${playlistTracksTable.id}) as int)`,
      coverAlbumId: sql<number | null>`(
        select t.album_id
        from playlist_tracks pt
        join tracks t on t.id = pt.track_id
        join albums a on a.id = t.album_id
        where pt.playlist_id = ${playlistsTable.id} and a.has_art = true
        order by pt.position asc
        limit 1
      )`,
      totalDuration: sql<number | null>`cast(sum(${tracksTable.durationSeconds}) as real)`,
      createdAt: playlistsTable.createdAt,
      updatedAt: playlistsTable.updatedAt,
    })
    .from(playlistsTable)
    .leftJoin(playlistTracksTable, eq(playlistTracksTable.playlistId, playlistsTable.id))
    .leftJoin(tracksTable, eq(tracksTable.id, playlistTracksTable.trackId))
    .groupBy(playlistsTable.id)
    .orderBy(asc(playlistsTable.name));

  res.json({
    playlists: playlists.map((p) => ({
      id: p.id,
      name: p.name,
      trackCount: p.trackCount,
      totalDuration: p.totalDuration ?? null,
      coverAlbumId: p.coverAlbumId ?? null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
  });
});

router.post("/playlists", async (req, res) => {
  const { name, trackIds } = req.body as { name?: string; trackIds?: number[] };
  if (!name || typeof name !== "string" || name.trim() === "") {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const [pl] = await db
    .insert(playlistsTable)
    .values({ name: name.trim() })
    .returning();

  if (trackIds && Array.isArray(trackIds) && trackIds.length > 0) {
    const uniqueIds = [...new Set(trackIds)];
    await db.insert(playlistTracksTable).values(
      uniqueIds.map((trackId, i) => ({
        playlistId: pl.id,
        trackId,
        position: i,
      }))
    );
  }

  const detail = await getPlaylistDetail(pl.id);
  res.status(201).json(detail);
});

router.get("/playlists/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const detail = await getPlaylistDetail(id);
  if (!detail) { res.status(404).json({ error: "Playlist not found" }); return; }
  res.json(detail);
});

router.patch("/playlists/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { name } = req.body as { name?: string };
  if (!name || typeof name !== "string" || name.trim() === "") {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const updated = await db
    .update(playlistsTable)
    .set({ name: name.trim(), updatedAt: new Date() })
    .where(eq(playlistsTable.id, id))
    .returning({ id: playlistsTable.id });

  if (updated.length === 0) { res.status(404).json({ error: "Playlist not found" }); return; }

  const detail = await getPlaylistDetail(id);
  res.json(detail);
});

router.delete("/playlists/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const deleted = await db
    .delete(playlistsTable)
    .where(eq(playlistsTable.id, id))
    .returning({ id: playlistsTable.id });

  if (deleted.length === 0) { res.status(404).json({ error: "Playlist not found" }); return; }
  res.status(204).end();
});

router.post("/playlists/:id/tracks", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { trackId } = req.body as { trackId?: number };
  if (!trackId || isNaN(Number(trackId))) {
    res.status(400).json({ error: "trackId is required" });
    return;
  }

  const pl = await db
    .select({ id: playlistsTable.id })
    .from(playlistsTable)
    .where(eq(playlistsTable.id, id))
    .limit(1);
  if (pl.length === 0) { res.status(404).json({ error: "Playlist not found" }); return; }

  // Enforce no-duplicate policy
  const existing = await db
    .select({ id: playlistTracksTable.id })
    .from(playlistTracksTable)
    .where(
      sql`${playlistTracksTable.playlistId} = ${id} AND ${playlistTracksTable.trackId} = ${Number(trackId)}`
    )
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "Track is already in this playlist" });
    return;
  }

  const maxPos = await db
    .select({ max: sql<number>`coalesce(max(${playlistTracksTable.position}), -1)` })
    .from(playlistTracksTable)
    .where(eq(playlistTracksTable.playlistId, id));

  const nextPos = (maxPos[0]?.max ?? -1) + 1;

  await db.insert(playlistTracksTable).values({
    playlistId: id,
    trackId: Number(trackId),
    position: nextPos,
  });

  await db
    .update(playlistsTable)
    .set({ updatedAt: new Date() })
    .where(eq(playlistsTable.id, id));

  const detail = await getPlaylistDetail(id);
  res.json(detail);
});

router.delete("/playlists/:id/tracks/:trackId", async (req, res) => {
  const id = Number(req.params.id);
  const trackId = Number(req.params.trackId);
  if (isNaN(id) || isNaN(trackId)) {
    res.status(400).json({ error: "Invalid id or trackId" });
    return;
  }

  const deleted = await db
    .delete(playlistTracksTable)
    .where(
      sql`${playlistTracksTable.playlistId} = ${id} AND ${playlistTracksTable.trackId} = ${trackId}`
    )
    .returning({ id: playlistTracksTable.id });

  if (deleted.length === 0) {
    res.status(404).json({ error: "Track not in playlist" });
    return;
  }

  // Re-number positions to remove gaps
  const remaining = await db
    .select({ id: playlistTracksTable.id })
    .from(playlistTracksTable)
    .where(eq(playlistTracksTable.playlistId, id))
    .orderBy(asc(playlistTracksTable.position));

  for (let i = 0; i < remaining.length; i++) {
    await db
      .update(playlistTracksTable)
      .set({ position: i })
      .where(eq(playlistTracksTable.id, remaining[i].id));
  }

  await db
    .update(playlistsTable)
    .set({ updatedAt: new Date() })
    .where(eq(playlistsTable.id, id));

  res.status(204).end();
});

// ── Reorder tracks in a playlist ───────────────────────────────────────────
// Body: { trackIds: number[] }  — ordered list of all track IDs in new order
router.put("/playlists/:id/tracks/reorder", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { trackIds } = req.body as { trackIds?: number[] };
  if (!Array.isArray(trackIds) || trackIds.some((x) => typeof x !== "number")) {
    res.status(400).json({ error: "trackIds must be an array of numbers" });
    return;
  }

  const pl = await db
    .select({ id: playlistsTable.id })
    .from(playlistsTable)
    .where(eq(playlistsTable.id, id))
    .limit(1);
  if (pl.length === 0) { res.status(404).json({ error: "Playlist not found" }); return; }

  for (let i = 0; i < trackIds.length; i++) {
    await db
      .update(playlistTracksTable)
      .set({ position: i })
      .where(
        sql`${playlistTracksTable.playlistId} = ${id} AND ${playlistTracksTable.trackId} = ${trackIds[i]}`
      );
  }

  await db
    .update(playlistsTable)
    .set({ updatedAt: new Date() })
    .where(eq(playlistsTable.id, id));

  const detail = await getPlaylistDetail(id);
  res.json(detail);
});

export default router;
