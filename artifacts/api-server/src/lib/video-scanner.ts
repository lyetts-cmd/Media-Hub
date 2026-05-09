import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { db } from "@workspace/db";
import { videosTable, librariesTable } from "@workspace/db/schema";
import type { SubtitleTrack } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import ffmpeg from "fluent-ffmpeg";

const VIDEO_EXTENSIONS = new Set([
  ".mp4", ".mkv", ".mov", ".avi", ".webm", ".m4v",
]);

const SUBTITLE_EXTENSIONS = new Set([".srt", ".vtt", ".ass"]);

const WEB_COMPATIBLE_VIDEO_CODECS = new Set(["h264", "vp8", "vp9", "av1"]);
const WEB_COMPATIBLE_AUDIO_CODECS = new Set(["aac", "mp3", "opus", "vorbis"]);

export function getVideoMimeType(ext: string): string {
  const map: Record<string, string> = {
    ".mp4": "video/mp4",
    ".mkv": "video/x-matroska",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".webm": "video/webm",
    ".m4v": "video/mp4",
  };
  return map[ext] ?? "video/mp4";
}

export function isVideoWebCompatible(videoCodec: string | null | undefined, audioCodec: string | null | undefined): boolean {
  const vCodec = (videoCodec ?? "").toLowerCase();
  const aCodec = (audioCodec ?? "").toLowerCase();
  return WEB_COMPATIBLE_VIDEO_CODECS.has(vCodec) && WEB_COMPATIBLE_AUDIO_CODECS.has(aCodec);
}

interface FfprobeResult {
  duration: number | null;
  width: number | null;
  height: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  title: string | null;
  year: number | null;
  embeddedSubtitles: SubtitleTrack[];
}

export async function probeVideo(filePath: string): Promise<FfprobeResult> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      const videoStream = data.streams?.find((s) => s.codec_type === "video");
      const audioStream = data.streams?.find((s) => s.codec_type === "audio");
      const subtitleStreams = (data.streams ?? []).filter((s) => s.codec_type === "subtitle");

      const duration = data.format?.duration ? Number(data.format.duration) : null;
      const width = videoStream?.width ?? null;
      const height = videoStream?.height ?? null;
      const videoCodec = videoStream?.codec_name ?? null;
      const audioCodec = audioStream?.codec_name ?? null;

      const tags = data.format?.tags ?? {};
      const title = (tags["title"] as string | undefined) ?? null;
      const dateTag = (tags["date"] as string | undefined) ?? (tags["year"] as string | undefined);
      let year: number | null = null;
      if (dateTag) {
        const parsed = parseInt(dateTag.slice(0, 4), 10);
        if (!isNaN(parsed) && parsed > 1800 && parsed < 2200) year = parsed;
      }

      const embeddedSubtitles: SubtitleTrack[] = subtitleStreams.map((s, i) => {
        const stags = s.tags ?? {};
        const lang = (stags["language"] as string | undefined);
        const stitle = (stags["title"] as string | undefined);
        const label = stitle ?? (lang ? `Subtitle (${lang})` : `Subtitle ${i + 1}`);
        return {
          id: `embedded-${s.index ?? i}`,
          label,
          language: lang,
          type: "embedded" as const,
          streamIndex: s.index ?? i,
        };
      });

      resolve({ duration, width, height, videoCodec, audioCodec, title, year, embeddedSubtitles });
    });
  });
}

async function findExternalSubtitlesAsync(dir: string, baseName: string): Promise<SubtitleTrack[]> {
  const subs: SubtitleTrack[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!SUBTITLE_EXTENSIONS.has(ext)) continue;
      const nameWithoutExt = path.basename(entry.name, ext);
      if (!nameWithoutExt.startsWith(baseName)) continue;
      const suffix = nameWithoutExt.slice(baseName.length);
      const lang = suffix.startsWith(".") ? suffix.slice(1) : suffix || "default";
      const label = lang && lang !== "default" ? `Subtitle (${lang})` : "Subtitle";
      subs.push({
        id: `external-${entry.name}`,
        label,
        language: lang && lang !== "default" ? lang : undefined,
        type: "external" as const,
        path: path.join(dir, entry.name),
      });
    }
  } catch {
    // ignore
  }
  return subs;
}

async function processVideoFile(filePath: string, libraryId: number): Promise<"added" | "updated" | "skipped"> {
  const fileStat = await stat(filePath);
  const fileModified = fileStat.mtime;

  const existing = await db
    .select({ id: videosTable.id, fileModifiedAt: videosTable.fileModifiedAt })
    .from(videosTable)
    .where(eq(videosTable.filePath, filePath))
    .limit(1);

  if (existing.length > 0) {
    const existingMod = existing[0].fileModifiedAt;
    if (existingMod && Math.abs(existingMod.getTime() - fileModified.getTime()) < 1000) {
      return "skipped";
    }
  }

  let probeResult: FfprobeResult;
  try {
    probeResult = await probeVideo(filePath);
  } catch (err) {
    logger.warn({ err, filePath }, "Failed to probe video metadata");
    return "skipped";
  }

  const ext = path.extname(filePath).toLowerCase();
  const baseName = path.basename(filePath, ext);
  const dir = path.dirname(filePath);

  const externalSubs = await findExternalSubtitlesAsync(dir, baseName);
  const allSubtitles: SubtitleTrack[] = [...probeResult.embeddedSubtitles, ...externalSubs];

  const title = probeResult.title ?? baseName;
  const mimeType = getVideoMimeType(ext);

  const needsTranscode = !isVideoWebCompatible(probeResult.videoCodec, probeResult.audioCodec);
  const transcodingStatus = needsTranscode ? "pending" : "none";

  const videoData = {
    libraryId,
    title,
    filePath,
    durationSeconds: probeResult.duration,
    width: probeResult.width,
    height: probeResult.height,
    videoCodec: probeResult.videoCodec,
    audioCodec: probeResult.audioCodec,
    mimeType,
    genre: null as string | null,
    year: probeResult.year,
    subtitleTracks: allSubtitles,
    transcodingStatus,
    fileModifiedAt: fileModified,
  };

  if (existing.length > 0) {
    await db
      .update(videosTable)
      .set(videoData)
      .where(eq(videosTable.id, existing[0].id));
    return "updated";
  } else {
    await db.insert(videosTable).values(videoData).onConflictDoNothing();
    return "added";
  }
}

