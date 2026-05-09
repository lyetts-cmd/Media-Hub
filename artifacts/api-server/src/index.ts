import { execFile } from "node:child_process";
import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

execFile("ffmpeg", ["-version"], (err) => {
  if (err) {
    logger.warn(
      "ffmpeg not found on PATH — WMA/APE transcoding will not work. " +
      "Install it with: sudo apt install ffmpeg",
    );
  } else {
    logger.info("ffmpeg is available");
  }
});

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
