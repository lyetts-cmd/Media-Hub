# Installing Cadence Music with Docker

> **Not sure which path to take?** See the [Getting Started guide](GETTING_STARTED.md).

This is the recommended installation path. Instead of manually setting up Node.js, PostgreSQL, and FFmpeg, you run a single command and Docker handles everything.

There are two ways to get the application image:

- **Option A — Pull pre-built image (recommended, fastest):** Pull a pre-compiled multi-arch image from GitHub Container Registry. Works on both Raspberry Pi (arm64) and standard x86 Linux (amd64). No compilation step — first start takes seconds, not minutes.
- **Option B — Build from source:** Build the image locally from the repository. Useful if you have made local code changes or want to develop against the project.

**Requirements:** Docker and Docker Compose only — no other software needed.

---

## Prerequisites

### Install Docker and Docker Compose

**Debian / Ubuntu / Raspberry Pi OS**
```bash
curl -fsSL https://get.docker.com | sh

# Add your user to the docker group (so you don't need sudo every time)
sudo usermod -aG docker $USER

# Log out and back in for the group change to take effect, then verify:
docker --version
docker compose version
```

**Fedora / RHEL / Rocky / AlmaLinux**
```bash
sudo dnf install -y docker docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# Log out and back in, then verify:
docker --version
docker compose version
```

**Arch Linux**
```bash
sudo pacman -S docker docker-compose
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# Log out and back in, then verify:
docker --version
docker compose version
```

> **Note:** Docker Compose v2 is included with modern Docker installs. If `docker compose` (with a space) fails, update Docker.

---

## Step 1 — Get the docker-compose.yml

### Option A — Pull pre-built image (recommended)

You only need the `docker-compose.yml` file — no need to clone the full repository:

```bash
mkdir cadence-music && cd cadence-music
curl -fsSL https://raw.githubusercontent.com/lyetts-cmd/Media-Hub/main/docker-compose.yml -o docker-compose.yml
```

The compose file is pre-configured to pull `ghcr.io/lyetts-cmd/media-hub:latest`. To pin to a specific release, set `CADENCE_IMAGE` in your `.env` file (see Step 2).

### Option B — Build from source

Clone the full repository:

```bash
git clone https://github.com/lyetts-cmd/Media-Hub.git
cd Media-Hub
```

Then edit `docker-compose.yml` to comment out the `image:` line and uncomment the `build:` block (clearly marked inside the file).

---

## Step 2 — Configure environment

Create a `.env` file in the same directory as `docker-compose.yml`:

```bash
cp .env.example .env   # if you cloned the repo (Option B)
# — or —
nano .env              # create from scratch (Option A)
```

The variables to set:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Host port the app is exposed on | `4000` |
| `POSTGRES_PASSWORD` | Password for the database user | `changeme` |
| `DATABASE_URL` | Full PostgreSQL connection string | See below |
| `MUSIC_DIR` | **Absolute path** to your music library on the host | `./music` |
| `CADENCE_IMAGE` | Override the image tag pulled from GHCR (Option A only) | `ghcr.io/lyetts-cmd/media-hub:latest` |

Example `.env` with music in `/home/alice/Music`:

```
PORT=4000
POSTGRES_PASSWORD=a-strong-password-here
DATABASE_URL=postgres://cadence:a-strong-password-here@db:5432/cadence_music
MUSIC_DIR=/home/alice/Music
```

> **Important:** Change `POSTGRES_PASSWORD` to something unique before first run, and update the password in `DATABASE_URL` to match. The hostname `db` in the URL refers to the database container — do not change it.

For transcoding performance tuning (`TRANSCODE_WORKERS`, `FFMPEG_THREADS`, `FFMPEG_HWACCEL`), see the [Getting Started guide](GETTING_STARTED.md) for recommended values by hardware tier.

### Enabling hardware-accelerated transcoding (x86 with Intel/AMD iGPU)

If your Linux machine has an Intel or AMD integrated GPU, you can enable VAAPI hardware acceleration to reduce CPU load during transcoding. In `docker-compose.yml`, uncomment the `/dev/dri` device passthrough block (clearly marked inside the file), then add `FFMPEG_HWACCEL=vaapi` to your `.env`.

---

## Step 3 — Start the stack

### Option A — Pull and start (pre-built image)

```bash
docker compose pull   # downloads the pre-built image (fast on any hardware)
docker compose up -d
```

The image is pre-built for both `linux/amd64` and `linux/arm64`, so Docker selects the correct variant automatically.

> **On Raspberry Pi:** The pre-built arm64 image runs fully natively — no compilation or emulation happens on your device.

### Option B — Build from source and start

```bash
docker compose up -d --build
```

The first run takes several minutes while Docker downloads base images, compiles the frontend and API server, and installs dependencies. Subsequent starts are nearly instant.

> **On Raspberry Pi:** Docker uses QEMU to run the compile step in an amd64 environment (required for reliable Vite/Rollup builds). This is automatic — no extra setup needed — but the first build may take 10–20 minutes on a Pi 4. Runtime performance is fully native. **For this reason, Option A (pre-built image) is strongly recommended on Pi.**

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

Open a browser and navigate to your server's local IP address:

```
http://<server-ip>:4000
```

To find your server's IP: `hostname -I`

---

## Step 6 — Add your music library

In the Cadence Music web UI, go to **Settings** and add your music directory. Since the folder is mounted inside the container at `/music`, add the path `/music` in the settings.

Click **Scan** to index your files. Supported formats: MP3, FLAC, OGG, M4A, AAC, WAV, WMA, Opus, APE.

---

## Updating

### Option A — Pull pre-built image

```bash
cd cadence-music
docker compose pull
docker compose up -d
docker compose exec app node artifacts/api-server/dist/migrate.mjs
```

### Option B — Build from source

Updating is a single command:

```bash
cd Media-Hub
bash update.sh
```

The script pulls the latest code, rebuilds the image from source, restarts the stack, and runs any pending database migrations.

---

## Accessing on your network

The app listens on all interfaces by default. Access it from any device on your local network using your server's IP:

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

### Force-pull the latest image (Option A)

If you suspect a cached or corrupted image:

```bash
docker compose pull
docker compose up -d --force-recreate
```

### Rebuild the image from scratch (Option B)

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

The containers are configured with `restart: unless-stopped`, so they start automatically when the system reboots, as long as the Docker daemon itself starts on boot (which it does by default after the installs above).

To verify Docker starts on boot:

```bash
sudo systemctl is-enabled docker
```

Should print `enabled`.
