#!/bin/sh
set -eu

: "${STOCKBOT_API_BASE_URL:?Set STOCKBOT_API_BASE_URL to the public HTTPS API origin}"
: "${STOCKBOT_WEBSOCKET_URL:?Set STOCKBOT_WEBSOCKET_URL to the public WSS endpoint}"

case "$STOCKBOT_API_BASE_URL" in
  https://*) ;;
  *) echo "STOCKBOT_API_BASE_URL must use HTTPS" >&2; exit 1 ;;
esac
case "$STOCKBOT_WEBSOCKET_URL" in
  wss://*) ;;
  *) echo "STOCKBOT_WEBSOCKET_URL must use WSS" >&2; exit 1 ;;
esac
case "$STOCKBOT_API_BASE_URL$STOCKBOT_WEBSOCKET_URL" in
  *\"*|*\'*|*\\*) echo "Runtime URLs contain unsupported characters" >&2; exit 1 ;;
esac

printf 'window.__STOCKBOT_CONFIG__ = {apiBaseUrl:"%s",websocketUrl:"%s"};\n' \
  "$STOCKBOT_API_BASE_URL" "$STOCKBOT_WEBSOCKET_URL" \
  > /usr/share/nginx/html/stockbot-config.js
