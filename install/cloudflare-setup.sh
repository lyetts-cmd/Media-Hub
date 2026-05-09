#!/usr/bin/env bash
# =============================================================================
# Cadence Music — Cloudflare Tunnel Setup
# =============================================================================
# This script installs cloudflared on a Raspberry Pi (or any Debian-based
# Linux), authenticates with your Cloudflare account, creates a named tunnel,
# writes a config file pointing the tunnel at the local Cadence server, and
# installs cloudflared as a systemd service so the tunnel starts automatically.
#
# Prerequisites:
#   - A free Cloudflare account (https://dash.cloudflare.com/sign-up)
#   - A domain added to Cloudflare OR use the free trycloudflare.com subdomain
#     (see the "Quick test" note below)
#   - Cadence Music already running locally (default port: 4000)
#
# Usage:
#   chmod +x install/cloudflare-setup.sh
#   ./install/cloudflare-setup.sh
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration — edit these values before running if your setup differs
# ---------------------------------------------------------------------------
TUNNEL_NAME="cadence-music"
CONFIG_DIR="/etc/cloudflared"
CADENCE_INSTALL_DIR="/opt/cadence-music"

# Resolve the Cadence port:
#   1. Use PORT if already set in the environment (e.g. caller sourced .env).
#   2. Otherwise read it from the project .env file if present.
#   3. Fall back to 4000.
if [[ -z "${PORT:-}" ]]; then
  ENV_FILE="${CADENCE_INSTALL_DIR}/.env"
  if [[ -f "$ENV_FILE" ]]; then
    # Extract PORT=<value> from the .env file (ignore comments and blank lines)
    _port_from_file=$(grep -E '^PORT=' "$ENV_FILE" | head -n 1 | cut -d= -f2 | tr -d '[:space:]"'"'" || true)
    PORT="${_port_from_file:-4000}"
  else
    PORT="4000"
  fi
fi
CADENCE_PORT="$PORT"
# ---------------------------------------------------------------------------

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No colour

