import { Router, type IRouter } from "express";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const router: IRouter = Router();

router.get("/fs/browse", async (req, res) => {
  const dirPath = (req.query.path as string) || "/";

  let resolved: string;
  try {
    resolved = path.resolve(dirPath);
  } catch {
    res.status(400).json({ error: "Invalid path" });
    return;
  }

  try {
    const stats = await stat(resolved);
    if (!stats.isDirectory()) {
      res.status(400).json({ error: "Path is not a directory" });
      return;
    }
  } catch {
    res.status(400).json({ error: `Path does not exist or is not accessible: ${resolved}` });
    return;
  }

  let entries: { name: string; path: string }[];
  try {
    const dirents = await readdir(resolved, { withFileTypes: true });
    entries = dirents
      .filter((d) => d.isDirectory())
      .map((d) => ({ name: d.name, path: path.join(resolved, d.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    res.status(400).json({ error: `Cannot read directory: ${resolved}` });
    return;
  }

  res.json({ path: resolved, entries });
});

export default router;
