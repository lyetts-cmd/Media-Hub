import { pgTable, serial, text, integer, real, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { librariesTable } from "./libraries";

export interface SubtitleTrack {
  id: string;
  label: string;
  language?: string;
  type: "external" | "embedded";
  path?: string;
  streamIndex?: number;
}

export const videosTable = pgTable(
  "videos",
  {
    id: serial("id").primaryKey(),
    libraryId: integer("library_id").references(() => librariesTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    filePath: text("file_path").notNull().unique(),
    durationSeconds: real("duration_seconds"),
    width: integer("width"),
    height: integer("height"),
    videoCodec: text("video_codec"),
    audioCodec: text("audio_codec"),
    mimeType: text("mime_type").notNull(),
    genre: text("genre"),
    year: integer("year"),
    subtitleTracks: jsonb("subtitle_tracks").$type<SubtitleTrack[]>().default([]),
    transcodingStatus: text("transcoding_status").notNull().default("none"),
    transcodedPath: text("transcoded_path"),
    fileModifiedAt: timestamp("file_modified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    libraryIdx: index("videos_library_idx").on(table.libraryId),
  }),
);

export const insertVideoSchema = createInsertSchema(videosTable).omit({ id: true, createdAt: true });
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Video = typeof videosTable.$inferSelect;