export interface VideoScanState {
  scanning: boolean;
  currentLibraryId: number | null;
  videosScanned: number;
  videosAdded: number;
  videosUpdated: number;
  videosRemoved: number;
  hadErrors: boolean;
  errorCount: number;
  startedAt: Date | null;
}

const videoScanState: VideoScanState = {
  scanning: false,
  currentLibraryId: null,
  videosScanned: 0,
  videosAdded: 0,
  videosUpdated: 0,
  videosRemoved: 0,
  hadErrors: false,
  errorCount: 0,
  startedAt: null,
};

export function getVideoScanStatus(): VideoScanState {
  return { ...videoScanState };
}

const BATCH_SIZE = 4;

async function collectVideoFiles(dirPath: string, isRoot = false): Promise<{ files: string[]; errors: number }> {
  const files: string[] = [];
  let errors = 0;
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (entry) => {
          const fullPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            const sub = await collectVideoFiles(fullPath, false);
            files.push(...sub.files);
            errors += sub.errors;
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (VIDEO_EXTENSIONS.has(ext)) {
              files.push(fullPath);
            }
          }
        }),
      );
    }
  } catch (err) {
    if (isRoot) throw err;
    logger.warn({ err, dirPath }, "Error reading subdirectory during video scan");
    errors++;
  }
  return { files, errors };
}

export async function scanVideoLibrary(libraryId: number): Promise<void> {
  if (videoScanState.scanning) {
    logger.info("Video scan already in progress, skipping");
    return;
  }

  const libraries = await db
    .select()
    .from(librariesTable)
    .where(eq(librariesTable.id, libraryId))
    .limit(1);

  if (libraries.length === 0) {
    logger.warn({ libraryId }, "Library not found for video scan");
    return;
  }

  const library = libraries[0];
  videoScanState.scanning = true;
  videoScanState.currentLibraryId = libraryId;
  videoScanState.videosScanned = 0;
  videoScanState.videosAdded = 0;
  videoScanState.videosUpdated = 0;
  videoScanState.videosRemoved = 0;
  videoScanState.hadErrors = false;
  videoScanState.errorCount = 0;
  videoScanState.startedAt = new Date();

  logger.info({ libraryId, path: library.path }, "Starting video library scan");

  try {
    let collectResult: { files: string[]; errors: number };
    try {
      collectResult = await collectVideoFiles(library.path, true);
    } catch (err) {
      logger.error({ err, libraryPath: library.path }, "Cannot read video library root — aborting scan");
      videoScanState.hadErrors = true;
      videoScanState.errorCount++;
      return;
    }

    const { files, errors } = collectResult;
    if (errors > 0) {
      videoScanState.hadErrors = true;
      videoScanState.errorCount += errors;
    }

    const fileSet = new Set(files);

    for (const filePath of files) {
      try {
        const result = await processVideoFile(filePath, libraryId);
        videoScanState.videosScanned++;
        if (result === "added") videoScanState.videosAdded++;
        if (result === "updated") videoScanState.videosUpdated++;
      } catch (err) {
        logger.warn({ err, filePath }, "Error processing video file");
        videoScanState.hadErrors = true;
        videoScanState.errorCount++;
      }
    }

    if (errors === 0) {
      const existingVideos = await db
        .select({ id: videosTable.id, filePath: videosTable.filePath })
        .from(videosTable)
        .where(eq(videosTable.libraryId, libraryId));

      for (const video of existingVideos) {
        if (!fileSet.has(video.filePath)) {
          await db.delete(videosTable).where(eq(videosTable.id, video.id));
          videoScanState.videosRemoved++;
        }
      }
    }

    await db
      .update(librariesTable)
      .set({ lastScannedAt: new Date() })
      .where(eq(librariesTable.id, libraryId));

    logger.info(
      {
        libraryId,
        videosScanned: videoScanState.videosScanned,
        videosAdded: videoScanState.videosAdded,
        videosUpdated: videoScanState.videosUpdated,
        videosRemoved: videoScanState.videosRemoved,
      },
      "Video library scan complete",
    );
  } catch (err) {
    logger.error({ err, libraryId }, "Error during video library scan");
  } finally {
    videoScanState.scanning = false;
    videoScanState.currentLibraryId = null;
  }
}
