#!/bin/bash
# Start landing analyzer — server + Cloudflare tunnel via tmux (stable)

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Kill existing sessions
tmux kill-session -t landing 2>/dev/null
tmux kill-session -t tunnel  2>/dev/null
sleep 1

echo "🚀 Starting server in tmux..."
tmux new-session -d -s landing "cd $DIR && node server.js"

sleep 2

echo "🌐 Starting Cloudflare tunnel in tmux..."
tmux new-session -d -s tunnel "/tmp/cloudflared tunnel --url http://localhost:3000 --no-autoupdate 2>&1 | tee /tmp/cf-tunnel.log"

sleep 6

URL=$(grep -o "https://[a-z0-9-]*\.trycloudflare\.com" /tmp/cf-tunnel.log | tail -1)

echo ""
echo "✅ Landing Analyzer is running!"
echo "   Local  : http://localhost:3000"
echo "   Public : $URL"
echo ""
echo "Manage sessions:"
echo "  tmux attach -t landing   (server logs)"
echo "  tmux attach -t tunnel    (tunnel logs)"
