import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { tracksTable } from "./tracks";

export const playlistsTable = pgTable("playlists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const playlistTracksTable = pgTable(
  "playlist_tracks",
  {
    id: serial("id").primaryKey(),
    playlistId: integer("playlist_id")
      .notNull()
      .references(() => playlistsTable.id, { onDelete: "cascade" }),
    trackId: integer("track_id")
      .notNull()
      .references(() => tracksTable.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    playlistIdx: index("playlist_tracks_playlist_idx").on(table.playlistId),
  }),
);

export type Playlist = typeof playlistsTable.$inferSelect;
export type PlaylistTrack = typeof playlistTracksTable.$inferSelect;
