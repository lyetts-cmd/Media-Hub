import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { videosTable } from "@workspace/db/schema";
import type { SubtitleTrack } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getSubtitleAsVtt } from "../../lib/subtitle-cache";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

router.get("/subtitles/:videoId/:trackId", async (req, res) => {
  const videoId = Number(req.params.videoId);
  const trackId = req.params.trackId;

  if (isNaN(videoId)) {
    res.status(400).json({ error: "Invalid videoId" });
    return;
  }

  const videos = await db
    .select({ filePath: videosTable.filePath, subtitleTracks: videosTable.subtitleTracks })
    .from(videosTable)
    .where(eq(videosTable.id, videoId))
    .limit(1);

  if (videos.length === 0) {
    res.status(404).json({ error: "Video not found" });
    return;
  }

  const video = videos[0];
  const tracks = (video.subtitleTracks ?? []) as SubtitleTrack[];
  const track = tracks.find((t) => t.id === trackId);

  if (!track) {
    res.status(404).json({ error: "Subtitle track not found" });
    return;
  }

  try {
    const cacheKey = `${videoId}-${trackId}`;
    const vttBuffer = await getSubtitleAsVtt(
      cacheKey,
      track.type,
      track.path,
      track.streamIndex,
      track.type === "embedded" ? video.filePath : undefined,
    );

    res.setHeader("Content-Type", "text/vtt; charset=utf-8");
    res.setHeader("Content-Length", vttBuffer.length);
    res.send(vttBuffer);
  } catch (err) {
    logger.error({ err, videoId, trackId }, "Failed to serve subtitle");
    res.status(500).json({ error: "Failed to process subtitle track" });
  }
});

export default router;