info()    { echo -e "${GREEN}[+]${NC} $*"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"; }
error()   { echo -e "${RED}[✗]${NC} $*" >&2; }

require_root() {
  if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root (use sudo)."
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# Step 1 — Install cloudflared from the official Cloudflare APT repository
# ---------------------------------------------------------------------------
install_cloudflared() {
  info "Adding Cloudflare APT repository..."

  mkdir -p /usr/share/keyrings

  # Download and import Cloudflare's GPG key
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
    | gpg --dearmor -o /usr/share/keyrings/cloudflare-main.gpg

  # Add the repository
  echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] \
https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" \
    > /etc/apt/sources.list.d/cloudflared.list

  info "Installing cloudflared..."
  apt-get update -qq
  apt-get install -y cloudflared

  info "cloudflared installed: $(cloudflared --version)"
}

# ---------------------------------------------------------------------------
# Step 2 — Authenticate with Cloudflare (opens a browser window)
# ---------------------------------------------------------------------------
authenticate() {
  info "Authenticating with Cloudflare..."
  warn "A browser window will open. Log in and select the domain you want to"
  warn "use for the tunnel. If you are on a headless Pi, copy the URL printed"
  warn "below and open it on another device."
  echo ""

  # Run as the invoking user, not root, so the credential file lands in the
  # right home directory. SUDO_USER is set when the script is called via sudo.
  local real_user="${SUDO_USER:-$USER}"
  sudo -u "$real_user" cloudflared tunnel login

  info "Authentication complete."
}

# ---------------------------------------------------------------------------
# Step 3 — Create a named tunnel
# ---------------------------------------------------------------------------
create_tunnel() {
  local real_user="${SUDO_USER:-$USER}"

  info "Creating tunnel '${TUNNEL_NAME}'..."
  # cloudflared writes the tunnel credentials JSON to ~/.cloudflared/
  sudo -u "$real_user" cloudflared tunnel create "${TUNNEL_NAME}"

  info "Tunnel created."
}

# ---------------------------------------------------------------------------
# Step 4 — Write /etc/cloudflared/config.yml
# ---------------------------------------------------------------------------
write_config() {
  local real_user="${SUDO_USER:-$USER}"
  local cred_dir
  cred_dir="$(eval echo "~${real_user}")/.cloudflared"

  # Resolve the tunnel ID for the named tunnel we just created.
  # cloudflared tunnel info prints the UUID on the first line after the header.
  local tunnel_id
  tunnel_id=$(sudo -u "$real_user" cloudflared tunnel info "${TUNNEL_NAME}" 2>/dev/null \
    | grep -Eo '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' \
    | head -n 1 || true)

  # Fall back to scanning the credentials directory if `tunnel info` fails
  if [[ -z "$tunnel_id" ]]; then
    local cred_file
    cred_file=$(find "$cred_dir" -name "*.json" ! -name "cert.pem" \
      -newer "${cred_dir}/cert.pem" 2>/dev/null | head -n 1 || \
      find "$cred_dir" -name "*.json" ! -name "cert.pem" | head -n 1)
    if [[ -z "$cred_file" ]]; then
      error "Could not resolve tunnel ID for '${TUNNEL_NAME}'."
      error "Make sure 'cloudflared tunnel create' completed successfully."
      exit 1
    fi
    tunnel_id=$(basename "$cred_file" .json)
  fi

  local cred_file="${cred_dir}/${tunnel_id}.json"

  info "Writing ${CONFIG_DIR}/config.yml (tunnel ID: ${tunnel_id})..."
  mkdir -p "$CONFIG_DIR"

  cat > "${CONFIG_DIR}/config.yml" <<EOF
# Cloudflare Tunnel configuration for Cadence Music
# Generated by install/cloudflare-setup.sh
#
# To use a custom domain instead of a trycloudflare.com URL, add a DNS record
# in your Cloudflare dashboard pointing to this tunnel:
#   cloudflared tunnel route dns ${TUNNEL_NAME} music.yourdomain.com
# Then replace the hostname below with your custom domain.

tunnel: ${tunnel_id}
credentials-file: ${cred_file}

ingress:
  # Route all traffic to the local Cadence Music server
  - service: http://localhost:${CADENCE_PORT}
EOF

  info "Config written to ${CONFIG_DIR}/config.yml"

  warn ""
  warn "OPTIONAL — custom domain: if you have a domain on Cloudflare and want"
  warn "a stable URL like https://music.yourdomain.com, run:"
  warn "  cloudflared tunnel route dns ${TUNNEL_NAME} music.yourdomain.com"
  warn "Then add this block above the final '- service:' line in config.yml:"
  warn "  - hostname: music.yourdomain.com"
  warn "    service: http://localhost:${CADENCE_PORT}"
  warn ""
  warn "For a quick test without a domain, use:"
  warn "  cloudflared tunnel --url http://localhost:${CADENCE_PORT}"
  warn "(This gives a temporary trycloudflare.com URL, no account needed.)"
}

# ---------------------------------------------------------------------------
# Step 5 — Install cloudflared as a systemd service
# ---------------------------------------------------------------------------
install_service() {
  info "Installing cloudflared as a systemd service..."

  # cloudflared has a built-in command to install itself as a service
  cloudflared service install

  systemctl daemon-reload
  systemctl enable cloudflared
  systemctl start  cloudflared

  info "cloudflared service enabled and started."
  info "Check status with: sudo systemctl status cloudflared"
  info "View logs with:    sudo journalctl -u cloudflared -f"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  require_root

  echo ""
  echo "======================================================"
  echo "  Cadence Music — Cloudflare Tunnel Setup"
  echo "======================================================"
  echo ""

  install_cloudflared
  echo ""

  authenticate
  echo ""

  create_tunnel
  echo ""

  write_config
  echo ""

  install_service
  echo ""

  info "Done! Cloudflare Tunnel is running."
  info ""
  info "Next steps:"
  info "  1. Find your tunnel URL in the Cloudflare Zero Trust dashboard"
  info "     (https://one.dash.cloudflare.com) under Networks → Tunnels."
  info "  2. Set up Cloudflare Access to restrict who can visit the URL:"
  info "     Zero Trust → Access → Applications → Add an application."
  info "     See INSTALL.md (Remote Sharing section) for detailed steps."
  info "  3. Share the URL and approved email addresses with your guests."
}

main "$@"
