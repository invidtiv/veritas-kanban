#!/bin/sh
set -eu

BASE_URL="${VK_API_URL:-http://100.115.155.120:3001}"
AGENT_ID="${VK_AGENT_ID:-}"
API_KEY="${VK_API_KEY:-}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --url) BASE_URL="$2"; shift 2 ;;
    --agent-id) AGENT_ID="$2"; shift 2 ;;
    --key) API_KEY="$2"; shift 2 ;;
    *) printf 'Unknown option: %s\n' "$1" >&2; exit 2 ;;
  esac
done

case "$(uname -m)" in
  x86_64|amd64) ;;
  *) printf 'Unsupported architecture: %s (this installer currently supports Linux x86-64)\n' "$(uname -m)" >&2; exit 1 ;;
esac

command -v curl >/dev/null 2>&1 || { printf 'curl is required.\n' >&2; exit 1; }
command -v sha256sum >/dev/null 2>&1 || { printf 'sha256sum is required.\n' >&2; exit 1; }
if command -v tailscale >/dev/null 2>&1 && ! tailscale status >/dev/null 2>&1; then
  printf 'Tailscale is installed but not connected. Connect it before continuing.\n' >&2
  exit 1
fi

BASE_URL=${BASE_URL%/}
curl -fsS "$BASE_URL/health" >/dev/null

if [ -z "$API_KEY" ] && [ -n "$AGENT_ID" ] && [ -t 0 ]; then
  printf 'VK key for %s: ' "$AGENT_ID"
  trap 'stty echo' EXIT HUP INT TERM
  stty -echo
  IFS= read -r API_KEY
  stty echo
  trap - EXIT HUP INT TERM
  printf '\n'
fi

BIN_DIR="$HOME/.local/bin"
VK_PATH="$BIN_DIR/vk"
mkdir -p "$BIN_DIR"
curl -fsSLo "$VK_PATH.tmp" "$BASE_URL/remote-agent/bin/vk-linux-x64"
curl -fsSLo "$BIN_DIR/SHA256SUMS.tmp" "$BASE_URL/remote-agent/bin/SHA256SUMS"
EXPECTED_HASH=$(awk '$2 == "vk-linux-x64" { print $1 }' "$BIN_DIR/SHA256SUMS.tmp")
ACTUAL_HASH=$(sha256sum "$VK_PATH.tmp" | awk '{ print $1 }')
rm "$BIN_DIR/SHA256SUMS.tmp"
if [ -z "$EXPECTED_HASH" ] || [ "$EXPECTED_HASH" != "$ACTUAL_HASH" ]; then
  rm "$VK_PATH.tmp"
  printf 'VK binary checksum verification failed.\n' >&2
  exit 1
fi
chmod 700 "$VK_PATH.tmp"
mv "$VK_PATH.tmp" "$VK_PATH"

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *)
    if ! grep -F 'export PATH="$HOME/.local/bin:$PATH"' "$HOME/.profile" >/dev/null 2>&1; then
      printf '\n# Veritas Kanban CLI\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "$HOME/.profile"
    fi
    PATH="$BIN_DIR:$PATH"
    export PATH
    ;;
esac

for ROOT in "$HOME/.codex/skills/veritas-kanban" "$HOME/.agents/skills/veritas-kanban"; do
  mkdir -p "$ROOT/agents" "$ROOT/references"
  curl -fsSLo "$ROOT/SKILL.md" "$BASE_URL/remote-agent/skill/veritas-kanban/SKILL.md"
  curl -fsSLo "$ROOT/agents/openai.yaml" "$BASE_URL/remote-agent/skill/veritas-kanban/agents/openai.yaml"
  curl -fsSLo "$ROOT/references/cli.md" "$BASE_URL/remote-agent/skill/veritas-kanban/references/cli.md"
done

"$VK_PATH" --version >/dev/null

if [ -n "$API_KEY" ]; then
  [ -n "$AGENT_ID" ] || { printf 'Provide --agent-id when configuring a key.\n' >&2; exit 2; }
  "$VK_PATH" connect "$BASE_URL" --key "$API_KEY" --name "$AGENT_ID"
  CONFIG_PATH="$HOME/.config/veritas-kanban/config.json"
  [ ! -f "$CONFIG_PATH" ] || chmod 600 "$CONFIG_PATH"
  # Override any controller-station VK environment inherited by the installer.
  # The new station credential and URL must be the values under test.
  VERITAS_ADMIN_KEY= VK_API_URL="$BASE_URL" VK_API_KEY="$API_KEY" \
    "$VK_PATH" summary >/dev/null
  printf 'VK installed and connected as %s. Run: vk status\n' "$AGENT_ID"
else
  printf 'VK and its agent skill are installed. Request a scoped key, then follow %s/llms.txt\n' "$BASE_URL"
fi

unset API_KEY VK_API_KEY 2>/dev/null || true
