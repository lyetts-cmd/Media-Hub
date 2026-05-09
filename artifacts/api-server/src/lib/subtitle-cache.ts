import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import ffmpeg from "fluent-ffmpeg";

const SUBTITLE_CACHE_DIR = process.env["SUBTITLE_CACHE_DIR"] ?? path.join(os.tmpdir(), "cadence-subtitles");

export async function ensureSubtitleCacheDir(): Promise<string> {
  await mkdir(SUBTITLE_CACHE_DIR, { recursive: true });
  return SUBTITLE_CACHE_DIR;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function srtToVtt(srt: string): string {
  let vtt = "WEBVTT\n\n";
  const lines = srt.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = lines.split(/\n\n+/);
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const blockLines = trimmed.split("\n");
    const newLines: string[] = [];
    let inTimecode = false;
    for (const line of blockLines) {
      if (/^\d+$/.test(line.trim()) && !inTimecode) {
        continue;
      }
      if (/\d{2}:\d{2}:\d{2},\d{3}/.test(line)) {
        inTimecode = true;
        newLines.push(line.replace(/,/g, "."));
      } else {
        newLines.push(line);
      }
    }
    if (newLines.length > 0) {
      vtt += newLines.join("\n") + "\n\n";
    }
  }
  return vtt;
}

function getFfmpegBinary(): string {
  return (ffmpeg as unknown as { _ffmpegPath?: string })._ffmpegPath ?? "ffmpeg";
}

async function runFfmpegToString(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const proc = spawn(getFfmpegBinary(), args);
    proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.stdout.on("end", () => {});
    proc.stderr.on("data", () => {});
    proc.on("close", (code) => {
      if (code === 0 || chunks.length > 0) {
        resolve(Buffer.concat(chunks).toString("utf-8"));
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
    proc.on("error", reject);
  });
}

async function convertAssToVttViaFfmpeg(assPath: string): Promise<string> {
  return runFfmpegToString(["-i", assPath, "-f", "webvtt", "pipe:1"]);
}

async function extractEmbeddedSubtitleViaFfmpeg(videoPath: string, streamIndex: number): Promise<string> {
  return runFfmpegToString([
    "-i", videoPath,
    "-map", `0:${streamIndex}`,
    "-f", "webvtt",
    "pipe:1",
  ]);
}

export async function getSubtitleAsVtt(
  trackId: string,
  type: "external" | "embedded",
  filePath?: string,
  streamIndex?: number,
  sourceVideoPath?: string,
): Promise<Buffer> {
  await ensureSubtitleCacheDir();
  const cacheKey = `${trackId.replace(/[^a-z0-9_-]/gi, "_")}`;
  const cachePath = path.join(SUBTITLE_CACHE_DIR, `${cacheKey}.vtt`);

  if (await fileExists(cachePath)) {
    return readFile(cachePath);
  }

  let vttContent: string;

  if (type === "external" && filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".vtt") {
      const raw = await readFile(filePath, "utf-8");
      vttContent = raw.startsWith("WEBVTT") ? raw : `WEBVTT\n\n${raw}`;
    } else if (ext === ".srt") {
      const raw = await readFile(filePath, "utf-8");
      vttContent = srtToVtt(raw);
    } else if (ext === ".ass") {
      vttContent = await convertAssToVttViaFfmpeg(filePath);
    } else {
      throw new Error(`Unsupported subtitle format: ${ext}`);
    }
  } else if (type === "embedded" && sourceVideoPath != null && streamIndex != null) {
    vttContent = await extractEmbeddedSubtitleViaFfmpeg(sourceVideoPath, streamIndex);
  } else {
    throw new Error("Invalid subtitle track parameters");
  }

  await writeFile(cachePath, vttContent, "utf-8");
  return Buffer.from(vttContent, "utf-8");
}
