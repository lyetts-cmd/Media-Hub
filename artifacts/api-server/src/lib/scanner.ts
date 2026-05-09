import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { parseFile } from "music-metadata";
import sharp from "sharp";
import { db } from "@workspace/db";
import {
  librariesTable,
  artistsTable,
  albumsTable,
  albumArtTable,
  genresTable,
  tracksTable,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";
import { clearApiCache } from "./api-cache";

const AUDIO_EXTENSIONS = new Set([
  ".mp3", ".flac", ".ogg", ".m4a", ".aac", ".wav", ".wma", ".opus", ".ape",
]);

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    ".mp3": "audio/mpeg",
    ".flac": "audio/flac",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".wav": "audio/wav",
    ".wma": "audio/x-ms-wma",
    ".opus": "audio/ogg",
    ".ape": "audio/ape",
  };
  return map[ext] ?? "audio/mpeg";
}

interface ScanState {
  scanning: boolean;
  currentLibraryId: number | null;
  tracksScanned: number;
  tracksAdded: number;
  tracksUpdated: number;
  tracksRemoved: number;
  hadErrors: boolean;
  errorCount: number;
  startedAt: Date | null;
}

const scanState: ScanState = {
  scanning: false,
  currentLibraryId: null,
  tracksScanned: 0,
  tracksAdded: 0,
  tracksUpdated: 0,
  tracksRemoved: 0,
  hadErrors: false,
  errorCount: 0,
  startedAt: null,
};

export function getScanStatus(): ScanState {
  return { ...scanState };
}

interface CollectResult {
  files: string[];
  directoryErrors: number;
}

const BATCH_SIZE = 8;

async function collectAudioFiles(dirPath: string, isRoot = false): Promise<CollectResult> {
  let directoryErrors = 0;
  const files: string[] = [];
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (entry) => {
          const fullPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            const sub = await collectAudioFiles(fullPath, false);
            files.push(...sub.files);
            directoryErrors += sub.directoryErrors;
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (AUDIO_EXTENSIONS.has(ext)) {
              files.push(fullPath);
            }
          }
        }),
      );
    }
  } catch (err) {
    if (isRoot) {
      throw err;
    }
    logger.warn({ err, dirPath }, "Error reading subdirectory during scan");
    directoryErrors++;
  }
  return { files, directoryErrors };
}

async function upsertGenre(name: string): Promise<number> {
  const trimmed = name.trim();
  const result = await db
    .insert(genresTable)
    .values({ name: trimmed })
    .onConflictDoNothing()
    .returning({ id: genresTable.id });
  if (result.length > 0) return result[0].id;
  const existing = await db
    .select({ id: genresTable.id })
    .from(genresTable)
    .where(eq(genresTable.name, trimmed))
    .limit(1);
  return existing[0].id;
}

async function upsertArtist(name: string): Promise<number> {
  const trimmed = name.trim();
  const existing = await db
    .select({ id: artistsTable.id })
    .from(artistsTable)
    .where(eq(sql`lower(${artistsTable.name})`, trimmed.toLowerCase()))
    .limit(1);
  if (existing.length > 0) return existing[0].id;
  const inserted = await db
    .insert(artistsTable)
    .values({ name: trimmed })
    .onConflictDoNothing()
    .returning({ id: artistsTable.id });
  if (inserted.length > 0) return inserted[0].id;
  const retry = await db
    .select({ id: artistsTable.id })
    .from(artistsTable)
    .where(eq(sql`lower(${artistsTable.name})`, trimmed.toLowerCase()))
    .limit(1);
  return retry[0].id;
}

async function upsertAlbum(
  title: string,
  artistId: number | null,
  year: number | null,
  genre: string | null,
): Promise<number> {
  const trimmed = title.trim();
  const existing = await db
    .select({ id: albumsTable.id })
    .from(albumsTable)
    .where(
      artistId !== null
        ? sql`lower(${albumsTable.title}) = ${trimmed.toLowerCase()} AND ${albumsTable.artistId} = ${artistId}`
        : sql`lower(${albumsTable.title}) = ${trimmed.toLowerCase()} AND ${albumsTable.artistId} IS NULL`,
    )
    .limit(1);
  if (existing.length > 0) return existing[0].id;
  const inserted = await db
    .insert(albumsTable)
    .values({ title: trimmed, artistId, year, genre })
    .returning({ id: albumsTable.id });
  return inserted[0].id;
}

