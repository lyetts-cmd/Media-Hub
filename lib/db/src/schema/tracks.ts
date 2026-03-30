import { pgTable, serial, text, integer, real, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { albumsTable } from "./albums";
import { artistsTable } from "./artists";
import { librariesTable } from "./libraries";
import { genresTable } from "./genres";

export const tracksTable = pgTable(
  "tracks",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    artistId: integer("artist_id").references(() => artistsTable.id, { onDelete: "set null" }),
    albumId: integer("album_id").references(() => albumsTable.id, { onDelete: "set null" }),
    libraryId: integer("library_id").references(() => librariesTable.id, { onDelete: "cascade" }),
    trackNumber: integer("track_number"),
    discNumber: integer("disc_number"),
    durationSeconds: real("duration_seconds"),
    genre: text("genre"),
    genreId: integer("genre_id").references(() => genresTable.id, { onDelete: "set null" }),
    year: integer("year"),
    filePath: text("file_path").notNull().unique(),
    mimeType: text("mime_type").notNull(),
    fileModifiedAt: timestamp("file_modified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    liked: boolean("liked").notNull().default(false),
    likedAt: timestamp("liked_at", { withTimezone: true }),
  },
  (table) => ({
    artistIdx: index("tracks_artist_idx").on(table.artistId),
    albumIdx: index("tracks_album_idx").on(table.albumId),
    libraryIdx: index("tracks_library_idx").on(table.libraryId),
  }),
);

export const insertTrackSchema = createInsertSchema(tracksTable).omit({ id: true, createdAt: true });
export type InsertTrack = z.infer<typeof insertTrackSchema>;
export type Track = typeof tracksTable.$inferSelect;
