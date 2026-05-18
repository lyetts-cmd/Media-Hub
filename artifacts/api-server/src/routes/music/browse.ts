import { Router, type IRouter } from "express";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { db } from "@workspace/db";
import { albumsTable, artistsTable, librariesTable, tracksTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";

const router: IRouter = Router();

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

function isPathSafe(requestedPath: string, libraryPaths: string[]): boolean {
  const normalized = path.resolve(requestedPath);
  return libraryPaths.some((libPath) => {
    const normalizedLib = path.resolve(libPath);
    return normalized === normalizedLib || normalized.startsWith(normalizedLib + path.sep);
  });
}

async function streamFileByPath(
  filePath: string,
  mimeType: string,
  req: Parameters<Parameters<IRouter["get"]>[1]>[0],
  res: Parameters<Parameters<IRouter["get"]>[1]>[1]
) {
  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    res.status(404).json({ error: "File not found on disk" });
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
    createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.setHeader("Content-Length", fileSize);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Accept-Ranges", "bytes");
    createReadStream(filePath).pipe(res);
  }
}

router.get("/browse/stream", async (req, res) => {
  const requestedPath = req.query.path as string;
  if (!requestedPath) {
    res.status(400).json({ error: "path query parameter is required" });
    return;
  }

  const libraries = await db.select({ path: librariesTable.path }).from(librariesTable);
  const libraryPaths = libraries.map((l) => l.path);

  if (!isPathSafe(requestedPath, libraryPaths)) {
    res.status(403).json({ error: "Path is outside configured libraries" });
    return;
  }

  const ext = path.extname(requestedPath).toLowerCase();
  if (!AUDIO_EXTENSIONS.has(ext)) {
    res.status(400).json({ error: "Not an audio file" });
    return;
  }

  await streamFileByPath(requestedPath, getMimeType(ext), req, res);
});

router.get("/browse", async (req, res) => {
  const requestedPath = (req.query.path as string) || "/";
  const libraries = await db.select({ path: librariesTable.path }).from(librariesTable);
  const libraryPaths = libraries.map((l) => l.path);

  let browsePath: string;

  if (requestedPath === "/" || requestedPath === "") {
    if (libraryPaths.length === 0) {
      res.json({ path: "/", entries: [], noLibraries: true });
      return;
    }
    if (libraryPaths.length === 1) {
      browsePath = libraryPaths[0];
    } else {
      const entries = libraryPaths.map((p) => ({
        name: path.basename(p) || p,
        path: p,
        type: "directory" as const,
        trackId: null,
        mimeType: null,
      }));
      res.json({ path: "/", entries });
      return;
    }
  } else {
    browsePath = requestedPath;
    if (!isPathSafe(browsePath, libraryPaths)) {
      res.status(403).json({ error: "Path is outside configured libraries" });
      return;
    }
  }

  let dirStat;
  try {
    dirStat = await stat(browsePath);
  } catch {
    res.status(404).json({ error: "Path not found" });
    return;
  }

  if (!dirStat.isDirectory()) {
    res.status(400).json({ error: "Path is not a directory" });
    return;
  }

  let entries;
  try {
    entries = await readdir(browsePath, { withFileTypes: true });
  } catch {
    res.status(500).json({ error: "Could not read directory" });
    return;
  }

  const audioFiles: string[] = [];
  const result: Array<{
    name: string;
    path: string;
    type: "directory" | "file";
    trackId: number | null;
    mimeType: string | null;
    title: string | null;
    artist: string | null;
    album: string | null;
    albumId: number | null;
  }> = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(browsePath, entry.name);
    if (entry.isDirectory()) {
      result.push({ name: entry.name, path: fullPath, type: "directory", trackId: null, mimeType: null, title: null, artist: null, album: null, albumId: null });
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (AUDIO_EXTENSIONS.has(ext)) {
        audioFiles.push(fullPath);
        result.push({
          name: entry.name,
          path: fullPath,
          type: "file",
          trackId: null,
          mimeType: getMimeType(ext),
          title: null,
          artist: null,
          album: null,
          albumId: null,
        });
      }
    }
  }

  if (audioFiles.length > 0) {
    try {
      const trackRows = await db
        .select({
          id: tracksTable.id,
          filePath: tracksTable.filePath,
          title: tracksTable.title,
          albumId: tracksTable.albumId,
          artistName: artistsTable.name,
          albumTitle: albumsTable.title,
        })
        .from(tracksTable)
        .leftJoin(artistsTable, eq(tracksTable.artistId, artistsTable.id))
        .leftJoin(albumsTable, eq(tracksTable.albumId, albumsTable.id))
        .where(inArray(tracksTable.filePath, audioFiles));

      const trackMap = new Map(trackRows.map((t) => [t.filePath, t]));
      for (const entry of result) {
        if (entry.type === "file") {
          const track = trackMap.get(entry.path);
          if (track) {
            entry.trackId = track.id;
            entry.title = track.title;
            entry.albumId = track.albumId ?? null;
            entry.artist = track.artistName ?? null;
            entry.album = track.albumTitle ?? null;
          }
        }
      }
    } catch {
      // Non-fatal: metadata just won't be resolved; files still appear and stream via path
    }
  }

  result.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  res.json({ path: browsePath, entries: result });
});

export default router;
