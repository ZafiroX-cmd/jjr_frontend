#!/bin/sh
set -e

API_URL="${VITE_API_URL:-}"
ESCAPED=$(printf '%s' "$API_URL" | sed 's/\\/\\\\/g; s/"/\\"/g')

cat > /usr/share/nginx/html/config.js <<EOF
window.__APP_CONFIG__ = { apiUrl: "${ESCAPED}" };
EOF
