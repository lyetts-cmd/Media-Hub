# Cadence Music — Self-Hosted Music Server

## Overview

A self-hosted music media server ("Cadence") with a web client. The server scans music directories, reads metadata from audio files, stores it in a PostgreSQL database, and streams audio to any browser on the network. The web client provides a full music browsing and playback experience.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS + Shadcn/ui
- **Music metadata**: `music-metadata` npm package

## Architecture

```text
cadence-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (music backend)
│   └── web-client/         # React + Vite web client ("Cadence")
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/
└── ...config files
```

## Music Features

### Server (API)
- **Library management** — Add/remove music folder paths via API or Settings UI
- **File scanner** — Walks library directories, reads ID3/metadata tags, upserts into DB
  - Supports: mp3, flac, ogg, m4a, aac, wav, wma, opus, ape
  - Detects new, changed (by mtime), and deleted files
  - Reads album art from tags and stores in DB
- **Audio streaming** — HTTP range request support for seeking
- **Browsing APIs** — Artists, Albums, Tracks, Genres, Folder browser

### Web Client (`/`)
- Browse by **Albums**, **Artists**, **Genres**
- **Folder browser** (mirrors on-disk hierarchy)
- **Bottom player bar** — play/pause, prev/next, seek, volume, now-playing display
- **Settings** page — add/remove library paths, trigger scans, view scan progress

## API Routes

All routes are prefixed with `/api/music/`:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/music/libraries` | List configured libraries |
| POST | `/music/libraries` | Add a library path |
| DELETE | `/music/libraries/:id` | Remove a library |
| POST | `/music/libraries/:id/scan` | Trigger async library scan |
| GET | `/music/scan/status` | Get current scan status |
| GET | `/music/artists` | List artists (paginated) |
| GET | `/music/artists/:id` | Artist detail + albums |
| GET | `/music/albums` | List albums (paginated) |
| GET | `/music/albums/:id` | Album detail + tracks |
| GET | `/music/tracks` | List tracks (paginated) |
| GET | `/music/tracks/:id` | Track detail |
| GET | `/music/genres` | List genres |
| GET | `/music/genres/:name/tracks` | Tracks by genre |
| GET | `/music/browse?path=` | Folder browser |
| GET | `/music/stream/:id` | Stream audio file (range requests) |
| GET | `/music/art/:albumId` | Album cover art image |

## Database Schema

- `libraries` — Configured music folder paths
- `artists` — Indexed artist names
- `albums` — Albums with artist FK, year, genre, hasArt flag
- `album_art` — Binary album art storage (bytea)
- `tracks` — Full track metadata with file path, duration, track/disc numbers

## Running

- API server: `pnpm --filter @workspace/api-server run dev`
- Web client: `pnpm --filter @workspace/web-client run dev`
- DB schema push: `pnpm --filter @workspace/db run push`
- Codegen: `pnpm --filter @workspace/api-spec run codegen`

## Usage

1. Open the web client
2. Go to **Settings** (bottom of sidebar)
3. Enter a library name and the **absolute path** to your music folder (e.g. `/home/user/Music`)
4. Click **Add**, then **Scan**
5. Browse your library via Albums, Artists, Genres, or Browse

## Installation Guides

- [Getting Started — choose Docker vs bare-metal](install/GETTING_STARTED.md)
- [Docker install guide](install/INSTALL_DOCKER.md)
- [Bare-metal / systemd install guide](install/INSTALL.md)

## Future Work

- Video/movie support
- Remote access (beyond local VPN)
- Authentication
- Mobile app
- Playlist management
- Format transcoding
