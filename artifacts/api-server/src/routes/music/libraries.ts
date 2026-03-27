import { Router, type IRouter } from "express";
import { access } from "node:fs/promises";
import { db } from "@workspace/db";
import { librariesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { scanLibrary, getScanStatus } from "../../lib/scanner";

const router: IRouter = Router();

router.get("/libraries", async (req, res) => {
  const libraries = await db.select().from(librariesTable).orderBy(librariesTable.createdAt);
  res.json({ libraries: libraries.map(lib => ({
    id: lib.id,
    name: lib.name,
    path: lib.path,
    createdAt: lib.createdAt,
    lastScannedAt: lib.lastScannedAt ?? null,
  }))});
});

router.post("/libraries", async (req, res) => {
  const { name, path: libPath } = req.body as { name?: string; path?: string };

  if (!name || !libPath) {
    res.status(400).json({ error: "name and path are required" });
    return;
  }

  try {
    await access(libPath);
  } catch {
    res.status(400).json({ error: `Path does not exist or is not accessible: ${libPath}` });
    return;
  }

  const [library] = await db
    .insert(librariesTable)
    .values({ name, path: libPath })
    .onConflictDoNothing()
    .returning();

  if (!library) {
    res.status(400).json({ error: "A library with this path already exists" });
    return;
  }

  // Automatically trigger a scan for the newly added library
  scanLibrary(library.id).catch((err) => {
    req.log?.error?.({ err }, "Auto-scan error after library add");
  });

  res.status(201).json({
    id: library.id,
    name: library.name,
    path: library.path,
    createdAt: library.createdAt,
    lastScannedAt: library.lastScannedAt ?? null,
  });
});

router.delete("/libraries/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const deleted = await db
    .delete(librariesTable)
    .where(eq(librariesTable.id, id))
    .returning({ id: librariesTable.id });

  if (deleted.length === 0) {
    res.status(404).json({ error: "Library not found" });
    return;
  }

  res.status(204).end();
});

router.post("/libraries/:id/scan", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const libraries = await db
    .select()
    .from(librariesTable)
    .where(eq(librariesTable.id, id))
    .limit(1);

  if (libraries.length === 0) {
    res.status(404).json({ error: "Library not found" });
    return;
  }

  scanLibrary(id).catch((err) => {
    req.log.error({ err }, "Scan error");
  });

  res.status(202).json(getScanStatus());
});

router.get("/scan/status", (_req, res) => {
  res.json(getScanStatus());
});

export default router;
