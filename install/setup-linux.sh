#!/usr/bin/env bash
# Cadence bare-metal installer for Debian/Ubuntu LXC containers (and generic Linux).
# Run as root or with sudo:  sudo bash install/setup-linux.sh
set -euo pipefail

INSTALL_DIR="/opt/cadence-music"
SERVICE_USER="cadence"
DB_NAME="cadence_music"
DB_USER="cadence"
SERVICE_FILE="/etc/systemd/system/cadence-music.service"

# ── Colour helpers ─────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[cadence]${NC} $*"; }
warn()    { echo -e "${YELLOW}[cadence]${NC} $*"; }
die()     { echo -e "${RED}[cadence] ERROR:${NC} $*" >&2; exit 1; }

# ── Must run as root ───────────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || die "Please run as root: sudo bash install/setup-linux.sh"

# ── Locate project root ────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
[[ -f "$PROJECT_ROOT/package.json" ]] || die "Could not find project root (package.json missing)."

# ── 1. System dependencies ─────────────────────────────────────────────────────
info "Installing system dependencies..."
apt-get update -qq
apt-get install -y --no-install-recommends curl ffmpeg ca-certificates gnupg

if ! command -v node &>/dev/null || [[ $(node --version | cut -d. -f1 | tr -d 'v') -lt 20 ]]; then
  info "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  info "Node.js $(node --version) already installed."
fi

if ! command -v pnpm &>/dev/null; then
  info "Installing pnpm..."
  npm install -g pnpm@9
else
  info "pnpm $(pnpm --version) already installed."
fi

if ! command -v psql &>/dev/null; then
  info "Installing PostgreSQL..."
  apt-get install -y postgresql postgresql-contrib
fi
systemctl enable --now postgresql

# ── 2. System user ─────────────────────────────────────────────────────────────
if ! id "$SERVICE_USER" &>/dev/null; then
  info "Creating system user '$SERVICE_USER'..."
  useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
else
  info "User '$SERVICE_USER' already exists."
fi

# ── 3. Copy project files ──────────────────────────────────────────────────────
if [[ "$PROJECT_ROOT" != "$INSTALL_DIR" ]]; then
  info "Copying project files to $INSTALL_DIR..."
  mkdir -p "$INSTALL_DIR"
  rsync -a --delete \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='.cache' \
    --exclude='.local' \
    --exclude='*.log' \
    "$PROJECT_ROOT/" "$INSTALL_DIR/"
else
  info "Already running from $INSTALL_DIR — skipping copy."
fi
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

# ── 4. PostgreSQL database ─────────────────────────────────────────────────────
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null || echo "")
if [[ "$DB_EXISTS" != "1" ]]; then
  info "Setting up PostgreSQL database..."

  # Generate a random password if .env doesn't exist yet
  if [[ -f "$INSTALL_DIR/.env" ]]; then
    DB_PASS=$(grep "^DATABASE_URL" "$INSTALL_DIR/.env" | sed 's|.*://[^:]*:\([^@]*\)@.*|\1|')
    [[ -z "$DB_PASS" ]] && DB_PASS=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24)
  else
    DB_PASS=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24)
  fi

  sudo -u postgres psql << SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';
  END IF;
END
\$\$;
CREATE DATABASE $DB_NAME OWNER $DB_USER;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
SQL
  info "Database created."
else
  info "Database '$DB_NAME' already exists — skipping creation."
  # Read existing password from .env
  DB_PASS=$(grep "^DATABASE_URL" "$INSTALL_DIR/.env" 2>/dev/null | sed 's|.*://[^:]*:\([^@]*\)@.*|\1|' || echo "change-this-password")
fi

# ── 5. Write .env if it doesn't exist ─────────────────────────────────────────
if [[ ! -f "$INSTALL_DIR/.env" ]]; then
  info "Writing $INSTALL_DIR/.env..."
  cat > "$INSTALL_DIR/.env" << ENV
DATABASE_URL=postgres://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
PORT=4000
NODE_ENV=production
# Set MUSIC_DIR to the absolute path of your media library, e.g.:
# MUSIC_DIR=/mnt/media
MUSIC_DIR=/mnt/media
# Transcoding tuning — see install/config.example.env for guidance.
TRANSCODE_WORKERS=2
FFMPEG_THREADS=0
ENV
  chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/.env"
  chmod 640 "$INSTALL_DIR/.env"
  warn "Created $INSTALL_DIR/.env — edit MUSIC_DIR before starting the service."
else
  info ".env already exists — leaving it unchanged."
fi

# ── 6. Install dependencies and build ─────────────────────────────────────────
info "Installing Node.js dependencies..."
cd "$INSTALL_DIR"
sudo -u "$SERVICE_USER" pnpm install --frozen-lockfile

info "Building API server..."
sudo -u "$SERVICE_USER" pnpm --filter @workspace/api-server run build

info "Building web client..."
sudo -u "$SERVICE_USER" pnpm --filter @workspace/web-client run build

# ── 7. Database migrations ─────────────────────────────────────────────────────
info "Running database migrations..."
sudo -u "$SERVICE_USER" node "$INSTALL_DIR/artifacts/api-server/dist/migrate.mjs"

# ── 8. Systemd service ─────────────────────────────────────────────────────────
info "Installing systemd service..."
cat > "$SERVICE_FILE" << SERVICE
[Unit]
Description=Cadence Media Server
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=/usr/bin/node artifacts/api-server/dist/index.mjs
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable cadence-music
systemctl restart cadence-music

# ── Done ───────────────────────────────────────────────────────────────────────
echo ""
info "Installation complete."
echo ""
echo "  Service status : sudo systemctl status cadence-music"
echo "  Live logs      : sudo journalctl -u cadence-music -f"
echo ""
CONTAINER_IP=$(hostname -I | awk '{print $1}')
echo "  Open Cadence   : http://${CONTAINER_IP}:4000"
echo ""
if grep -q "^MUSIC_DIR=/mnt/media" "$INSTALL_DIR/.env"; then
  warn "MUSIC_DIR is still set to /mnt/media — edit $INSTALL_DIR/.env and restart:"
  warn "  sudo systemctl restart cadence-music"
fi
