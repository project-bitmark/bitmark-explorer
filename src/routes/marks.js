/**
 * Mark routes — OP_RETURN endorsement system
 */

var MARK_TYPES = { 1: 'URL', 2: 'Address', 3: 'Content', 4: 'Nostr Profile', 5: 'Git Commit', 6: 'Document', 7: 'Timestamp', 8: 'Nostr Event', 9: 'URI' }

function addTypeName (mark) {
  return { ...mark, type_name: MARK_TYPES[mark.type], _id: undefined }
}

export default function (fastify, { marks, refs }) {
  // Recent marks
  fastify.get('/marks', async (req, reply) => {
    var limit = Math.min(parseInt(req.query.limit) || 50, 100)
    var offset = parseInt(req.query.offset) || 0

    var pipeline = [
      { $sort: { height: -1 } },
      { $skip: offset },
      { $limit: limit },
      { $lookup: { from: 'mark_references', localField: 'reference_hash', foreignField: 'hash', as: 'ref' } },
      { $addFields: { reference: { $arrayElemAt: ['$ref.reference', 0] } } },
      { $project: { ref: 0, _id: 0 } }
    ]
    var result = await marks.aggregate(pipeline).toArray()
    return result.map(addTypeName)
  })

  // Mark stats
  fastify.get('/marks/stats', async (req, reply) => {
    var pipeline = [
      { $group: {
        _id: null,
        total_marks: { $sum: 1 },
        unique_markers: { $addToSet: '$marker' },
        unique_recipients: { $addToSet: '$recipient' },
        total_amount: { $sum: '$amount' }
      } },
      { $project: {
        total_marks: 1,
        unique_markers: { $size: '$unique_markers' },
        unique_recipients: { $size: { $filter: { input: '$unique_recipients', cond: { $ne: ['$$this', null] } } } },
        total_amount: 1
      } }
    ]
    var [result] = await marks.aggregate(pipeline).toArray()
    return {
      total_marks: result?.total_marks || 0,
      unique_markers: result?.unique_markers || 0,
      unique_recipients: result?.unique_recipients || 0,
      total_amount: result?.total_amount || 0,
      total_amount_btm: (result?.total_amount || 0) / 1e8
    }
  })

  // Mark by txid
  fastify.get('/marks/tx/:txid', async (req, reply) => {
    var mark = await marks.findOne({ txid: req.params.txid })
    if (!mark) return reply.code(404).send({ error: 'Mark not found' })
    return addTypeName(mark)
  })

  // Marks by reference hash
  fastify.get('/marks/hash/:hash', async (req, reply) => {
    var result = await marks.find({ reference_hash: req.params.hash }, { sort: { height: -1 } }).toArray()
    return result.map(addTypeName)
  })

  // Marks made by address
  fastify.get('/marks/by/:addr', async (req, reply) => {
    var limit = Math.min(parseInt(req.query.limit) || 50, 100)
    var offset = parseInt(req.query.offset) || 0
    var result = await marks.find({ marker: req.params.addr }, { sort: { height: -1 }, skip: offset, limit }).toArray()
    return result.map(addTypeName)
  })

  // Marks received by address
  fastify.get('/marks/for/:addr', async (req, reply) => {
    var limit = Math.min(parseInt(req.query.limit) || 50, 100)
    var offset = parseInt(req.query.offset) || 0
    var result = await marks.find({ recipient: req.params.addr }, { sort: { height: -1 }, skip: offset, limit }).toArray()
    return result.map(addTypeName)
  })

  // Store a reference
  fastify.post('/reference', async (req, reply) => {
    var { hash, reference, type } = req.body || {}
    if (!hash || !reference || type === undefined) {
      return reply.code(400).send({ error: 'Missing hash, reference, or type' })
    }
    if (!/^[a-f0-9]{64}$/i.test(hash)) {
      return reply.code(400).send({ error: 'Invalid hash format' })
    }
    await refs.updateOne({ hash }, { $setOnInsert: { hash, reference, type, created_at: new Date() } }, { upsert: true })
    return { success: true, hash }
  })

  // Get reference by hash
  fastify.get('/reference/:hash', async (req, reply) => {
    var ref = await refs.findOne({ hash: req.params.hash })
    if (!ref) return reply.code(404).send({ error: 'Reference not found' })
    return { hash: ref.hash, reference: ref.reference, type: ref.type, type_name: MARK_TYPES[ref.type], created_at: ref.created_at }
  })
}
