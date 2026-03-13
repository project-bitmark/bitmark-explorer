/**
 * Transaction routes
 */

export default function (fastify, { txs, utxos, rpc }) {
  // Get transaction by txid
  fastify.get('/tx/:txid', async (req, reply) => {
    var txInfo = await txs.findOne({ txid: req.params.txid })
    if (!txInfo) return reply.code(404).send({ error: 'Transaction not found' })

    // Try RPC for full tx data, fall back to index
    var tx
    try {
      tx = await rpc.getRawTransaction(req.params.txid)
    } catch (e) {
      // Node unavailable — build from index
      var [inputs, outputs] = await Promise.all([
        utxos.find({ spent_txid: req.params.txid }).toArray(),
        utxos.find({ txid: req.params.txid }, { sort: { vout: 1 } }).toArray()
      ])
      tx = {
        txid: req.params.txid,
        vin: inputs.map(u => ({
          txid: u.txid, vout: u.vout,
          prevout: { address: u.address, value: u.value / 1e8 }
        })),
        vout: outputs.map(u => ({
          value: u.value / 1e8, n: u.vout,
          scriptPubKey: { addresses: [u.address] }
        }))
      }
      if (!inputs.length && txInfo.idx === 0) {
        tx.vin = [{ coinbase: true }]
      }
      return { ...tx, height: txInfo.height, block_index: txInfo.idx }
    }

    // Enrich vin with prevout address from index
    if (tx.vin) {
      for (var vin of tx.vin) {
        if (vin.txid && vin.vout !== undefined) {
          var utxo = await utxos.findOne({ txid: vin.txid, vout: vin.vout })
          if (utxo) {
            vin.prevout = { address: utxo.address, value: utxo.value / 1e8 }
          }
        }
      }
    }

    return { ...tx, height: txInfo.height, block_index: txInfo.idx }
  })

  // Get raw transaction hex
  fastify.get('/tx/:txid/hex', async (req, reply) => {
    try {
      var hex = await rpc.call('getrawtransaction', [req.params.txid, 0])
      return { txid: req.params.txid, hex }
    } catch (e) {
      return reply.code(502).send({ error: 'Node unavailable' })
    }
  })

  // Broadcast transaction
  fastify.post('/tx', async (req, reply) => {
    var hex = req.body?.hex
    if (!hex) return reply.code(400).send({ error: 'Missing hex field' })

    try {
      var txid = await rpc.sendRawTransaction(hex)
      return { txid }
    } catch (e) {
      return reply.code(400).send({ error: e.message })
    }
  })

  // Decode transaction
  fastify.post('/tx/decode', async (req, reply) => {
    var hex = req.body?.hex
    if (!hex) return reply.code(400).send({ error: 'Missing hex field' })

    try {
      return await rpc.decodeRawTransaction(hex)
    } catch (e) {
      return reply.code(400).send({ error: e.message })
    }
  })
}
