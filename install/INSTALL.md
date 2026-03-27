# Installing Cadence Music on a Raspberry Pi

Cadence Music is a single Node.js process that serves both the API and the web UI. The repository includes pre-built binaries, so **no compilation is needed on the Pi** — just clone, configure, and run.

## Requirements

- Raspberry Pi running Raspberry Pi OS (64-bit recommended) or any Debian-based Linux
- Node.js 20 LTS or later
- PostgreSQL 14 or later
- A GitHub account (to clone the repository)

---

## Step 1 — Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # should print v20.x.x or later
```

## Step 2 — Install PostgreSQL

```bash
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

Create the database and user:

```bash
sudo -u postgres psql <<'SQL'
CREATE USER cadence WITH PASSWORD 'yourpassword';
CREATE DATABASE cadence_music OWNER cadence;
SQL
```

---

## Step 3 — Get the code

Clone the repository to `/opt/cadence-music`. The pre-built server and web UI are included, so no build step is needed.

```bash
sudo mkdir -p /opt/cadence-music
sudo chown $USER:$USER /opt/cadence-music
git clone https://github.com/your-org/cadence-music.git /opt/cadence-music
cd /opt/cadence-music
```

## Step 4 — Configure environment

```bash
cp install/config.example.env .env
nano .env
```

Edit the values:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | Port the server listens on (default: `4000`) |
| `NODE_ENV` | Must be `production` |

Example `.env`:

```
DATABASE_URL=postgres://cadence:yourpassword@localhost:5432/cadence_music
PORT=4000
NODE_ENV=production
```

## Step 5 — Set up the database

This creates all the required tables. It is safe to run again after updates — it only adds what is missing.

```bash
source .env
node artifacts/api-server/dist/migrate.mjs
```

You should see output like:

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

## Step 6 — Test the server

```bash
source .env && node artifacts/api-server/dist/index.mjs
```

Open `http://<raspberry-pi-ip>:4000` in your browser. You should see Cadence Music. Press Ctrl+C to stop before setting up the service.

---

## Step 7 — Install as a system service

Create a dedicated user:

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin cadence
sudo chown -R cadence:cadence /opt/cadence-music
```

Copy the service file and enable it:

```bash
sudo cp install/cadence-music.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable cadence-music
sudo systemctl start cadence-music
```

Check that it started successfully:

```bash
sudo systemctl status cadence-music
sudo journalctl -u cadence-music -f
```

---

## Updating

Whenever you make code changes in Replit, run this **once on Replit** to build and push:

```bash
pnpm run deploy
```

Then on the Pi, update is just two commands:

```bash
cd /opt/cadence-music
git pull
sudo systemctl restart cadence-music
```

If the update included database schema changes, also run the migration before restarting:

```bash
cd /opt/cadence-music
git pull
source .env && node artifacts/api-server/dist/migrate.mjs
sudo systemctl restart cadence-music
```

---

## Adding music

Once Cadence Music is running, open the web UI and go to **Settings**. Add a library path pointing to your music directory (e.g. `/home/pi/Music`). Click **Scan** — the server will index all audio files it finds.

Supported formats: MP3, FLAC, OGG, M4A, AAC, WAV, WMA, Opus, APE.

---

## Accessing on your network

By default the server listens on all interfaces. To access it from other devices on your local network, use your Pi's local IP address:

```
http://192.168.1.xx:4000
```

To find your Pi's IP: `hostname -I`

---

## Advanced: Building from Source

If you want to build the application yourself (e.g. on a different architecture, or you prefer not to use pre-built binaries), you will need:

- Node.js 20 LTS or later
- pnpm 9 or later (`sudo npm install -g pnpm`)

Then:

```bash
cd /opt/cadence-music
pnpm install
pnpm run build:prod
source .env && node artifacts/api-server/dist/migrate.mjs
node artifacts/api-server/dist/index.mjs
```

> **Note for ARM64 (Raspberry Pi):** If `pnpm run build:prod` fails with a Rollup native module error, run `pnpm install --force` first, then retry the build.

The normal workflow is to build in Replit (x86_64) and use `pnpm run deploy` to commit and push the built files, so the Pi only ever needs `git pull`.
