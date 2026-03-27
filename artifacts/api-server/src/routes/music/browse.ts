import { Router, type IRouter } from "express";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { db } from "@workspace/db";
import { librariesTable, tracksTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

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

router.get("/browse", async (req, res) => {
  const requestedPath = (req.query.path as string) || "/";
  const libraries = await db.select({ path: librariesTable.path }).from(librariesTable);
  const libraryPaths = libraries.map((l) => l.path);

  let browsePath: string;

  if (requestedPath === "/" || requestedPath === "") {
    if (libraryPaths.length === 0) {
      res.json({ path: "/", entries: [] });
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
  }> = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(browsePath, entry.name);
    if (entry.isDirectory()) {
      result.push({ name: entry.name, path: fullPath, type: "directory", trackId: null, mimeType: null });
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
        });
      }
    }
  }

  if (audioFiles.length > 0) {
    const trackRows = await db
      .select({ id: tracksTable.id, filePath: tracksTable.filePath })
      .from(tracksTable)
      .where(sql`${tracksTable.filePath} = ANY(${audioFiles})`);

    const trackMap = new Map(trackRows.map((t) => [t.filePath, t.id]));
    for (const entry of result) {
      if (entry.type === "file") {
        entry.trackId = trackMap.get(entry.path) ?? null;
      }
    }
  }

  result.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  res.json({ path: browsePath, entries: result });
});

export default router;
