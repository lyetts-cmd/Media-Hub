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

    // v2: liked songs columns
    await client.query(`ALTER TABLE tracks ADD COLUMN IF NOT EXISTS liked boolean NOT NULL DEFAULT false`);
    await client.query(`ALTER TABLE tracks ADD COLUMN IF NOT EXISTS liked_at timestamptz`);
    console.log("  ok  tracks.liked / tracks.liked_at");

    // v3: library type (music | video)
    await client.query(`ALTER TABLE libraries ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'music'`);
    console.log("  ok  libraries.type");

    // v3: videos table
    await client.query(`
      CREATE TABLE IF NOT EXISTS videos (
        id                 serial      PRIMARY KEY,
        library_id         integer     REFERENCES libraries(id) ON DELETE CASCADE,
        title              text        NOT NULL,
        file_path          text        NOT NULL UNIQUE,
        duration_seconds   real,
        width              integer,
        height             integer,
        video_codec        text,
        audio_codec        text,
        mime_type          text        NOT NULL,
        genre              text,
        year               integer,
        subtitle_tracks    jsonb       NOT NULL DEFAULT '[]',
        transcoding_status text        NOT NULL DEFAULT 'none',
        transcoded_path    text,
        file_modified_at   timestamptz,
        created_at         timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(
      "CREATE INDEX IF NOT EXISTS videos_library_idx ON videos(library_id)"
    );
    console.log("  ok  videos");

    // v2: playlists
    await client.query(`
      CREATE TABLE IF NOT EXISTS playlists (
        id         serial      PRIMARY KEY,
        name       text        NOT NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    console.log("  ok  playlists");

    await client.query(`
      CREATE TABLE IF NOT EXISTS playlist_tracks (
        id          serial      PRIMARY KEY,
        playlist_id integer     NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
        track_id    integer     NOT NULL REFERENCES tracks(id)    ON DELETE CASCADE,
        position    integer     NOT NULL,
        added_at    timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(
      "CREATE INDEX IF NOT EXISTS playlist_tracks_playlist_idx ON playlist_tracks(playlist_id)"
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS playlist_tracks_track_idx ON playlist_tracks(track_id)"
    );
    console.log("  ok  playlist_tracks");

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
