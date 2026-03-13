/**
 * Address routes
 */

export default function (fastify, { utxos, txs }) {
  // Get UTXOs for address (unspent only)
  fastify.get('/address/:addr/utxos', async (req, reply) => {
    var result = await utxos.find(
      { address: req.params.addr, spent_txid: null },
      { sort: { height: -1 } }
    ).toArray()
    return result.map(u => ({ txid: u.txid, vout: u.vout, value: u.value, height: u.height, coinbase: u.coinbase }))
  })

  // Get all outputs (including spent)
  fastify.get('/address/:addr/outputs', async (req, reply) => {
    var result = await utxos.find(
      { address: req.params.addr },
      { sort: { height: -1 } }
    ).toArray()
    return result.map(u => ({
      txid: u.txid, vout: u.vout, address: u.address, value: u.value,
      height: u.height, coinbase: u.coinbase, spent_txid: u.spent_txid, spent_height: u.spent_height
    }))
  })

  // Get balance
  fastify.get('/address/:addr/balance', async (req, reply) => {
    var pipeline = [
      { $match: { address: req.params.addr, spent_txid: null } },
      { $group: { _id: null, confirmed: { $sum: '$value' } } }
    ]
    var [result] = await utxos.aggregate(pipeline).toArray()
    var confirmed = result?.confirmed || 0
    return { address: req.params.addr, confirmed, confirmed_btm: confirmed / 1e8 }
  })

  // Get transactions for address
  fastify.get('/address/:addr/txs', async (req, reply) => {
    var limit = Math.min(parseInt(req.query.limit) || 50, 100)
    var offset = parseInt(req.query.offset) || 0

    // Find all txids that touch this address (as output or spend)
    var outputTxids = await utxos.distinct('txid', { address: req.params.addr })
    var spendTxids = await utxos.distinct('spent_txid', { address: req.params.addr, spent_txid: { $ne: null } })
    var allTxids = [...new Set([...outputTxids, ...spendTxids])]

    var result = await txs.find(
      { txid: { $in: allTxids } },
      { sort: { height: -1 }, skip: offset, limit }
    ).toArray()

    return result.map(t => ({ txid: t.txid, height: t.height }))
  })

  // Validate address
  fastify.get('/validate/:addr', async (req, reply) => {
    // Basic format check — full validation needs the node
    var addr = req.params.addr
    var valid = /^[bB2][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(addr)
    return { isvalid: valid, address: addr }
  })
}
