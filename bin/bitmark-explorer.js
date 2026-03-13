#!/usr/bin/env node

/**
 * Bitmark Explorer CLI
 *
 * Uses JSS (JavaScript Solid Server) as the web server foundation.
 * Registers blockchain routes as a Fastify plugin on top.
 */

import { createServer } from 'javascript-solid-server/src/server.js'
import { bitmarkPlugin } from '../src/plugin.js'
import { Indexer } from '../src/indexer.js'

import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

var __dirname = dirname(fileURLToPath(import.meta.url))
var args = process.argv.slice(2)
var PORT = parseInt(process.env.PORT || '3000')
var HOST = process.env.HOST || '0.0.0.0'
var MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017'
var MONGO_DB = process.env.MONGO_DB || 'bitmark'
var ROOT = process.env.ROOT || join(__dirname, '..', 'web')
var indexOnly = args.includes('--index-only')
var watch = args.includes('--watch') || args.includes('-w')

if (indexOnly) {
  // Indexer-only mode — no web server
  var indexer = new Indexer({ mongoUrl: MONGO_URL, mongoDatabase: MONGO_DB })
  await indexer.connect()

  if (watch) {
    await indexer.sync()
    await indexer.watch()
  } else {
    await indexer.sync()
    await indexer.close()
  }
} else {
  // Web server with JSS foundation
  var server = createServer({
    logger: true,
    public: true,
    root: ROOT,
    mongo: false // we manage our own MongoDB connection for blockchain data
  })

  // Register bitmark routes
  server.register(bitmarkPlugin, {
    mongoUrl: MONGO_URL,
    mongoDatabase: MONGO_DB
  })

  // Start optional background indexer
  if (watch) {
    server.addHook('onReady', async () => {
      var indexer = new Indexer({ mongoUrl: MONGO_URL, mongoDatabase: MONGO_DB })
      await indexer.connect()
      indexer.sync().then(() => indexer.watch())
    })
  }

  await server.listen({ port: PORT, host: HOST })
  console.log('Bitmark Explorer running at http://' + HOST + ':' + PORT)
}
