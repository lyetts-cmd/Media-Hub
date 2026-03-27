import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { artistsTable } from "./artists";

export const albumsTable = pgTable("albums", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  artistId: integer("artist_id").references(() => artistsTable.id, { onDelete: "set null" }),
  year: integer("year"),
  genre: text("genre"),
  hasArt: boolean("has_art").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAlbumSchema = createInsertSchema(albumsTable).omit({ id: true, createdAt: true });
export type InsertAlbum = z.infer<typeof insertAlbumSchema>;
export type Album = typeof albumsTable.$inferSelect;
