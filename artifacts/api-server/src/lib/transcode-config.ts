import { logger } from "./logger";

function parseWorkers(): number {
  const raw = process.env["TRANSCODE_WORKERS"];
  if (!raw) return 1;
  const val = parseInt(raw, 10);
  if (!Number.isInteger(val) || val <= 0) {
    logger.warn(
      { TRANSCODE_WORKERS: raw },
      "TRANSCODE_WORKERS is not a positive integer — defaulting to 1",
    );
    return 1;
  }
  if (val > 8) {
    logger.warn(
      { TRANSCODE_WORKERS: val },
      "TRANSCODE_WORKERS exceeds recommended ceiling of 8 — this may overload the system",
    );
  }
  return val;
}

function parseThreads(): number {
  const raw = process.env["FFMPEG_THREADS"];
  if (!raw) return 0;
  const val = parseInt(raw, 10);
  if (!Number.isInteger(val) || val < 0) {
    logger.warn(
      { FFMPEG_THREADS: raw },
      "FFMPEG_THREADS is not a non-negative integer — defaulting to 0 (auto)",
    );
    return 0;
  }
  return val;
}

export const transcodeConfig = {
  workers: parseWorkers(),
  threads: parseThreads(),
  hwaccel: (process.env["FFMPEG_HWACCEL"] ?? "").toLowerCase(),
  vaapiDevice: process.env["VAAPI_DEVICE"] ?? "/dev/dri/renderD128",
} as const;
