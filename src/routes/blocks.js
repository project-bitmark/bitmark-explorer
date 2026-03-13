/**
 * Block routes
 */

export default function (fastify, { blocks, txs, rpc }) {
  // Get block by height
  fastify.get('/block/:height', async (req, reply) => {
    var height = parseInt(req.params.height)
    var block = await blocks.findOne({ height })
    if (!block) return reply.code(404).send({ error: 'Block not found' })

    if (req.query.full === 'true') {
      try {
        return await rpc.getBlock(block.hash)
      } catch (e) {
        // Node unavailable — return what we have from the index
        var blockTxs = await txs.find({ height }, { sort: { idx: 1 }, projection: { txid: 1, _id: 0 } }).toArray()
        return {
          hash: block.hash, height: block.height, time: block.timestamp,
          tx_count: block.tx_count,
          tx: blockTxs.map(t => t.txid)
        }
      }
    }

    return { height: block.height, hash: block.hash, timestamp: block.timestamp, tx_count: block.tx_count }
  })

  // Get block by hash
  fastify.get('/block/hash/:hash', async (req, reply) => {
    var block = await blocks.findOne({ hash: req.params.hash })
    if (!block) return reply.code(404).send({ error: 'Block not found' })
    return { height: block.height, hash: block.hash, timestamp: block.timestamp, tx_count: block.tx_count }
  })

  // Get latest block
  fastify.get('/blocks/tip', async (req, reply) => {
    var block = await blocks.findOne({}, { sort: { height: -1 } })
    return block
      ? { height: block.height, hash: block.hash, timestamp: block.timestamp, tx_count: block.tx_count }
      : { error: 'No blocks indexed' }
  })

  // Get recent blocks
  fastify.get('/blocks', async (req, reply) => {
    var limit = Math.min(parseInt(req.query.limit) || 20, 100)
    var offset = parseInt(req.query.offset) || 0
    var result = await blocks.find({}, { sort: { height: -1 }, skip: offset, limit }).toArray()
    return result.map(b => ({ height: b.height, hash: b.hash, timestamp: b.timestamp, tx_count: b.tx_count }))
  })
}
