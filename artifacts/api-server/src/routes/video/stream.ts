import { Router, type IRouter } from "express";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { db } from "@workspace/db";
import { videosTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { enqueueVideoTranscode } from "../../lib/video-transcode";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

async function streamRange(
  filePath: string,
  mimeType: string,
  req: Parameters<Parameters<IRouter["get"]>[1]>[0],
  res: Parameters<Parameters<IRouter["get"]>[1]>[1],
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

router.get("/stream/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const videos = await db
    .select({
      filePath: videosTable.filePath,
      mimeType: videosTable.mimeType,
      transcodingStatus: videosTable.transcodingStatus,
      transcodedPath: videosTable.transcodedPath,
    })
    .from(videosTable)
    .where(eq(videosTable.id, id))
    .limit(1);

  if (videos.length === 0) {
    res.status(404).json({ error: "Video not found" });
    return;
  }

  const video = videos[0];
  const forceNative = req.query.native === "1";

  if (video.transcodingStatus === "done" && video.transcodedPath && !forceNative) {
    await streamRange(video.transcodedPath, "video/mp4", req, res);
    return;
  }

  if (video.transcodingStatus === "none" || (video.transcodingStatus === "done" && forceNative)) {
    await streamRange(video.filePath, video.mimeType, req, res);
    return;
  }

  if (video.transcodingStatus === "pending") {
    enqueueVideoTranscode(id).catch((err) => {
      logger.error({ err, videoId: id }, "Failed to enqueue video transcode");
    });
  }

  res.status(503).json({
    error: "Video is being transcoded for web compatibility. Try again shortly.",
    transcodingStatus: video.transcodingStatus,
  });
});

export default router;
