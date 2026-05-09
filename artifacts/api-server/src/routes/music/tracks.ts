import { Router, type IRouter } from "express";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { db } from "@workspace/db";
import { tracksTable, artistsTable, albumsTable } from "@workspace/db/schema";
import { eq, ilike, sql, count, and } from "drizzle-orm";
import ffmpeg from "fluent-ffmpeg";
import { Writable } from "node:stream";
import { logger } from "../../lib/logger";
import { transcodeSemaphore } from "../../lib/semaphore";
import { transcodeConfig } from "../../lib/transcode-config";
import { getCached, setCached } from "../../lib/api-cache";

const router: IRouter = Router();

const BROWSER_SAFE_MIME = new Set([
  "audio/mpeg",
  "audio/flac",
  "audio/ogg",
  "audio/mp4",
  "audio/aac",
  "audio/wav",
  "audio/opus",
]);

router.get("/tracks", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(500, Math.max(1, Number(req.query.pageSize) || 100));
  const search = req.query.search as string | undefined;
  const albumId = req.query.albumId ? Number(req.query.albumId) : undefined;
  const artistId = req.query.artistId ? Number(req.query.artistId) : undefined;
  const offset = (page - 1) * pageSize;

  const cacheKey = `tracks:${page}:${pageSize}:${search ?? ""}:${albumId ?? ""}:${artistId ?? ""}`;
  const cached = getCached<object>(cacheKey);
  if (cached) { res.json(cached); return; }

  const conditions = [];
  if (search) conditions.push(ilike(tracksTable.title, `%${search}%`));
  if (albumId) conditions.push(eq(tracksTable.albumId, albumId));
  if (artistId) conditions.push(eq(tracksTable.artistId, artistId));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult, tracks] = await Promise.all([
    db.select({ count: count() }).from(tracksTable).where(whereClause),
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
        liked: tracksTable.liked,
      })
      .from(tracksTable)
      .leftJoin(artistsTable, eq(artistsTable.id, tracksTable.artistId))
      .leftJoin(albumsTable, eq(albumsTable.id, tracksTable.albumId))
      .where(whereClause)
      .orderBy(sql`lower(${tracksTable.title})`)
      .limit(pageSize)
      .offset(offset),
  ]);

  const result = {
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
      liked: t.liked ?? false,
    })),
    total: Number(totalResult[0].count),
    page,
    pageSize,
  };

  if (!search && !albumId && !artistId) setCached(cacheKey, result);
  res.json(result);
});

router.get("/tracks/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const tracks = await db
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
    .where(eq(tracksTable.id, id))
    .limit(1);

  if (tracks.length === 0) {
    res.status(404).json({ error: "Track not found" });
    return;
  }

  const t = tracks[0];
  res.json({
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
  });
});

router.get("/stream/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const tracks = await db
    .select({ filePath: tracksTable.filePath, mimeType: tracksTable.mimeType })
    .from(tracksTable)
    .where(eq(tracksTable.id, id))
    .limit(1);

  if (tracks.length === 0) {
    res.status(404).json({ error: "Track not found" });
    return;
  }

  const { filePath, mimeType } = tracks[0];

  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    res.status(404).json({ error: "File not found on disk" });
    return;
  }

  const needsTranscode = req.query.transcode === "1"
    || req.query.maxBitrate !== undefined
    || !BROWSER_SAFE_MIME.has(mimeType);

  if (needsTranscode) {
    const maxBitrate = req.query.maxBitrate ? Number(req.query.maxBitrate) : 192;
    const bitrate = isNaN(maxBitrate) || maxBitrate <= 0 ? 192 : Math.min(maxBitrate, 320);

    res.setHeader("Content-Type", "audio/ogg");
    res.setHeader("Transfer-Encoding", "chunked");

    try {
      await transcodeSemaphore.run(() => new Promise<void>((resolve, reject) => {
        const { threads: ffmpegThreads, hwaccel, vaapiDevice } = transcodeConfig;
        const useVaapi = hwaccel === "vaapi";

        let proc = ffmpeg(filePath);

        if (useVaapi) {
          proc = proc.inputOptions([
            `-hwaccel vaapi`,
            `-vaapi_device ${vaapiDevice}`,
          ]);
        }

        proc = proc
          .audioCodec("libopus")
          .audioBitrate(bitrate)
          .format("ogg")
          .outputOptions([`-threads ${ffmpegThreads}`]);

        proc
          .on("error", (err) => {
            if (useVaapi && !res.headersSent) {
              logger.warn({ err, filePath }, "FFmpeg VAAPI transcode error — falling back to software encoding");
              const softProc = ffmpeg(filePath)
                .audioCodec("libopus")
                .audioBitrate(bitrate)
                .format("ogg")
                .outputOptions([`-threads ${ffmpegThreads}`])
                .on("error", (softErr) => {
                  logger.warn({ err: softErr, filePath }, "FFmpeg software transcode error");
                  if (!res.headersSent) {
                    res.status(500).end();
                  } else {
                    res.destroy();
                  }
                  reject(softErr);
                })
                .on("end", () => resolve());

              softProc.pipe(res as unknown as Writable, { end: true });
              req.on("close", () => {
                softProc.kill("SIGKILL");
                resolve();
              });
            } else {
              logger.warn({ err, filePath }, "FFmpeg transcode error");
              if (!res.headersSent) {
                res.status(500).end();
              } else {
                res.destroy();
              }
              reject(err);
            }
          })
          .on("end", () => resolve());

        const stream = proc.pipe(res as unknown as Writable, { end: true });
        req.on("close", () => {
          proc.kill("SIGKILL");
          resolve();
        });
        void stream;
      }));
    } catch (err) {
      logger.warn({ err, filePath }, "Transcode request failed");
    }
    return;
  }

  const fileSize = fileStat.size;
  const range = req.headers.range;

  if (range) {
    const match = range.match(/^bytes=(\d*)-(\d*)$/);
    if (!match) {
      res.status(416).setHeader("Content-Range", `bytes */${fileSize}`).end();
      return;
    }
    const rawStart = match[1];
    const rawEnd = match[2];
    const isSuffix = rawStart === "" && rawEnd !== "";
    const start = isSuffix ? fileSize - parseInt(rawEnd, 10) : parseInt(rawStart, 10);
    const end = isSuffix || rawEnd === "" ? fileSize - 1 : Math.min(parseInt(rawEnd, 10), fileSize - 1);

    if (isNaN(start) || isNaN(end) || start < 0 || end < start || start >= fileSize) {
      res.status(416).setHeader("Content-Range", `bytes */${fileSize}`).end();
      return;
    }

    const chunkSize = end - start + 1;
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Length", chunkSize);
    res.setHeader("Content-Type", mimeType);

    const stream = createReadStream(filePath, { start, end });
    stream.pipe(res);
  } else {
    res.setHeader("Content-Length", fileSize);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Accept-Ranges", "bytes");

    const stream = createReadStream(filePath);
    stream.pipe(res);
  }
});

export default router;
