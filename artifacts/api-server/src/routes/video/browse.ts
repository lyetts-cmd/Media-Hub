import { Router, type IRouter } from "express";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { db } from "@workspace/db";
import { librariesTable, videosTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";

const router: IRouter = Router();

const VIDEO_EXTENSIONS = new Set([
  ".mp4", ".mkv", ".mov", ".avi", ".webm", ".m4v",
]);

function isPathSafe(requestedPath: string, libraryPaths: string[]): boolean {
  const normalized = path.resolve(requestedPath);
  return libraryPaths.some((libPath) => {
    const normalizedLib = path.resolve(libPath);
    return normalized === normalizedLib || normalized.startsWith(normalizedLib + path.sep);
  });
}

router.get("/browse", async (req, res) => {
  const requestedPath = (req.query.path as string) || "/";

  const libraries = await db
    .select({ path: librariesTable.path })
    .from(librariesTable)
    .where(eq(librariesTable.type, "video"));

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
        videoId: null,
        mimeType: null,
      }));
      res.json({ path: "/", entries });
      return;
    }
  } else {
    browsePath = requestedPath;
    if (!isPathSafe(browsePath, libraryPaths)) {
      res.status(403).json({ error: "Path is outside configured video libraries" });
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

  const videoFiles: string[] = [];
  const result: Array<{
    name: string;
    path: string;
    type: "directory" | "file";
    videoId: number | null;
    mimeType: string | null;
  }> = [];

  const MIME_MAP: Record<string, string> = {
    ".mp4": "video/mp4",
    ".mkv": "video/x-matroska",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".webm": "video/webm",
    ".m4v": "video/mp4",
  };

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(browsePath, entry.name);
    if (entry.isDirectory()) {
      result.push({ name: entry.name, path: fullPath, type: "directory", videoId: null, mimeType: null });
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (VIDEO_EXTENSIONS.has(ext)) {
        videoFiles.push(fullPath);
        result.push({
          name: entry.name,
          path: fullPath,
          type: "file",
          videoId: null,
          mimeType: MIME_MAP[ext] ?? "video/mp4",
        });
      }
    }
  }

  if (videoFiles.length > 0) {
    try {
      const videoRows = await db
        .select({ id: videosTable.id, filePath: videosTable.filePath })
        .from(videosTable)
        .where(inArray(videosTable.filePath, videoFiles));

      const videoMap = new Map(videoRows.map((v) => [v.filePath, v.id]));
      for (const entry of result) {
        if (entry.type === "file") {
          entry.videoId = videoMap.get(entry.path) ?? null;
        }
      }
    } catch {
      // Non-fatal: videoIds just won't be resolved
    }
  }

  result.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  res.json({ path: browsePath, entries: result });
});

export default router;
