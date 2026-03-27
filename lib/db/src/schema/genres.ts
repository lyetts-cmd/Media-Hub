import { pgTable, serial, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const genresTable = pgTable("genres", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const insertGenreSchema = createInsertSchema(genresTable).omit({ id: true });
export type InsertGenre = z.infer<typeof insertGenreSchema>;
export type Genre = typeof genresTable.$inferSelect;
