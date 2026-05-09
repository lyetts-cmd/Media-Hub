# Installing Cadence Music on a Raspberry Pi

> **Easier path available:** If you have Docker installed (or are happy to install it), the [Docker installation guide](INSTALL_DOCKER.md) gets Cadence Music running with a single command — no manual Node.js, PostgreSQL, or FFmpeg setup required. The steps below describe the traditional systemd/bare-metal path for users who prefer not to use Docker.

Cadence Music is a single Node.js process that serves both the API and the web UI. The repository includes pre-built binaries, so **no compilation is needed on the Pi** — just clone, configure, and run.

## Requirements

- Raspberry Pi running Raspberry Pi OS (64-bit recommended) or any Debian-based Linux
- Node.js 20 LTS or later
- PostgreSQL 14 or later
- FFmpeg (required for WMA/APE transcoding)
- A GitHub account (to clone the repository)

---

## Step 1 — Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # should print v20.x.x or later
```

## Step 2 — Install FFmpeg

FFmpeg is required to transcode WMA and APE files for browser playback. All other formats (MP3, FLAC, OGG, AAC, WAV) play directly without transcoding.

```bash
sudo apt-get install -y ffmpeg
ffmpeg -version   # should print version info
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

Clone the repository to `/opt/cadence-music`. The pre-built server and web UI are included, so no build step is needed.

```bash
sudo mkdir -p /opt/cadence-music
sudo chown $USER:$USER /opt/cadence-music
git clone https://github.com/your-org/cadence-music.git /opt/cadence-music
cd /opt/cadence-music
```

## Step 5 — Configure environment

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

## Step 6 — Set up the database

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

## Step 7 — Test the server

```bash
source .env && node artifacts/api-server/dist/index.mjs
```

Open `http://<raspberry-pi-ip>:4000` in your browser. You should see Cadence Music. Press Ctrl+C to stop before setting up the service.

---

## Step 8 — Install as a system service

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

## Remote Sharing via Cloudflare Tunnel

By default Cadence Music is only reachable on your local network. If you want to share it with guests — without requiring them to install a VPN — you can expose it over a public HTTPS URL using a Cloudflare Tunnel, then gate that URL with Cloudflare Access so only people you approve can get in.

> **Personal access:** Your WireGuard VPN (if set up on a separate Pi) remains the recommended path for your own access. Cloudflare Access is intended as a guest-sharing layer only.
>
> **Future note:** Cloudflare Access is a temporary gate. Once Cadence has a built-in login system, access control will move inside the app and the Access layer can be removed while keeping the Tunnel for the public URL.

---

### How it works

`cloudflared` runs as a lightweight daemon on your Pi. It opens an outbound connection to Cloudflare's edge — no port forwarding or public IP exposure required. Cloudflare Access sits in front of the URL: a guest visits the link, enters their email address, receives a one-time code, and is let in. Nothing to install on the guest's side.

Cloudflare Access is free for up to 50 users.

---

### Prerequisites

1. **A free Cloudflare account** — sign up at [dash.cloudflare.com](https://dash.cloudflare.com/sign-up).
2. **A domain added to Cloudflare** (recommended for a stable URL). If you just want to test, `cloudflared` can generate a temporary `trycloudflare.com` URL with no domain needed — see the script output for details.
3. Cadence Music must already be running as a service (Step 8 above).

---

### Step A — Run the setup script

On your Pi, from the Cadence Music directory:

```bash
sudo bash install/cloudflare-setup.sh
```

The script will:

1. Install `cloudflared` from the official Cloudflare APT repository.
2. Open a browser (or print a URL for you to open on another device) to authenticate with your Cloudflare account.
3. Create a named tunnel called `cadence-music`.
4. Write `/etc/cloudflared/config.yml` pointing the tunnel at `localhost:4000` (or whatever `PORT` you configured).
5. Install and start `cloudflared` as a systemd service so the tunnel comes back up automatically after a reboot.

Check that it is running:

```bash
sudo systemctl status cloudflared
sudo journalctl -u cloudflared -f
```

---

### Step B — Get a shareable URL

A named Cloudflare Tunnel does not expose a public URL automatically — you need to route a hostname to it. There are two options:

**Option 1 — Custom domain (recommended, stable URL)**

If you have a domain on Cloudflare, map a subdomain to the tunnel:

```bash
cloudflared tunnel route dns cadence-music music.yourdomain.com
```

Then edit `/etc/cloudflared/config.yml` to add a hostname rule above the catch-all `- service:` line:

```yaml
ingress:
  - hostname: music.yourdomain.com
    service: http://localhost:4000
  - service: http://localhost:4000
```

Restart the service: `sudo systemctl restart cloudflared`

Your tunnel will now be reachable at `https://music.yourdomain.com`. You can confirm it is healthy in the [Zero Trust dashboard](https://one.dash.cloudflare.com) under **Networks → Tunnels**.

**Option 2 — Quick test without a domain (temporary URL)**

If you do not have a domain yet and just want to try things out, stop the cloudflared service and run the quick-tunnel command instead:

```bash
sudo systemctl stop cloudflared
cloudflared tunnel --url http://localhost:4000
```

This prints a randomly generated `trycloudflare.com` URL that works immediately. The URL changes every time you run the command and the tunnel stops when you press Ctrl+C — so this is for testing only, not for sharing with guests long-term.

---

### Step C — Configure Cloudflare Access (email allowlist)

This step gates your tunnel URL so only people you approve can visit it.

1. In the [Zero Trust dashboard](https://one.dash.cloudflare.com), go to **Access → Applications → Add an application**.
2. Choose **Self-hosted**.
3. Set the **Application domain** to your tunnel URL or custom domain.
4. Under **Policies**, create a policy with **Action: Allow** and add an **Include** rule of type **Emails**, listing each guest's email address.
5. Save. Cloudflare will now show an email-OTP gate before anyone can reach Cadence.

For detailed UI steps, see the [Cloudflare Access documentation](https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-apps/).

---

### Guest experience

1. Guest visits the public URL.
2. Cloudflare Access shows a login page — guest enters their email.
3. If their email is on the allowlist, they receive a one-time code by email.
4. They enter the code and are redirected to Cadence Music.

No app to install, no VPN configuration required.

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
