# Installing Cadence Music with Docker (Raspberry Pi / Linux)

This is the recommended installation path. Instead of manually setting up Node.js, PostgreSQL, and FFmpeg, you run a single command and Docker handles everything — building the application from source, setting up the database, and starting all services.

**Requirements:** Docker and Docker Compose only — no other software needed.

---

## Prerequisites

### Install Docker and Docker Compose on Raspberry Pi OS

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Add your user to the docker group (so you don't need sudo every time)
sudo usermod -aG docker $USER

# Log out and back in for the group change to take effect, then verify:
docker --version
docker compose version
```

> **Note:** Docker Compose v2 is included with modern Docker installs. If `docker compose` (with a space) fails, update Docker.

---

## Step 1 — Clone the repository

```bash
git clone https://github.com/your-org/cadence-music.git
cd cadence-music
```

---

## Step 2 — Configure environment

Copy the example file and edit it:

```bash
cp .env.example .env
nano .env
```

The variables to set:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Host port the app is exposed on | `4000` |
| `POSTGRES_PASSWORD` | Password for the database user | `changeme` |
| `DATABASE_URL` | Full PostgreSQL connection string | See `.env.example` |
| `MUSIC_DIR` | **Absolute path** to your music library on the Pi | `./music` |

Example `.env` for a Pi with music in `/home/pi/Music`:

```
PORT=4000
POSTGRES_PASSWORD=a-strong-password-here
DATABASE_URL=postgres://cadence:a-strong-password-here@db:5432/cadence_music
MUSIC_DIR=/home/pi/Music
```

> **Important:** Change `POSTGRES_PASSWORD` to something unique before first run, and update the password in `DATABASE_URL` to match. The hostname `db` in the URL refers to the database container — do not change it.

---

## Step 3 — Build and start the stack

This builds the application from source and starts both the app and database containers:

```bash
docker compose up -d
```

The first run takes several minutes while Docker downloads base images, compiles the frontend and API server, and installs dependencies. Subsequent starts are nearly instant.

> **On Raspberry Pi:** Docker uses QEMU to run the compile step in an amd64 environment (required for reliable Vite/Rollup builds). This is automatic — no extra setup needed — but the first build may take 10–20 minutes on a Pi 4. Runtime performance is fully native.

Check that both containers are running:

```bash
docker compose ps
```

You should see `cadence-app-1` and `cadence-db-1` both with status `Up`.

---

## Step 4 — Run the initial database migration

This creates all required tables. Only needed on first install:

```bash
docker compose exec app node artifacts/api-server/dist/migrate.mjs
```

Expected output:

```
Running Cadence Music database migrations...

  ok  libraries
  ok  artists
  ok  genres
  ok  albums
  ok  album_art
  ok  tracks
  ok  indexes

Migration complete. Your database is ready.
```

---

## Step 5 — Open Cadence Music

Open a browser and navigate to your Pi's local IP address:

```
http://<raspberry-pi-ip>:4000
```

To find your Pi's IP: `hostname -I`

---

## Step 6 — Add your music library

In the Cadence Music web UI, go to **Settings** and add your music directory. Since the folder is mounted inside the container at `/music`, add the path `/music` in the settings.

Click **Scan** to index your files. Supported formats: MP3, FLAC, OGG, M4A, AAC, WAV, WMA, Opus, APE.

---

## Updating

Updating is a single command:

```bash
cd cadence-music
bash update.sh
```

The script pulls the latest code, rebuilds the image from source, restarts the stack, and runs any pending database migrations.

---

## Accessing on your network

The app listens on all interfaces by default. Access it from any device on your local network using your Pi's IP:

```
http://192.168.1.xx:4000
```

For remote access via Cloudflare Tunnel, see the [Remote Sharing via Cloudflare Tunnel](INSTALL.md#remote-sharing-via-cloudflare-tunnel) section in `INSTALL.md`. The steps are identical — just point the tunnel at `localhost:4000`.

---

## Troubleshooting

### View live logs

```bash
# All services
docker compose logs -f

# App only
docker compose logs -f app

# Database only
docker compose logs -f db
```

### Container won't start

Check the logs for the specific error:

```bash
docker compose logs app
```

Common causes:
- `PORT` already in use — change `PORT` in your `.env` to a free port.
- `MUSIC_DIR` path doesn't exist — create the directory or correct the path in `.env`.
- Wrong password in `DATABASE_URL` — make sure it matches `POSTGRES_PASSWORD`.

### Reset the database

> **Warning:** This permanently deletes all indexed music data. Your actual music files are unaffected.

```bash
docker compose down -v
docker compose up -d
docker compose exec app node artifacts/api-server/dist/migrate.mjs
```

### Rebuild the image from scratch

If you run into a corrupted image or dependency issues:

```bash
docker compose build --no-cache
docker compose up -d
```

### Check FFmpeg is available inside the container

```bash
docker compose exec app ffmpeg -version
```

### Open a shell inside the app container

```bash
docker compose exec app bash
```

---

## Stopping and starting

```bash
# Stop the stack (data is preserved)
docker compose stop

# Start it again
docker compose start

# Stop and remove containers (data volume is preserved)
docker compose down

# Stop, remove containers, AND delete database data
docker compose down -v
```

---

## Auto-start on boot

The containers are configured with `restart: unless-stopped`, so they start automatically when the Pi reboots, as long as the Docker daemon itself starts on boot (which it does by default after the install above).

To verify Docker starts on boot:

```bash
sudo systemctl is-enabled docker
```

Should print `enabled`.
