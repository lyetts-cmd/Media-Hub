# Installing Cadence on a Proxmox LXC Container (bare-metal)

This guide installs Cadence directly inside an LXC container — no Docker needed.
Node.js, PostgreSQL, and FFmpeg run as native system services managed by systemd.

---

## Requirements

- Proxmox LXC container running **Debian 12 (Bookworm)** or **Ubuntu 22.04 / 24.04**
- At least **1 GB RAM** and **4 GB disk** in the container
- Internet access from the container during setup

---

## Option A — Automated setup script (recommended)

Copy the project to the container (see "Getting the files" below), then run:

```bash
sudo bash install/setup-linux.sh
```

The script installs all dependencies, creates the database, builds the app, sets
up a `cadence` system user, and registers a systemd service. Skip to
[Step 6 — Add your library](#step-6--add-your-library) when it finishes.

---

## Option B — Manual step-by-step

### Step 1 — Install system dependencies

```bash
sudo apt-get update
sudo apt-get install -y curl ffmpeg

# Node.js 20 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs

# pnpm
sudo npm install -g pnpm@9

# PostgreSQL 16
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

---

### Step 2 — Get the project files

#### Option B1 — Clone with git

```bash
sudo git clone https://github.com/lyetts-cmd/Media-Hub.git /opt/cadence-music
```

#### Option B2 — Copy with tar (no git required)

On your **build machine**, create the archive:

```bash
tar -czf cadence-update.tar.gz \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.cache' \
  --exclude='.local' \
  --exclude='*/dist' \
  --exclude='*.log' \
  .
```

Copy it to the container and extract:

```bash
scp cadence-update.tar.gz root@<lxc-ip>:/tmp/
# On the container:
sudo mkdir -p /opt/cadence-music
sudo tar -xzf /tmp/cadence-update.tar.gz -C /opt/cadence-music
```

---

### Step 3 — Create the system user

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin cadence
sudo chown -R cadence:cadence /opt/cadence-music
```

---

### Step 4 — Set up PostgreSQL

```bash
# Create the database user and database
sudo -u postgres psql << 'SQL'
CREATE USER cadence WITH PASSWORD 'change-this-password';
CREATE DATABASE cadence_music OWNER cadence;
GRANT ALL PRIVILEGES ON DATABASE cadence_music TO cadence;
SQL
```

---

### Step 5 — Configure environment

```bash
sudo cp /opt/cadence-music/install/config.example.env /opt/cadence-music/.env
sudo nano /opt/cadence-music/.env
```

Set at minimum:

```
DATABASE_URL=postgres://cadence:change-this-password@localhost:5432/cadence_music
PORT=4000
NODE_ENV=production
MUSIC_DIR=/your/media/path
```

Adjust `TRANSCODE_WORKERS` and `FFMPEG_THREADS` for your hardware — see
the comments in the file for recommended values.

---

### Step 6 — Install dependencies and build

```bash
cd /opt/cadence-music
sudo -u cadence pnpm install --frozen-lockfile
sudo -u cadence pnpm --filter @workspace/api-server run build
sudo -u cadence pnpm --filter @workspace/web-client run build
```

> **Note:** The first `pnpm install` downloads all packages and may take a few
> minutes depending on your connection speed.

---

### Step 7 — Run database migrations

```bash
cd /opt/cadence-music
sudo -u cadence node artifacts/api-server/dist/migrate.mjs
```

Expected output:

```
Running Cadence database migrations...

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

### Step 8 — Install the systemd service

```bash
sudo cp /opt/cadence-music/install/cadence-music.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now cadence-music
```

Check that it started:

```bash
sudo systemctl status cadence-music
```

---

## Step 6 — Add your library

Open a browser and navigate to your container's IP address:

```
http://<container-ip>:4000
```

Go to **Settings**, add your media directory path, and click **Scan**.

---

## Updating

### With git

```bash
cd /opt/cadence-music
sudo git pull
sudo -u cadence pnpm install --frozen-lockfile
sudo -u cadence pnpm --filter @workspace/api-server run build
sudo -u cadence pnpm --filter @workspace/web-client run build
sudo -u cadence node artifacts/api-server/dist/migrate.mjs
sudo systemctl restart cadence-music
```

### Without git (tar)

On your build machine, create a fresh archive:

```bash
tar -czf cadence-update.tar.gz \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.cache' \
  --exclude='.local' \
  --exclude='*/dist' \
  --exclude='*.log' \
  .
```

Copy and apply on the container:

```bash
scp cadence-update.tar.gz root@<lxc-ip>:/tmp/

# On the container:
cd /opt/cadence-music
sudo tar -xzf /tmp/cadence-update.tar.gz \
  --exclude='.env' \
  -C /opt/cadence-music
sudo chown -R cadence:cadence /opt/cadence-music
sudo -u cadence pnpm install --frozen-lockfile
sudo -u cadence pnpm --filter @workspace/api-server run build
sudo -u cadence pnpm --filter @workspace/web-client run build
sudo -u cadence node artifacts/api-server/dist/migrate.mjs
sudo systemctl restart cadence-music
rm /tmp/cadence-update.tar.gz
```

---

## Useful commands

```bash
# View live logs
sudo journalctl -u cadence-music -f

# Restart the service
sudo systemctl restart cadence-music

# Stop / start
sudo systemctl stop cadence-music
sudo systemctl start cadence-music

# Check status
sudo systemctl status cadence-music
```

---

## Troubleshooting

### Service fails to start

```bash
sudo journalctl -u cadence-music -n 50 --no-pager
```

Common causes:
- **Wrong `DATABASE_URL`** — check the password matches the PostgreSQL user
- **`PORT` already in use** — change `PORT` in `.env` to a free port
- **`dist/` missing** — the build step didn't complete; re-run `pnpm run build`

### PostgreSQL connection refused

```bash
sudo systemctl status postgresql
sudo -u postgres psql -c "\l"   # list databases
```

### FFmpeg not found

```bash
ffmpeg -version
sudo apt-get install -y ffmpeg
```

### Reset the database (deletes all indexed data, not your files)

```bash
sudo -u postgres psql -c "DROP DATABASE cadence_music;"
sudo -u postgres psql -c "CREATE DATABASE cadence_music OWNER cadence;"
sudo -u cadence node /opt/cadence-music/artifacts/api-server/dist/migrate.mjs
```
