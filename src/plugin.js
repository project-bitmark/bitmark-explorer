/**
 * Bitmark Explorer — Fastify plugin
 *
 * Registers blockchain routes and optionally runs the indexer.
 * Can be used standalone or registered with JSS.
 */

import { MongoClient } from 'mongodb'
import { BitmarkRPC } from './rpc.js'
import { initCollections } from './db.js'
import statusRoutes from './routes/status.js'
import blockRoutes from './routes/blocks.js'
import txRoutes from './routes/txs.js'
import addressRoutes from './routes/addresses.js'
import markRoutes from './routes/marks.js'

export async function bitmarkPlugin (fastify, options = {}) {
  var mongoUrl = options.mongoUrl || 'mongodb://localhost:27017'
  var mongoDatabase = options.mongoDatabase || 'bitmark'

  // Connect to MongoDB
  var client = new MongoClient(mongoUrl)
  await client.connect()
  var db = client.db(mongoDatabase)
  var collections = await initCollections(db)

  // RPC client
  var rpc = new BitmarkRPC({
    host: options.rpcHost,
    port: options.rpcPort,
    user: options.rpcUser,
    password: options.rpcPass
  })

  // Shared context for routes
  var ctx = { ...collections, rpc, db }

  // Register routes
  statusRoutes(fastify, ctx)
  blockRoutes(fastify, ctx)
  txRoutes(fastify, ctx)
  addressRoutes(fastify, ctx)
  markRoutes(fastify, ctx)

  // Decorate for external access
  fastify.decorate('bitmark', ctx)

  // Cleanup
  fastify.addHook('onClose', async () => {
    await client.close()
  })

  fastify.log.info('Bitmark explorer plugin registered — database: ' + mongoDatabase)
}

export default bitmarkPlugin
