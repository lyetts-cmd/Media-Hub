import { pgTable, serial, integer, text, customType, timestamp } from "drizzle-orm/pg-core";
import { albumsTable } from "./albums";

const bytea = customType<{ data: Buffer; notNull: false; default: false }>({
  dataType() {
    return "bytea";
  },
});

export const albumArtTable = pgTable("album_art", {
  id: serial("id").primaryKey(),
  albumId: integer("album_id").notNull().references(() => albumsTable.id, { onDelete: "cascade" }).unique(),
  data: bytea("data").notNull(),
  mimeType: text("mime_type").notNull().default("image/jpeg"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AlbumArt = typeof albumArtTable.$inferSelect;
