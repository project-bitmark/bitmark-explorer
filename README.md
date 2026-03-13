# Bitmark Explorer

Blockchain explorer, wallet, and indexer for [Bitmark](https://bitmark.co) — powered by [JSS](https://www.npmjs.com/package/javascript-solid-server).

## Prerequisites

- Node.js >= 18
- MongoDB
- bitmarkd (running with RPC enabled)

## Install

```bash
npm install
```

## Run

```bash
# Start explorer + indexer (polls bitmarkd for new blocks)
PORT=4449 node bin/bitmark-explorer.js --watch

# Explorer only (no indexing)
node bin/bitmark-explorer.js

# Indexer only (no web server)
node bin/bitmark-explorer.js --index-only --watch
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `MONGO_URL` | `mongodb://localhost:27017` | MongoDB connection string |
| `MONGO_DB` | `bitmark` | Database name |
| `ROOT` | `./web` | Static file root |
| `RPC_USER` | from `~/.bitmark/bitmark.conf` | bitmarkd RPC username |
| `RPC_PASS` | from `~/.bitmark/bitmark.conf` | bitmarkd RPC password |

## Features

- Block and transaction explorer with RPC fallback to indexed data
- Address balance and UTXO lookup
- Client-side wallet with Nostr key auto-login
- On-chain marking (OP_RETURN) for URLs, addresses, documents, and more
- Mark indexer with reference resolution
- Linked Data (JSON-LD) powered UI via JSS panes

## License

MIT
