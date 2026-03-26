#!/bin/bash
set -euo pipefail

REPO="fastclaw-ai/fastclaw"
BINARY="fastclaw"
INSTALL_DIR="/usr/local/bin"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# Detect OS and arch
detect_platform() {
  OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  ARCH=$(uname -m)

  case "$OS" in
    linux)  OS="linux" ;;
    darwin) OS="darwin" ;;
    *)      error "Unsupported OS: $OS" ;;
  esac

  case "$ARCH" in
    x86_64|amd64)  ARCH="amd64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *)             error "Unsupported architecture: $ARCH" ;;
  esac

  PLATFORM="${OS}_${ARCH}"
}

# Get latest release tag from GitHub
get_latest_version() {
  if command -v curl &>/dev/null; then
    VERSION=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | head -1 | sed -E 's/.*"([^"]+)".*/\1/')
  elif command -v wget &>/dev/null; then
    VERSION=$(wget -qO- "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | head -1 | sed -E 's/.*"([^"]+)".*/\1/')
  else
    error "Neither curl nor wget found. Please install one of them."
  fi

  if [ -z "$VERSION" ]; then
    error "Failed to fetch latest version. Check https://github.com/${REPO}/releases"
  fi
}

# Download and install
install() {
  local TARBALL="${BINARY}_${PLATFORM}.tar.gz"
  local URL="https://github.com/${REPO}/releases/download/${VERSION}/${TARBALL}"
  local TMP_DIR=$(mktemp -d)

  info "Downloading ${BINARY} ${VERSION} for ${PLATFORM}..."

  if command -v curl &>/dev/null; then
    curl -fsSL "$URL" -o "${TMP_DIR}/${TARBALL}" || error "Download failed. URL: $URL"
  else
    wget -q "$URL" -O "${TMP_DIR}/${TARBALL}" || error "Download failed. URL: $URL"
  fi

  info "Extracting..."
  tar -xzf "${TMP_DIR}/${TARBALL}" -C "${TMP_DIR}"

  info "Installing to ${INSTALL_DIR}/${BINARY}..."
  if [ -w "$INSTALL_DIR" ]; then
    mv "${TMP_DIR}/${BINARY}" "${INSTALL_DIR}/${BINARY}"
  else
    sudo mv "${TMP_DIR}/${BINARY}" "${INSTALL_DIR}/${BINARY}"
  fi
  chmod +x "${INSTALL_DIR}/${BINARY}"

  rm -rf "$TMP_DIR"
}

# Create default config if not exists
init_config() {
  local CONFIG_DIR="$HOME/.fastclaw"
  local CONFIG_FILE="${CONFIG_DIR}/fastclaw.json"

  if [ ! -f "$CONFIG_FILE" ]; then
    info "Creating default config at ${CONFIG_FILE}..."
    mkdir -p "$CONFIG_DIR"
    cat > "$CONFIG_FILE" << 'CFGEOF'
{
  "providers": {
    "openai": {
      "apiKey": "YOUR_API_KEY",
      "apiBase": "https://api.openai.com/v1"
    }
  },
  "agents": {
    "defaults": {
      "model": "gpt-4o",
      "maxTokens": 8192,
      "temperature": 0.7,
      "maxToolIterations": 20
    },
    "list": [
      { "id": "main", "workspace": "~/.fastclaw/agents/main/agent" }
    ]
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "accounts": {
        "default": {
          "botToken": "YOUR_TELEGRAM_BOT_TOKEN"
        }
      }
    }
  }
}
CFGEOF
    warn "Edit ${CONFIG_FILE} to add your API key and bot token."
  fi
}

main() {
  echo ""
  echo "  ⚡ FastClaw Installer"
  echo "  ====================="
  echo ""

  detect_platform
  info "Platform: ${PLATFORM}"

  get_latest_version
  info "Version: ${VERSION}"

  install

  echo ""
  info "✅ FastClaw installed successfully!"
  echo ""
  echo "  Next steps:"
  echo "    Run: fastclaw"
  echo "    This will open the setup wizard in your browser."
  echo ""
}

main "$@"
