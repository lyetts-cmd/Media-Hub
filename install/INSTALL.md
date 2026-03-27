# Installing Cadence Music on a Raspberry Pi

Cadence Music is a single Node.js process that serves both the API and the web UI. This guide sets it up as a background service that starts automatically on boot.

## Requirements

- Raspberry Pi running Raspberry Pi OS (64-bit recommended) or any Debian-based Linux
- Node.js 20 LTS or later
- PostgreSQL 14 or later
- pnpm 9 or later
- At least 256 MB of free RAM; 512 MB+ recommended

---

## Step 1 — Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # should print v20.x.x or later
```

## Step 2 — Install pnpm

```bash
sudo npm install -g pnpm
pnpm --version
```

## Step 3 — Install PostgreSQL

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

## Step 4 — Get the code

Clone the repository (or copy the project folder) to `/opt/cadence-music`:

```bash
sudo mkdir -p /opt/cadence-music
sudo chown $USER:$USER /opt/cadence-music
git clone https://github.com/your-org/cadence-music.git /opt/cadence-music
cd /opt/cadence-music
```

## Step 5 — Install dependencies

```bash
pnpm install --frozen-lockfile
```

## Step 6 — Configure environment

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

## Step 7 — Build the application

```bash
pnpm run build:prod
```

This compiles the API server and builds the web UI. It only needs to be re-run after updating the code.

## Step 8 — Set up the database

```bash
source .env
pnpm run db:migrate
```

This applies the schema to your PostgreSQL database. It is safe to run again after updates — it only adds missing tables/columns.

## Step 9 — Test the server

```bash
source .env && pnpm run start:prod
```

Open `http://<raspberry-pi-ip>:4000` in your browser. You should see Cadence Music. Press Ctrl+C to stop before setting up the service.

---

## Step 10 — Install as a system service

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

```bash
cd /opt/cadence-music
git pull
pnpm install --frozen-lockfile
pnpm run build:prod
pnpm run db:migrate
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
