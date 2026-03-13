var API = (function () { var m = location.pathname.match(/^(\/[^/]+)\//); return m ? m[1] : '' })()

var secp256k1, sha256, ripemd160
var cryptoLoaded = false

async function loadCrypto () {
  if (cryptoLoaded) return true
  try {
    var mod1 = await import('https://esm.sh/@noble/curves@1.2.0/secp256k1')
    var mod2 = await import('https://esm.sh/@noble/hashes@1.3.2/sha256')
    var mod3 = await import('https://esm.sh/@noble/hashes@1.3.2/ripemd160')
    secp256k1 = mod1.secp256k1
    sha256 = mod2.sha256
    ripemd160 = mod3.ripemd160
    cryptoLoaded = true
    return true
  } catch (e) { return false }
}

// --- Byte helpers (from old explorer) ---

function hexToBytes (hex) {
  var bytes = new Uint8Array(hex.length / 2)
  for (var i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
  return bytes
}

function bytesToHex (bytes) {
  return Array.from(bytes).map(function (b) { return b.toString(16).padStart(2, '0') }).join('')
}

function concatBytes () {
  var arrays = Array.prototype.slice.call(arguments)
  var totalLength = arrays.reduce(function (sum, arr) { return sum + arr.length }, 0)
  var result = new Uint8Array(totalLength)
  var offset = 0
  for (var i = 0; i < arrays.length; i++) {
    result.set(arrays[i], offset)
    offset += arrays[i].length
  }
  return result
}

function reverseBytes (bytes) {
  var copy = new Uint8Array(bytes.length)
  copy.set(bytes)
  return copy.reverse()
}

function encodeVarInt (n) {
  if (n < 0xfd) return new Uint8Array([n])
  if (n <= 0xffff) return new Uint8Array([0xfd, n & 0xff, (n >> 8) & 0xff])
  if (n <= 0xffffffff) return new Uint8Array([0xfe, n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff])
  throw new Error('Number too large for varint')
}

function writeUInt32LE (n) {
  var buf = new Uint8Array(4)
  buf[0] = n & 0xff
  buf[1] = (n >> 8) & 0xff
  buf[2] = (n >> 16) & 0xff
  buf[3] = (n >> 24) & 0xff
  return buf
}

function writeUInt64LE (n) {
  var buf = new Uint8Array(8)
  buf[0] = n & 0xff
  buf[1] = (n >> 8) & 0xff
  buf[2] = (n >> 16) & 0xff
  buf[3] = (n >> 24) & 0xff
  var high = Math.floor(n / 0x100000000)
  buf[4] = high & 0xff
  buf[5] = (high >> 8) & 0xff
  buf[6] = (high >> 16) & 0xff
  buf[7] = (high >> 24) & 0xff
  return buf
}

// --- Base58 decode (needed for address -> pubKeyHash) ---

var BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function base58Decode (str) {
  var bytes = [0]
  for (var c = 0; c < str.length; c++) {
    var value = BASE58_ALPHABET.indexOf(str[c])
    if (value < 0) throw new Error('Invalid Base58 character')
    var carry = value
    for (var i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58
      bytes[i] = carry & 0xff
      carry >>= 8
    }
    while (carry > 0) {
      bytes.push(carry & 0xff)
      carry >>= 8
    }
  }
  for (var j = 0; j < str.length; j++) {
    if (str[j] === BASE58_ALPHABET[0]) bytes.push(0)
    else break
  }
  return new Uint8Array(bytes.reverse())
}

function base58CheckDecode (str) {
  var data = base58Decode(str)
  var payload = data.slice(0, -4)
  var checksum = data.slice(-4)
  var expectedChecksum = sha256(sha256(payload)).slice(0, 4)
  for (var i = 0; i < 4; i++) {
    if (checksum[i] !== expectedChecksum[i]) throw new Error('Invalid checksum')
  }
  return { version: payload[0], payload: payload.slice(1) }
}

// --- Script builders (from old explorer) ---

function createP2PKHScriptPubKey (address) {
  var decoded = base58CheckDecode(address)
  var pubKeyHash = decoded.payload
  var script = new Uint8Array(25)
  script[0] = 0x76  // OP_DUP
  script[1] = 0xa9  // OP_HASH160
  script[2] = 0x14  // Push 20 bytes
  script.set(pubKeyHash, 3)
  script[23] = 0x88 // OP_EQUALVERIFY
  script[24] = 0xac // OP_CHECKSIG
  return script
}

function createOpReturnScriptPubKey (data) {
  var dataBytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  if (dataBytes.length > 80) throw new Error('OP_RETURN data exceeds 80 bytes')
  if (dataBytes.length <= 75) {
    var script = new Uint8Array(2 + dataBytes.length)
    script[0] = 0x6a // OP_RETURN
    script[1] = dataBytes.length
    script.set(dataBytes, 2)
    return script
  } else {
    var script2 = new Uint8Array(3 + dataBytes.length)
    script2[0] = 0x6a // OP_RETURN
    script2[1] = 0x4c // OP_PUSHDATA1
    script2[2] = dataBytes.length
    script2.set(dataBytes, 3)
    return script2
  }
}

function createP2PKHScriptSig (signature, publicKey) {
  var sigLen = signature.length
  var pubLen = publicKey.length
  var script = new Uint8Array(1 + sigLen + 1 + pubLen)
  script[0] = sigLen
  script.set(signature, 1)
  script[1 + sigLen] = pubLen
  script.set(publicKey, 2 + sigLen)
  return script
}

// --- Transaction serialization (from old explorer) ---

function serializeTransaction (tx, forSigning, inputIndex, prevScriptPubKey) {
  var parts = []
  parts.push(writeUInt32LE(tx.version || 1))
  parts.push(encodeVarInt(tx.inputs.length))
  for (var i = 0; i < tx.inputs.length; i++) {
    var input = tx.inputs[i]
    parts.push(reverseBytes(hexToBytes(input.txid)))
    parts.push(writeUInt32LE(input.vout))
    if (forSigning) {
      if (i === inputIndex && prevScriptPubKey) {
        parts.push(encodeVarInt(prevScriptPubKey.length))
        parts.push(prevScriptPubKey)
      } else {
        parts.push(new Uint8Array([0x00]))
      }
    } else {
      var scriptSig = input.scriptSig || new Uint8Array(0)
      parts.push(encodeVarInt(scriptSig.length))
      parts.push(scriptSig)
    }
    parts.push(writeUInt32LE(input.sequence !== undefined ? input.sequence : 0xffffffff))
  }
  parts.push(encodeVarInt(tx.outputs.length))
  for (var j = 0; j < tx.outputs.length; j++) {
    var output = tx.outputs[j]
    parts.push(writeUInt64LE(output.value))
    var spk = output.scriptPubKey || createP2PKHScriptPubKey(output.address)
    parts.push(encodeVarInt(spk.length))
    parts.push(spk)
  }
  parts.push(writeUInt32LE(tx.locktime || 0))
  if (forSigning) parts.push(writeUInt32LE(0x01)) // SIGHASH_ALL
  return concatBytes.apply(null, parts)
}

function hash256 (data) { return sha256(sha256(data)) }

function signInput (tx, inputIndex, privateKey, publicKey) {
  var input = tx.inputs[inputIndex]
  var prevScriptPubKey = createP2PKHScriptPubKey(input.address)
  var serialized = serializeTransaction(tx, true, inputIndex, prevScriptPubKey)
  var sigHash = hash256(serialized)
  var privKeyBytes = hexToBytes(privateKey)
  var signature = secp256k1.sign(sigHash, privKeyBytes, { lowS: true })
  var derSig = signature.toDERRawBytes()
  var sigWithHashType = new Uint8Array(derSig.length + 1)
  sigWithHashType.set(derSig)
  sigWithHashType[derSig.length] = 0x01 // SIGHASH_ALL
  var pubKeyBytes = hexToBytes(publicKey)
  return createP2PKHScriptSig(sigWithHashType, pubKeyBytes)
}

async function buildSignedTransaction (utxos, outputs, privateKey, publicKey, fromAddress) {
  var tx = {
    version: 1,
    inputs: utxos.map(function (utxo) {
      return {
        txid: utxo.txid, vout: utxo.vout, value: utxo.value,
        address: fromAddress, sequence: 0xffffffff, scriptSig: null
      }
    }),
    outputs: outputs.map(function (out) {
      if (out.opReturn) {
        return { value: 0, scriptPubKey: createOpReturnScriptPubKey(out.opReturn) }
      }
      return { value: out.value, address: out.address, scriptPubKey: createP2PKHScriptPubKey(out.address) }
    }),
    locktime: 0
  }
  for (var i = 0; i < tx.inputs.length; i++) {
    tx.inputs[i].scriptSig = signInput(tx, i, privateKey, publicKey)
  }
  var rawTx = serializeTransaction(tx, false)
  var txid = bytesToHex(reverseBytes(hash256(rawTx)))
  return { hex: bytesToHex(rawTx), txid: txid }
}

// --- Mark OP_RETURN builder (from old explorer) ---

var TYPE_CODES = {
  url: 0x01, address: 0x02, nostr: 0x04, git: 0x05,
  document: 0x06, timestamp: 0x07, event: 0x08, uri: 0x09
}

var RAW_HEX_TYPES = ['document', 'timestamp', 'nostr', 'event']

function generateMarkOpReturn (typeId, reference) {
  var referenceHash
  if (RAW_HEX_TYPES.indexOf(typeId) >= 0 && /^[0-9a-fA-F]{64}$/.test(reference)) {
    referenceHash = hexToBytes(reference)
  } else {
    referenceHash = sha256(new TextEncoder().encode(reference))
  }
  var markData = new Uint8Array(37)
  markData[0] = 0x4d // 'M'
  markData[1] = 0x52 // 'R'
  markData[2] = 0x4b // 'K'
  markData[3] = 0x01 // Version 1
  markData[4] = TYPE_CODES[typeId] || 0x01
  markData.set(referenceHash.slice(0, 32), 5)
  return markData
}

// --- Mark types and weights ---

var MARK_TYPES = [
  { id: 'url',       label: 'URL',           icon: '\uD83C\uDF10', placeholder: 'https://example.com/article' },
  { id: 'address',   label: 'Address',       icon: '\uD83D\uDCCD', placeholder: 'Creator address (b...)' },
  { id: 'nostr',     label: 'Nostr Profile',  icon: '\uD83D\uDD11', placeholder: '64-char hex pubkey' },
  { id: 'git',       label: 'Git Commit',     icon: '\uD83D\uDCBB', placeholder: 'repo/commit reference' },
  { id: 'document',  label: 'Document',       icon: '\uD83D\uDCC4', placeholder: 'SHA256 hash of document' },
  { id: 'timestamp', label: 'Timestamp',      icon: '\u23F0',       placeholder: 'Proof of existence' },
  { id: 'event',     label: 'Nostr Event',    icon: '\u26A1',       placeholder: '64-char hex event ID' },
  { id: 'uri',       label: 'URI',            icon: '\uD83D\uDD17', placeholder: 'Linked data entity URI' }
]

var WEIGHTS = [
  { label: 'Legendary', amount: 1.00, color: 'rgba(251,191,36,0.3)' },
  { label: 'Love it',   amount: 0.10, color: 'rgba(168,85,247,0.3)' },
  { label: 'Nice',      amount: 0.05, color: 'rgba(99,102,241,0.3)' },
  { label: 'Noted',     amount: 0.01, color: 'rgba(148,163,184,0.3)' }
]

export default {
  label: 'Mark',
  icon: '\u2696',

  canHandle (subject, store) {
    var node = store.get(subject.value)
    var type = store.type(node)
    return type && type.includes('WebApplication')
  },

  render (subject, store, container) {
    var selectedType = 0
    var selectedWeight = 0

    var style = document.createElement('style')
    style.textContent = [
      '.mk-wrap { padding:24px 32px; max-width:700px; }',
      '.mk-header h2 { font-size:1.8rem; font-weight:700; color:rgba(255,255,255,0.95); margin-bottom:4px; }',
      '.mk-header p { font-size:0.9em; color:rgba(255,255,255,0.35); margin-bottom:24px; }',
      '.mk-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:20px; margin-bottom:20px; }',
      '.mk-label { font-size:0.75em; font-weight:600; color:rgba(255,255,255,0.3); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; }',
      '.mk-types { display:grid; grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); gap:8px; margin-bottom:20px; }',
      '.mk-type { padding:12px; background:rgba(255,255,255,0.02); border:2px solid rgba(255,255,255,0.06); border-radius:10px; cursor:pointer; text-align:center; transition:all 0.15s; }',
      '.mk-type:hover { border-color:rgba(99,102,241,0.2); background:rgba(255,255,255,0.04); }',
      '.mk-type.active { border-color:#6366f1; background:rgba(99,102,241,0.1); }',
      '.mk-type-icon { font-size:1.4em; margin-bottom:4px; }',
      '.mk-type-label { font-size:0.8em; color:rgba(255,255,255,0.6); }',
      '.mk-input { width:100%; padding:10px 14px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:8px; color:rgba(255,255,255,0.9); font:0.9em -apple-system,sans-serif; outline:none; margin-bottom:16px; }',
      '.mk-input:focus { border-color:rgba(99,102,241,0.4); }',
      '.mk-input::placeholder { color:rgba(255,255,255,0.2); }',
      '.mk-weights { display:flex; gap:8px; margin-bottom:20px; }',
      '.mk-weight { flex:1; padding:10px; border-radius:8px; border:2px solid rgba(255,255,255,0.06); cursor:pointer; text-align:center; transition:all 0.15s; }',
      '.mk-weight:hover { border-color:rgba(99,102,241,0.2); }',
      '.mk-weight.active { border-color:#6366f1; }',
      '.mk-weight-label { font-size:0.8em; font-weight:600; color:rgba(255,255,255,0.7); margin-bottom:2px; }',
      '.mk-weight-amount { font-size:0.75em; color:rgba(255,255,255,0.35); }',
      '.mk-preview { font-family:"SF Mono",SFMono-Regular,Consolas,monospace; font-size:0.8em; color:rgba(255,255,255,0.5); background:rgba(0,0,0,0.2); padding:12px; border-radius:6px; margin-bottom:16px; word-break:break-all; }',
      '.mk-btn { padding:12px 28px; background:#6366f1; border:none; border-radius:8px; color:#fff; font:600 0.9em -apple-system,sans-serif; cursor:pointer; width:100%; }',
      '.mk-btn:hover { background:#4f46e5; }',
      '.mk-btn:disabled { opacity:0.5; cursor:not-allowed; }',
      '.mk-section-title { font-size:1em; font-weight:600; color:rgba(255,255,255,0.7); margin-bottom:12px; margin-top:8px; }',
      '.mk-recent { }',
      '.mk-mark { display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.04); }',
      '.mk-mark:last-child { border-bottom:none; }',
      '.mk-mark-icon { font-size:1.2em; }',
      '.mk-mark-info { flex:1; min-width:0; }',
      '.mk-mark-ref { font-size:0.85em; color:rgba(255,255,255,0.7); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
      '.mk-mark-meta { font-size:0.75em; color:rgba(255,255,255,0.3); margin-top:2px; }',
      '.mk-mark-amount { font-size:0.85em; font-weight:600; color:#818cf8; white-space:nowrap; }',
      '.mk-status { font-size:0.85em; margin-top:8px; padding:8px 12px; border-radius:6px; }',
      '.mk-status.error { color:#f87171; background:rgba(239,68,68,0.1); }',
      '.mk-status.success { color:#22c55e; background:rgba(34,197,94,0.1); }',
      '.mk-status.info { color:#fbbf24; background:rgba(251,191,36,0.1); }'
    ].join('\n')
    container.appendChild(style)

    var wrap = document.createElement('div')
    wrap.className = 'mk-wrap'
    container.appendChild(wrap)

    function toast (msg, type) {
      var t = document.createElement('div')
      t.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:12px 20px;border-radius:8px;font-size:0.85em;font-weight:600;z-index:999;animation:wl-fade 3s forwards;'
      t.style.background = type === 'error' ? '#ef4444' : type === 'success' ? '#22c55e' : '#6366f1'
      t.style.color = '#fff'
      t.textContent = msg
      document.body.appendChild(t)
      setTimeout(function () { t.remove() }, 3000)
    }

    function getWallet () {
      try {
        var stored = localStorage.getItem('bitmark_wallet')
        if (!stored) return null
        return JSON.parse(stored)
      } catch (e) { return null }
    }

    async function submitMark (typeId, reference, amountBtm, statusEl) {
      var wallet = getWallet()
      if (!wallet || !wallet.address) {
        statusEl.className = 'mk-status error'
        statusEl.textContent = 'Connect a wallet first (go to Wallet tab)'
        return
      }
      if (!wallet.encryptedKey || !wallet.publicKey) {
        statusEl.className = 'mk-status error'
        statusEl.textContent = 'Wallet has no signing key. Restore with a private key.'
        return
      }

      var ok = await loadCrypto()
      if (!ok) {
        statusEl.className = 'mk-status error'
        statusEl.textContent = 'Failed to load crypto libraries'
        return
      }

      statusEl.className = 'mk-status info'
      statusEl.textContent = 'Fetching UTXOs...'

      try {
        var utxos = await fetch(API + '/address/' + wallet.address + '/utxos').then(function (r) { return r.json() })
        if (!Array.isArray(utxos) || !utxos.length) {
          statusEl.className = 'mk-status error'
          statusEl.textContent = 'No confirmed funds available'
          return
        }

        var amountSats = Math.floor(amountBtm * 1e8)
        var feeSats = 10000
        var totalNeeded = amountSats + feeSats

        // Select UTXOs (largest first)
        var sorted = utxos.slice().sort(function (a, b) { return b.value - a.value })
        var totalInput = 0
        var selected = []
        for (var i = 0; i < sorted.length; i++) {
          selected.push(sorted[i])
          totalInput += sorted[i].value
          if (totalInput >= totalNeeded) break
        }

        if (totalInput < totalNeeded) {
          statusEl.className = 'mk-status error'
          statusEl.textContent = 'Insufficient funds. Need ' + (totalNeeded / 1e8).toFixed(8) + ' BTM'
          return
        }

        statusEl.textContent = 'Building transaction...'

        // Build outputs
        var outputs = []

        // OP_RETURN with mark data
        var markData = generateMarkOpReturn(typeId, reference)
        outputs.push({ opReturn: markData })

        // If marking an address, send the amount to that address
        if (typeId === 'address' && reference.startsWith('b')) {
          outputs.push({ address: reference, value: amountSats })
        }

        // Change
        var changeAmount = totalInput - totalNeeded
        if (changeAmount > 546) {
          outputs.push({ address: wallet.address, value: changeAmount })
        }

        // Sign
        statusEl.textContent = 'Signing transaction...'
        var signedTx = await buildSignedTransaction(
          selected, outputs,
          wallet.encryptedKey, wallet.publicKey, wallet.address
        )

        // Broadcast
        statusEl.textContent = 'Broadcasting...'
        var result = await fetch(API + '/tx', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hex: signedTx.hex })
        }).then(function (r) { return r.json() })

        if (result.error) throw new Error(result.error)

        // Store reference for lookup
        var referenceHash = bytesToHex(markData.slice(5))
        try {
          await fetch(API + '/reference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hash: referenceHash, reference: reference, type: TYPE_CODES[typeId] || 0x01 })
          })
        } catch (e) { /* reference storage is optional */ }

        statusEl.className = 'mk-status success'
        statusEl.textContent = 'Marked! TX: ' + (result.txid || signedTx.txid).slice(0, 16) + '...'
        toast('Mark created!', 'success')

      } catch (e) {
        statusEl.className = 'mk-status error'
        statusEl.textContent = 'Failed: ' + e.message
      }
    }

    function renderMark () {
      wrap.innerHTML = ''

      // Header
      var header = document.createElement('div')
      header.className = 'mk-header'
      var h2 = document.createElement('h2')
      h2.textContent = '\u2696 Mark'
      header.appendChild(h2)
      var desc = document.createElement('p')
      desc.textContent = 'Endorse content on-chain with OP_RETURN. Mark URLs, addresses, documents, and more.'
      header.appendChild(desc)
      wrap.appendChild(header)

      // Mark type selector
      var card = document.createElement('div')
      card.className = 'mk-card'

      var typeLabel = document.createElement('div')
      typeLabel.className = 'mk-label'
      typeLabel.textContent = 'What to mark'
      card.appendChild(typeLabel)

      var typesGrid = document.createElement('div')
      typesGrid.className = 'mk-types'
      MARK_TYPES.forEach(function (mt, idx) {
        var btn = document.createElement('div')
        btn.className = 'mk-type' + (idx === selectedType ? ' active' : '')
        var icon = document.createElement('div')
        icon.className = 'mk-type-icon'
        icon.textContent = mt.icon
        btn.appendChild(icon)
        var label = document.createElement('div')
        label.className = 'mk-type-label'
        label.textContent = mt.label
        btn.appendChild(label)
        btn.addEventListener('click', function () { selectedType = idx; renderMark() })
        typesGrid.appendChild(btn)
      })
      card.appendChild(typesGrid)

      // Reference input
      var refLabel = document.createElement('div')
      refLabel.className = 'mk-label'
      refLabel.textContent = 'Reference'
      card.appendChild(refLabel)

      var refInput = document.createElement('input')
      refInput.className = 'mk-input'
      refInput.id = 'mk-ref-input'
      refInput.placeholder = MARK_TYPES[selectedType].placeholder
      card.appendChild(refInput)

      // Weight selector
      var weightLabel = document.createElement('div')
      weightLabel.className = 'mk-label'
      weightLabel.textContent = 'Weight'
      card.appendChild(weightLabel)

      var weightsDiv = document.createElement('div')
      weightsDiv.className = 'mk-weights'
      WEIGHTS.forEach(function (w, idx) {
        var btn = document.createElement('div')
        btn.className = 'mk-weight' + (idx === selectedWeight ? ' active' : '')
        btn.style.background = idx === selectedWeight ? w.color : ''
        var label = document.createElement('div')
        label.className = 'mk-weight-label'
        label.textContent = w.label
        btn.appendChild(label)
        var amount = document.createElement('div')
        amount.className = 'mk-weight-amount'
        amount.textContent = w.amount.toFixed(2) + ' BTM'
        btn.appendChild(amount)
        btn.addEventListener('click', function () { selectedWeight = idx; renderMark() })
        weightsDiv.appendChild(btn)
      })
      card.appendChild(weightsDiv)

      // OP_RETURN preview
      var previewLabel = document.createElement('div')
      previewLabel.className = 'mk-label'
      previewLabel.textContent = 'OP_RETURN Preview'
      card.appendChild(previewLabel)

      var preview = document.createElement('div')
      preview.className = 'mk-preview'
      preview.textContent = 'MRK | 01 | ' + MARK_TYPES[selectedType].id.toUpperCase() + ' | SHA256(reference)'
      card.appendChild(preview)

      // Status area
      var statusEl = document.createElement('div')
      statusEl.id = 'mk-status'

      // Submit
      var submitBtn = document.createElement('button')
      submitBtn.className = 'mk-btn'
      submitBtn.textContent = 'Create Mark (' + WEIGHTS[selectedWeight].amount.toFixed(2) + ' BTM)'
      submitBtn.addEventListener('click', function () {
        var ref = document.getElementById('mk-ref-input')
        if (!ref || !ref.value.trim()) {
          statusEl.className = 'mk-status error'
          statusEl.textContent = 'Enter a reference to mark'
          setTimeout(function () { statusEl.textContent = '' }, 2000)
          return
        }
        submitBtn.disabled = true
        submitBtn.textContent = 'Creating...'
        submitMark(MARK_TYPES[selectedType].id, ref.value.trim(), WEIGHTS[selectedWeight].amount, statusEl).then(function () {
          submitBtn.disabled = false
          submitBtn.textContent = 'Create Mark (' + WEIGHTS[selectedWeight].amount.toFixed(2) + ' BTM)'
        })
      })
      card.appendChild(submitBtn)
      card.appendChild(statusEl)

      wrap.appendChild(card)

      // Recent marks
      loadRecentMarks()
    }

    async function loadRecentMarks () {
      try {
        var marks = await fetch(API + '/marks').then(function (r) { return r.json() })
        if (!Array.isArray(marks) || !marks.length) return

        var title = document.createElement('div')
        title.className = 'mk-section-title'
        title.textContent = 'Recent Marks'
        wrap.appendChild(title)

        var card = document.createElement('div')
        card.className = 'mk-card'
        card.style.padding = '4px 0'

        marks.slice(0, 20).forEach(function (mark) {
          var item = document.createElement('div')
          item.className = 'mk-mark'

          var icon = document.createElement('span')
          icon.className = 'mk-mark-icon'
          var typeName = mark.type_name || mark.type || ''
          var typeStr = typeof typeName === 'string' ? typeName.toLowerCase() : ''
          var mt = MARK_TYPES.find(function (t) { return t.id === typeStr || t.label.toLowerCase() === typeStr }) || MARK_TYPES[0]
          icon.textContent = mt ? mt.icon : '\u2696'
          item.appendChild(icon)

          var amountBtm = mark.amount ? mark.amount / 1e8 : 0
          var weightColor = 'rgba(255,255,255,0.35)'
          var weightLabel = ''
          var refSize = '0.85em'
          if (amountBtm >= 1.0) {
            weightColor = '#f59e0b'
            weightLabel = 'Legendary'
            refSize = '1.05em'
          } else if (amountBtm >= 0.1) {
            weightColor = '#a855f7'
            weightLabel = 'Love it'
            refSize = '0.95em'
          } else if (amountBtm >= 0.05) {
            weightColor = '#10b981'
            weightLabel = 'Nice'
          }

          var info = document.createElement('div')
          info.className = 'mk-mark-info'
          var ref = document.createElement('div')
          ref.className = 'mk-mark-ref'
          ref.style.fontSize = refSize
          if (amountBtm >= 1.0) ref.style.color = 'rgba(255,255,255,0.9)'
          var refText = mark.reference || mark.reference_hash || mark.hash || '\u2014'
          if (mark.type === 1 && mark.reference) {
            var link = document.createElement('a')
            link.href = mark.reference
            link.target = '_blank'
            link.style.color = 'inherit'
            link.textContent = refText
            ref.appendChild(link)
          } else {
            ref.textContent = refText
          }
          info.appendChild(ref)
          var meta = document.createElement('div')
          meta.className = 'mk-mark-meta'
          meta.textContent = (mark.type_name || '') + (mark.height ? ' \u00B7 block ' + mark.height : '') + (mark.marker ? ' \u00B7 ' + mark.marker.slice(0, 8) + '\u2026' : '')
          info.appendChild(meta)
          item.appendChild(info)

          var amountDiv = document.createElement('div')
          amountDiv.style.textAlign = 'right'
          amountDiv.style.whiteSpace = 'nowrap'
          var amountText = document.createElement('div')
          amountText.className = 'mk-mark-amount'
          amountText.style.color = weightColor
          amountText.style.fontSize = amountBtm >= 1.0 ? '1em' : '0.85em'
          amountText.textContent = amountBtm ? amountBtm.toFixed(2) + ' BTM' : ''
          amountDiv.appendChild(amountText)
          if (weightLabel) {
            var labelDiv = document.createElement('div')
            labelDiv.style.cssText = 'font-size:0.7em;color:' + weightColor
            labelDiv.textContent = weightLabel
            amountDiv.appendChild(labelDiv)
          }
          item.appendChild(amountDiv)

          card.appendChild(item)
        })

        wrap.appendChild(card)
      } catch (e) { /* marks endpoint may not exist yet */ }
    }

    renderMark()
  }
}
