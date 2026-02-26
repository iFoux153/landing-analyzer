#!/bin/bash
# Start landing analyzer server + tunnel with auto-restart

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Kill existing
pkill -f "node server.js" 2>/dev/null
pkill -f "lt --port 3000" 2>/dev/null
sleep 1

echo "🚀 Starting server..."
nohup node server.js > /tmp/landing-server.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

sleep 2

echo "🌐 Starting tunnel..."
while true; do
  node_modules/.bin/lt --port 3000 --subdomain landing-analyzer-cpo >> /tmp/landing-tunnel.log 2>&1
  echo "$(date) - Tunnel restarting..." >> /tmp/landing-tunnel.log
  sleep 3
done &
TUNNEL_PID=$!
echo "Tunnel PID: $TUNNEL_PID"

echo "✅ Done. Check logs:"
echo "  Server : tail -f /tmp/landing-server.log"
echo "  Tunnel : tail -f /tmp/landing-tunnel.log"
echo ""
echo "URL: https://landing-analyzer-cpo.loca.lt"
