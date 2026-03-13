/**
 * Status and health check routes
 *
 * Caches stats for 10s to avoid expensive counts on every request.
 */

var cache = null
var cacheTime = 0
var CACHE_TTL = 10000

export default function (fastify, { blocks, txs, utxos, rpc }) {
  fastify.get('/status', async (req, reply) => {
    var now = Date.now()
    if (cache && now - cacheTime < CACHE_TTL) return cache

    var [tip, txCount, utxoCount] = await Promise.all([
      blocks.findOne({}, { sort: { height: -1 }, projection: { height: 1 } }),
      txs.estimatedDocumentCount(),
      utxos.estimatedDocumentCount()
    ])

    var result = {
      indexed_height: tip?.height ?? -1,
      tx_count: txCount,
      utxo_count: utxoCount
    }

    try {
      var info = await rpc.getInfo()
      result.node_height = info.blocks
      result.synced = result.indexed_height >= info.blocks - 1
      result.connections = info.connections
    } catch (e) {
      result.node_height = null
      result.synced = false
    }

    cache = result
    cacheTime = now
    return result
  })
}
