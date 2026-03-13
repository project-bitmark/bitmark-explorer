/**
 * Bitmark Block Indexer
 *
 * Scans the blockchain via RPC and builds address/UTXO/mark indexes in MongoDB.
 * Resilient — backs off when node is unavailable instead of crashing.
 */

import { MongoClient } from 'mongodb'
import { BitmarkRPC } from './rpc.js'
import { initCollections } from './db.js'

var BATCH_LOG_INTERVAL = 1000

export class Indexer {
  constructor (options = {}) {
    this.mongoUrl = options.mongoUrl || 'mongodb://localhost:27017'
    this.mongoDatabase = options.mongoDatabase || 'bitmark'
    this.rpc = new BitmarkRPC(options)
    this.client = null
    this.db = null
    this.col = null
    this.running = false
  }

  async connect () {
    this.client = new MongoClient(this.mongoUrl)
    await this.client.connect()
    this.db = this.client.db(this.mongoDatabase)
    this.col = await initCollections(this.db)
  }

  async close () {
    this.running = false
    if (this.client) await this.client.close()
  }

  async getLastIndexedHeight () {
    var block = await this.col.blocks.findOne({}, { sort: { height: -1 }, projection: { height: 1 } })
    return block?.height ?? -1
  }

  // Parse MRK OP_RETURN: 4d524b (MRK) + 01 (version) + XX (type) + 32-byte hash
  parseMark (hexData) {
    if (!hexData || hexData.length < 74) return null
    if (hexData.slice(0, 6) !== '4d524b') return null
    var version = parseInt(hexData.slice(6, 8), 16)
    if (version !== 1) return null
    var type = parseInt(hexData.slice(8, 10), 16)
    if (type < 1 || type > 9) return null
    return { version, type, referenceHash: hexData.slice(10, 74) }
  }

  extractAddress (output) {
    var spk = output.scriptPubKey
    if (!spk) return null
    if (spk.address) return spk.address
    if (spk.addresses && spk.addresses.length > 0) return spk.addresses[0]
    return null
  }

  async indexBlock (height) {
    var hash = await this.rpc.getBlockHash(height)
    var block = await this.rpc.getBlock(hash)
    var txids = block.tx

    // Fetch full transactions
    var txs = []
    for (var txid of txids) {
      try {
        txs.push(await this.rpc.getRawTransaction(txid))
      } catch (e) {
        if (height === 0) continue // genesis coinbase
        throw e
      }
    }

    // Bulk operations
    var blockOps = []
    var txOps = []
    var utxoOps = []
    var markOps = []

    blockOps.push({
      updateOne: {
        filter: { height },
        update: { $set: { height, hash, timestamp: block.time, tx_count: txids.length } },
        upsert: true
      }
    })

    for (var txIdx = 0; txIdx < txs.length; txIdx++) {
      var tx = txs[txIdx]
      var isCoinbase = txIdx === 0

      txOps.push({
        updateOne: {
          filter: { txid: tx.txid },
          update: { $set: { txid: tx.txid, height, idx: txIdx } },
          upsert: true
        }
      })

      // Mark inputs as spent
      if (!isCoinbase && tx.vin) {
        for (var vin of tx.vin) {
          if (vin.txid) {
            utxoOps.push({
              updateOne: {
                filter: { txid: vin.txid, vout: vin.vout },
                update: { $set: { spent_txid: tx.txid, spent_height: height } }
              }
            })
          }
        }
      }

      // Process outputs
      var markData = null
      var markRecipient = null

      if (tx.vout) {
        for (var vout = 0; vout < tx.vout.length; vout++) {
          var output = tx.vout[vout]
          var address = this.extractAddress(output)

          if (address) {
            var valueSats = Math.round(output.value * 1e8)
            utxoOps.push({
              updateOne: {
                filter: { txid: tx.txid, vout },
                update: { $set: { txid: tx.txid, vout, address, value: valueSats, height, coinbase: isCoinbase ? 1 : 0 } },
                upsert: true
              }
            })

            if (!markRecipient && valueSats > 0) {
              markRecipient = address
            }
          }

          // Check for OP_RETURN MRK
          var spk = output.scriptPubKey
          if (spk && spk.type === 'nulldata' && spk.hex) {
            var parsed = this.parseMark(spk.hex.slice(4))
            if (parsed) markData = parsed
          }
        }
      }

      // Store mark
      if (markData && !isCoinbase && tx.vin && tx.vin[0]) {
        var markerUtxo = await this.col.utxos.findOne({ txid: tx.vin[0].txid, vout: tx.vin[0].vout })
        if (markerUtxo) {
          // Calculate fee
          var totalIn = 0
          for (var v of tx.vin) {
            if (v.txid) {
              var u = await this.col.utxos.findOne({ txid: v.txid, vout: v.vout })
              if (u) totalIn += u.value
            }
          }
          var totalOut = tx.vout.reduce((s, o) => s + Math.round((o.value || 0) * 1e8), 0)
          var fee = totalIn - totalOut

          markOps.push({
            updateOne: {
              filter: { txid: tx.txid },
              update: { $set: {
                txid: tx.txid, height, timestamp: block.time,
                marker: markerUtxo.address, type: markData.type,
                reference_hash: markData.referenceHash,
                amount: fee > 0 ? fee : 0,
                recipient: markData.type === 2 ? markRecipient : null
              } },
              upsert: true
            }
          })
        }
      }
    }

    // Execute bulk writes
    if (blockOps.length) await this.col.blocks.bulkWrite(blockOps, { ordered: false })
    if (txOps.length) await this.col.txs.bulkWrite(txOps, { ordered: false })
    if (utxoOps.length) await this.col.utxos.bulkWrite(utxoOps, { ordered: false })
    if (markOps.length) await this.col.marks.bulkWrite(markOps, { ordered: false })

    return txids.length
  }

