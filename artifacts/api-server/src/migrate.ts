import { pool } from "@workspace/db";

async function migrate() {
  console.log("Running Cadence Music database migrations...\n");

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS libraries (
        id              serial      PRIMARY KEY,
        name            text        NOT NULL,
        path            text        NOT NULL UNIQUE,
        created_at      timestamptz NOT NULL DEFAULT NOW(),
        last_scanned_at timestamptz
      )
    `);
    console.log("  ok  libraries");

    await client.query(`
      CREATE TABLE IF NOT EXISTS artists (
        id         serial      PRIMARY KEY,
        name       text        NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    console.log("  ok  artists");

    await client.query(`
      CREATE TABLE IF NOT EXISTS genres (
        id   serial PRIMARY KEY,
        name text   NOT NULL UNIQUE
      )
    `);
    console.log("  ok  genres");

    await client.query(`
      CREATE TABLE IF NOT EXISTS albums (
        id         serial      PRIMARY KEY,
        title      text        NOT NULL,
        artist_id  integer     REFERENCES artists(id) ON DELETE SET NULL,
        year       integer,
        genre      text,
        has_art    boolean     NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    console.log("  ok  albums");

    await client.query(`
      CREATE TABLE IF NOT EXISTS album_art (
        id         serial      PRIMARY KEY,
        album_id   integer     NOT NULL REFERENCES albums(id) ON DELETE CASCADE UNIQUE,
        data       bytea       NOT NULL,
        mime_type  text        NOT NULL DEFAULT 'image/jpeg',
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    console.log("  ok  album_art");

    await client.query(`
      CREATE TABLE IF NOT EXISTS tracks (
        id               serial      PRIMARY KEY,
        title            text        NOT NULL,
        artist_id        integer     REFERENCES artists(id)   ON DELETE SET NULL,
        album_id         integer     REFERENCES albums(id)    ON DELETE SET NULL,
        library_id       integer     REFERENCES libraries(id) ON DELETE CASCADE,
        track_number     integer,
        disc_number      integer,
        duration_seconds real,
        genre            text,
        genre_id         integer     REFERENCES genres(id)    ON DELETE SET NULL,
        year             integer,
        file_path        text        NOT NULL UNIQUE,
        mime_type        text        NOT NULL,
        file_modified_at timestamptz,
        created_at       timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    console.log("  ok  tracks");

    await client.query(
      "CREATE INDEX IF NOT EXISTS tracks_artist_idx  ON tracks(artist_id)"
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS tracks_album_idx   ON tracks(album_id)"
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS tracks_library_idx ON tracks(library_id)"
    );
    console.log("  ok  indexes");

    console.log("\nMigration complete. Your database is ready.");
  } catch (err) {
    console.error("\nMigration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
