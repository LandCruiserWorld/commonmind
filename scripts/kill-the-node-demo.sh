#!/usr/bin/env bash
# Kill-the-node demo — camera-ready, no improvisation needed.
#
# Two terminal windows, side by side:
#   WINDOW A (this script) — runs the real CommonMind CLI against the cluster
#   WINDOW B — the cockroach demo interactive prompt, where you kill the node
#
# Setup, before you hit record:
#   1. Open a second terminal window/tab. In it, run:
#        cockroach demo --nodes=3 --no-example-database --insecure --http-port=8090
#      Leave it sitting at the "root@..." SQL prompt. That window IS the cluster.
#   2. In THIS window, cd to the repo root and run: npm run build
#
# Then hit record, and in THIS window run: ./scripts/kill-the-node-demo.sh
# When the script tells you to, switch to window B and type: \demo shutdown 2

set -e
pause() { sleep "${1:-2}"; }
say() { echo ""; echo "=== $1 ==="; echo ""; }
wait_for_enter() { echo ""; read -r -p ">>> $1 — press enter when done <<< " _; }

say "Applying CommonMind's real schema to the cluster"
cockroach sql --insecure --host=localhost:26257 -e "CREATE DATABASE IF NOT EXISTS commonmind;"
cockroach sql --insecure --host=localhost:26257 --database=commonmind < src/db/schema.sql
pause 2

export COCKROACH_DB_URL="postgresql://root@localhost:26257/commonmind?sslmode=disable"
export EMBED_PROVIDER=local

say "Capturing a real memory through the real CLI"
node dist/cli.js capture "Chose Raft over Paxos for CommonMind's memory core — simpler membership changes"
pause 2

say "Recalling it — proves the write is real, not staged"
node dist/cli.js ask "why did we pick Raft"
pause 3

wait_for_enter "Switch to window B now and type: \\demo shutdown 2"

say "Node 2 is down. Capturing again — right now, mid-outage"
node dist/cli.js capture "Kill-the-node rehearsal — this write landed while a node was down"
pause 2

say "Recalling — the cluster never stopped answering"
node dist/cli.js ask "kill the node"
pause 3

wait_for_enter "Switch to window B and type: \\demo restart 2 (clean finish, optional for the cut)"

say "Done. Real cluster, real schema, real CLI, real node loss — nothing here was staged."