  async sync () {
    var startHeight = await this.getLastIndexedHeight() + 1
    var nodeHeight = await this.rpc.getBlockCount()

    if (startHeight > nodeHeight) {
      console.log('Already synced at height ' + nodeHeight)
      return
    }

    console.log('Syncing from ' + startHeight + ' to ' + nodeHeight + ' (' + (nodeHeight - startHeight + 1) + ' blocks)')
    var startTime = Date.now()
    var totalTxs = 0

    for (var height = startHeight; height <= nodeHeight; height++) {
      totalTxs += await this.indexBlock(height)

      if (height % BATCH_LOG_INTERVAL === 0 || height === nodeHeight) {
        var elapsed = (Date.now() - startTime) / 1000
        var bps = (height - startHeight + 1) / elapsed
        var remaining = (nodeHeight - height) / bps
        console.log('Block ' + height + '/' + nodeHeight + ' | ' + bps.toFixed(1) + ' blocks/s | ' + totalTxs + ' txs | ETA: ' + formatTime(remaining))
      }
    }

    console.log('Sync complete — ' + (nodeHeight - startHeight + 1) + ' blocks, ' + totalTxs + ' txs in ' + formatTime((Date.now() - startTime) / 1000))
  }

  async watch () {
    this.running = true
    console.log('Watch mode — polling every 10s')
    var backoff = 10000

    while (this.running) {
      try {
        var lastIndexed = await this.getLastIndexedHeight()
        var nodeHeight = await this.rpc.getBlockCount()

        if (nodeHeight > lastIndexed) {
          for (var h = lastIndexed + 1; h <= nodeHeight; h++) {
            await this.indexBlock(h)
            console.log('Indexed block ' + h)
          }
        }
        backoff = 10000 // reset on success
      } catch (e) {
        console.error('Watch error: ' + e.message)
        backoff = Math.min(backoff * 2, 300000) // max 5 min backoff
        console.log('Retrying in ' + (backoff / 1000) + 's')
      }

      await sleep(backoff)
    }
  }
}

function sleep (ms) { return new Promise(r => setTimeout(r, ms)) }

function formatTime (s) {
  if (s < 60) return Math.round(s) + 's'
  if (s < 3600) return Math.round(s / 60) + 'm'
  return (s / 3600).toFixed(1) + 'h'
}