async function resizeArtwork(data: Buffer): Promise<{ buffer: Buffer; mimeType: string }> {
  const buffer = await sharp(data)
    .resize(500, 500, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  return { buffer, mimeType: "image/jpeg" };
}

async function saveAlbumArt(albumId: number, artData: Buffer, mimeType: string) {
  let finalData = artData;
  let finalMime = mimeType;

  try {
    const resized = await resizeArtwork(artData);
    finalData = resized.buffer;
    finalMime = resized.mimeType;
  } catch (err) {
    logger.warn({ err, albumId }, "Failed to resize album art, storing original");
  }

  await db
    .insert(albumArtTable)
    .values({ albumId, data: finalData, mimeType: finalMime })
    .onConflictDoUpdate({
      target: albumArtTable.albumId,
      set: { data: finalData, mimeType: finalMime },
    });
  await db
    .update(albumsTable)
    .set({ hasArt: true })
    .where(eq(albumsTable.id, albumId));
}

async function processFile(filePath: string, libraryId: number): Promise<"added" | "updated" | "skipped"> {
  const fileStat = await stat(filePath);
  const fileModified = fileStat.mtime;

  const existing = await db
    .select({ id: tracksTable.id, fileModifiedAt: tracksTable.fileModifiedAt })
    .from(tracksTable)
    .where(eq(tracksTable.filePath, filePath))
    .limit(1);

  if (existing.length > 0) {
    const track = existing[0];
    const existingMod = track.fileModifiedAt;
    if (existingMod && Math.abs(existingMod.getTime() - fileModified.getTime()) < 1000) {
      return "skipped";
    }
  }

  let metadata;
  try {
    metadata = await parseFile(filePath, { duration: true });
  } catch (err) {
    logger.warn({ err, filePath }, "Failed to parse audio metadata");
    return "skipped";
  }

  const { common, format } = metadata;

  const titleRaw = common.title ?? path.basename(filePath, path.extname(filePath));
  const artistName = common.albumartist || common.artist;
  const albumTitle = common.album;

  let artistId: number | null = null;
  if (artistName) {
    artistId = await upsertArtist(artistName);
  }

  const genreName = common.genre?.[0] ?? null;
  let genreId: number | null = null;
  if (genreName) {
    genreId = await upsertGenre(genreName);
  }

  let albumId: number | null = null;
  if (albumTitle) {
    albumId = await upsertAlbum(
      albumTitle,
      artistId,
      common.year ?? null,
      genreName,
    );

    if (albumId && common.picture && common.picture.length > 0) {
      const pic = common.picture[0];
      const albumArtExists = await db
        .select({ id: albumArtTable.id })
        .from(albumArtTable)
        .where(eq(albumArtTable.albumId, albumId))
        .limit(1);
      if (albumArtExists.length === 0) {
        await saveAlbumArt(albumId, Buffer.from(pic.data), pic.format);
      }
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const trackData = {
    title: titleRaw,
    artistId,
    albumId,
    libraryId,
    trackNumber: common.track?.no ?? null,
    discNumber: common.disk?.no ?? null,
    durationSeconds: format.duration ?? null,
    genre: genreName,
    genreId,
    year: common.year ?? null,
    filePath,
    mimeType: getMimeType(ext),
    fileModifiedAt: fileModified,
  };

  if (existing.length > 0) {
    await db
      .update(tracksTable)
      .set(trackData)
      .where(eq(tracksTable.id, existing[0].id));
    return "updated";
  } else {
    await db.insert(tracksTable).values(trackData).onConflictDoNothing();
    return "added";
  }
}

export async function scanLibrary(libraryId: number): Promise<void> {
  if (scanState.scanning) {
    logger.info("Scan already in progress, skipping");
    return;
  }

  const libraries = await db
    .select()
    .from(librariesTable)
    .where(eq(librariesTable.id, libraryId))
    .limit(1);
  if (libraries.length === 0) {
    logger.warn({ libraryId }, "Library not found for scan");
    return;
  }

  const library = libraries[0];
  scanState.scanning = true;
  scanState.currentLibraryId = libraryId;
  scanState.tracksScanned = 0;
  scanState.tracksAdded = 0;
  scanState.tracksUpdated = 0;
  scanState.tracksRemoved = 0;
  scanState.hadErrors = false;
  scanState.errorCount = 0;
  scanState.startedAt = new Date();

  logger.info({ libraryId, path: library.path }, "Starting library scan");

  try {
    let collectResult: CollectResult;
    try {
      collectResult = await collectAudioFiles(library.path, true);
    } catch (err) {
      logger.error({ err, libraryPath: library.path }, "Cannot read library root directory — aborting scan without deletions");
      scanState.hadErrors = true;
      scanState.errorCount++;
      return;
    }

    const { files, directoryErrors } = collectResult;
    if (directoryErrors > 0) {
      scanState.hadErrors = true;
      scanState.errorCount += directoryErrors;
      logger.warn({ directoryErrors, libraryId }, "Scan encountered subdirectory errors; deletion pass will be skipped");
    }

    const fileSet = new Set(files);

    for (const filePath of files) {
      try {
        const result = await processFile(filePath, libraryId);
        scanState.tracksScanned++;
        if (result === "added") scanState.tracksAdded++;
        if (result === "updated") scanState.tracksUpdated++;
      } catch (err) {
        logger.warn({ err, filePath }, "Error processing file");
        scanState.hadErrors = true;
        scanState.errorCount++;
      }
    }

    if (directoryErrors === 0) {
      const existingTracks = await db
        .select({ id: tracksTable.id, filePath: tracksTable.filePath })
        .from(tracksTable)
        .where(eq(tracksTable.libraryId, libraryId));

      for (const track of existingTracks) {
        if (!fileSet.has(track.filePath)) {
          await db.delete(tracksTable).where(eq(tracksTable.id, track.id));
          scanState.tracksRemoved++;
        }
      }
    }

    await db
      .update(librariesTable)
      .set({ lastScannedAt: new Date() })
      .where(eq(librariesTable.id, libraryId));

    clearApiCache();

    logger.info(
      {
        libraryId,
        tracksScanned: scanState.tracksScanned,
        tracksAdded: scanState.tracksAdded,
        tracksUpdated: scanState.tracksUpdated,
        tracksRemoved: scanState.tracksRemoved,
      },
      "Library scan complete",
    );
  } catch (err) {
    logger.error({ err, libraryId }, "Error during library scan");
  } finally {
    scanState.scanning = false;
    scanState.currentLibraryId = null;
  }
}
