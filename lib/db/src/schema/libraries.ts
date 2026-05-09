import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const librariesTable = pgTable("libraries", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  path: text("path").notNull().unique(),
  type: text("type").notNull().default("music"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastScannedAt: timestamp("last_scanned_at", { withTimezone: true }),
});

export const insertLibrarySchema = createInsertSchema(librariesTable).omit({ id: true, createdAt: true });
export type InsertLibrary = z.infer<typeof insertLibrarySchema>;
export type Library = typeof librariesTable.$inferSelect;
