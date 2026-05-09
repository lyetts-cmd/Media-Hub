import { mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import ffmpeg from "fluent-ffmpeg";
import { db } from "@workspace/db";
import { videosTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { transcodeConfig } from "./transcode-config";
import { transcodeSemaphore } from "./semaphore";

const TRANSCODE_CACHE_DIR = process.env["VIDEO_TRANSCODE_DIR"] ?? path.join(os.tmpdir(), "cadence-video-transcode");

export async function ensureTranscodeDir(): Promise<string> {
  await mkdir(TRANSCODE_CACHE_DIR, { recursive: true });
  return TRANSCODE_CACHE_DIR;
}

export function getTranscodedPath(videoId: number): string {
  return path.join(TRANSCODE_CACHE_DIR, `video-${videoId}.mp4`);
}

const activeJobs = new Set<number>();

export async function transcodeVideo(videoId: number): Promise<void> {
  if (activeJobs.has(videoId)) {
    logger.info({ videoId }, "Transcode job already in progress");
    return;
  }

  const videos = await db
    .select({ filePath: videosTable.filePath, transcodingStatus: videosTable.transcodingStatus })
    .from(videosTable)
    .where(eq(videosTable.id, videoId))
    .limit(1);

  if (videos.length === 0) {
    logger.warn({ videoId }, "Video not found for transcode");
    return;
  }

  const video = videos[0];
  if (video.transcodingStatus === "done" || video.transcodingStatus === "processing") {
    return;
  }

  activeJobs.add(videoId);

  await db
    .update(videosTable)
    .set({ transcodingStatus: "processing" })
    .where(eq(videosTable.id, videoId));

  const outputPath = getTranscodedPath(videoId);
  await ensureTranscodeDir();

  const { threads: ffmpegThreads, hwaccel, vaapiDevice } = transcodeConfig;
  const useVaapi = hwaccel === "vaapi";

  try {
    await transcodeSemaphore.run(() => new Promise<void>((resolve, reject) => {
      let proc = ffmpeg(video.filePath);

      if (useVaapi) {
        proc = proc.inputOptions([
          `-hwaccel vaapi`,
          `-vaapi_device ${vaapiDevice}`,
          `-hwaccel_output_format vaapi`,
        ]);
        proc = proc.outputOptions([
          `-vf format=nv12|vaapi,hwupload`,
          `-c:v h264_vaapi`,
          `-c:a aac`,
          `-b:a 192k`,
          `-movflags +faststart`,
          `-threads ${ffmpegThreads}`,
        ]);
      } else {
        proc = proc.videoCodec("libx264")
          .audioCodec("aac")
          .outputOptions([
            `-crf 23`,
            `-preset fast`,
            `-movflags +faststart`,
            `-b:a 192k`,
            `-threads ${ffmpegThreads}`,
          ]);
      }

      proc = proc.output(outputPath).format("mp4");

      proc
        .on("error", async (err) => {
          if (useVaapi) {
            logger.warn({ err, videoId }, "VAAPI video transcode failed — falling back to software");
            try {
              await new Promise<void>((res2, rej2) => {
                ffmpeg(video.filePath)
                  .videoCodec("libx264")
                  .audioCodec("aac")
                  .outputOptions([
                    `-crf 23`,
                    `-preset fast`,
                    `-movflags +faststart`,
                    `-b:a 192k`,
                    `-threads ${ffmpegThreads}`,
                  ])
                  .output(outputPath)
                  .format("mp4")
                  .on("error", rej2)
                  .on("end", res2)
                  .run();
              });
              resolve();
            } catch (softErr) {
              reject(softErr);
            }
          } else {
            reject(err);
          }
        })
        .on("end", () => resolve())
        .run();
    }));

    await db
      .update(videosTable)
      .set({ transcodingStatus: "done", transcodedPath: outputPath })
      .where(eq(videosTable.id, videoId));

    logger.info({ videoId, outputPath }, "Video transcoding complete");
  } catch (err) {
    logger.error({ err, videoId }, "Video transcoding failed");
    await db
      .update(videosTable)
      .set({ transcodingStatus: "pending" })
      .where(eq(videosTable.id, videoId));
  } finally {
    activeJobs.delete(videoId);
  }
}

export async function enqueueVideoTranscode(videoId: number): Promise<void> {
  transcodeVideo(videoId).catch((err) => {
    logger.error({ err, videoId }, "Background video transcode error");
  });
}
