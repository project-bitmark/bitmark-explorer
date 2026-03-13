/**
 * MongoDB collections and indexes for Bitmark blockchain data
 */

export async function initCollections (db) {
  var blocks = db.collection('blocks')
  var txs = db.collection('txs')
  var utxos = db.collection('utxos')
  var marks = db.collection('marks')
  var refs = db.collection('mark_references')

  // Indexes
  await blocks.createIndex({ height: 1 }, { unique: true })
  await blocks.createIndex({ hash: 1 }, { unique: true })

  await txs.createIndex({ txid: 1 }, { unique: true })
  await txs.createIndex({ height: 1 })

  await utxos.createIndex({ txid: 1, vout: 1 }, { unique: true })
  await utxos.createIndex({ address: 1 })
  await utxos.createIndex({ address: 1, spent_txid: 1 })
  await utxos.createIndex({ spent_txid: 1 })

  await marks.createIndex({ txid: 1 }, { unique: true })
  await marks.createIndex({ height: -1 })
  await marks.createIndex({ marker: 1 })
  await marks.createIndex({ recipient: 1 })
  await marks.createIndex({ reference_hash: 1 })

  await refs.createIndex({ hash: 1 }, { unique: true })

  return { blocks, txs, utxos, marks, refs }
}
