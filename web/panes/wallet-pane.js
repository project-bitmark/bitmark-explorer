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

var QRCode
async function loadQRCode () {
  if (QRCode) return true
  try {
    var mod = await import('https://esm.sh/qrcode@1.5.3')
    QRCode = mod.default || mod
    return true
  } catch (e) { return false }
}

function hexToBytes (hex) {
  var bytes = new Uint8Array(hex.length / 2)
  for (var i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
  return bytes
}

function base58check (version, payload) {
  var ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  var data = new Uint8Array(1 + payload.length)
  data[0] = version
  data.set(payload, 1)
  var hash1 = sha256(data)
  var hash2 = sha256(hash1)
  var full = new Uint8Array(data.length + 4)
  full.set(data)
  full.set(hash2.slice(0, 4), data.length)
  var num = 0n
  for (var i = 0; i < full.length; i++) num = num * 256n + BigInt(full[i])
  var result = ''
  while (num > 0n) { result = ALPHABET[Number(num % 58n)] + result; num = num / 58n }
  for (var j = 0; j < full.length && full[j] === 0; j++) result = '1' + result
  return result
}

function privkeyToAddress (hexKey) {
  var pubkey = secp256k1.getPublicKey(hexKey, true)
  var hash = ripemd160(sha256(pubkey))
  return base58check(0x55, hash)
}

function bytesToHex (bytes) {
  return Array.from(bytes).map(function (b) { return b.toString(16).padStart(2, '0') }).join('')
}

function base58Decode (str) {
  var ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  var bytes = [0]
  for (var c = 0; c < str.length; c++) {
    var value = ALPHABET.indexOf(str[c])
    if (value < 0) throw new Error('Invalid Base58 character')
    var carry = value
    for (var i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58
      bytes[i] = carry & 0xff
      carry >>= 8
    }
    while (carry > 0) { bytes.push(carry & 0xff); carry >>= 8 }
  }
  for (var j = 0; j < str.length && str[j] === '1'; j++) bytes.push(0)
  return new Uint8Array(bytes.reverse())
}

function base58CheckDecode (str) {
  var data = base58Decode(str)
  var payload = data.slice(0, -4)
  var checksum = data.slice(-4)
  var expected = sha256(sha256(payload)).slice(0, 4)
  for (var i = 0; i < 4; i++) {
    if (checksum[i] !== expected[i]) throw new Error('Invalid checksum')
  }
  return { version: payload[0], payload: payload.slice(1) }
}

function encodeVarInt (n) {
  if (n < 0xfd) return new Uint8Array([n])
  if (n <= 0xffff) return new Uint8Array([0xfd, n & 0xff, (n >> 8) & 0xff])
  return new Uint8Array([0xfe, n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff])
}

function writeUInt32LE (n) {
  var buf = new Uint8Array(4)
  buf[0] = n & 0xff; buf[1] = (n >> 8) & 0xff; buf[2] = (n >> 16) & 0xff; buf[3] = (n >> 24) & 0xff
  return buf
}

function writeUInt64LE (n) {
  var buf = new Uint8Array(8)
  buf[0] = n & 0xff; buf[1] = (n >> 8) & 0xff; buf[2] = (n >> 16) & 0xff; buf[3] = (n >> 24) & 0xff
  var high = Math.floor(n / 0x100000000)
  buf[4] = high & 0xff; buf[5] = (high >> 8) & 0xff; buf[6] = (high >> 16) & 0xff; buf[7] = (high >> 24) & 0xff
  return buf
}

function reverseBytes (bytes) {
  var copy = new Uint8Array(bytes.length)
  copy.set(bytes)
  return copy.reverse()
}

function concatBytes () {
  var arrays = Array.from(arguments)
  var total = arrays.reduce(function (s, a) { return s + a.length }, 0)
  var result = new Uint8Array(total)
  var offset = 0
  for (var i = 0; i < arrays.length; i++) { result.set(arrays[i], offset); offset += arrays[i].length }
  return result
}

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

function serializeTx (tx, forSigning, inputIndex, prevScriptPubKey) {
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

function signTxInput (tx, idx, privateKey, publicKey) {
  var input = tx.inputs[idx]
  var prevScript = createP2PKHScriptPubKey(input.address)
  var serialized = serializeTx(tx, true, idx, prevScript)
  var sigHash = hash256(serialized)
  var privKeyBytes = hexToBytes(privateKey)
  var signature = secp256k1.sign(sigHash, privKeyBytes, { lowS: true })
  var derSig = signature.toDERRawBytes()
  var sigWithType = new Uint8Array(derSig.length + 1)
  sigWithType.set(derSig)
  sigWithType[derSig.length] = 0x01 // SIGHASH_ALL
  var pubKeyBytes = hexToBytes(publicKey)
  return createP2PKHScriptSig(sigWithType, pubKeyBytes)
}

async function buildAndSignTx (selectedUtxos, outputs, privateKey, publicKey, fromAddress) {
  var tx = {
    version: 1,
    inputs: selectedUtxos.map(function (u) {
      return { txid: u.txid, vout: u.vout, value: u.value, address: fromAddress, sequence: 0xffffffff, scriptSig: null }
    }),
    outputs: outputs.map(function (o) {
      return { value: o.value, address: o.address, scriptPubKey: createP2PKHScriptPubKey(o.address) }
    }),
    locktime: 0
  }
  for (var i = 0; i < tx.inputs.length; i++) {
    tx.inputs[i].scriptSig = signTxInput(tx, i, privateKey, publicKey)
  }
  var rawTx = serializeTx(tx, false)
  var txid = bytesToHex(reverseBytes(hash256(rawTx)))
  return { hex: bytesToHex(rawTx), txid: txid }
}

function getNostrAccount () {
  try {
    var stored = localStorage.getItem('currentAccount')
    if (!stored) return null
    var account = JSON.parse(stored)
    if (account && account.privkey && /^[0-9a-f]{64}$/i.test(account.privkey)) return account
  } catch (e) {}
  return null
}

export default {
  label: 'Wallet',
  icon: '\uD83D\uDCB0',

  canHandle (subject, store) {
    var node = store.get(subject.value)
    var type = store.type(node)
    return type && type.includes('WebApplication')
  },

  render (subject, store, container) {
    var tab = 'receive'
    var wallet = null
    var balance = 0
    var addresses = []
    var selectedAddr = 0
    var utxos = []
    var history = []

    var style = document.createElement('style')
    style.textContent = [
      '.wl-wrap { padding:24px 32px; max-width:600px; }',
      '.wl-header { margin-bottom:24px; }',
      '.wl-header h2 { font-size:1.8rem; font-weight:700; color:rgba(255,255,255,0.95); margin-bottom:4px; }',
      '.wl-balance { font-size:2.2rem; font-weight:700; color:#818cf8; margin-bottom:4px; }',
      '.wl-balance-sub { font-size:0.85em; color:rgba(255,255,255,0.3); }',
      '.wl-no-wallet { text-align:center; padding:40px 20px; }',
      '.wl-no-wallet p { color:rgba(255,255,255,0.4); margin-bottom:20px; font-size:0.95em; }',
      '.wl-btn { padding:10px 24px; border:none; border-radius:8px; font:600 0.9em -apple-system,sans-serif; cursor:pointer; }',
      '.wl-btn-primary { background:#6366f1; color:#fff; }',
      '.wl-btn-primary:hover { background:#4f46e5; }',
      '.wl-btn-secondary { background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.7); }',
      '.wl-btn-secondary:hover { background:rgba(255,255,255,0.1); }',
      '.wl-btn-danger { background:rgba(239,68,68,0.15); color:#f87171; }',
      '.wl-btn-danger:hover { background:rgba(239,68,68,0.25); }',
      '.wl-btn-group { display:flex; gap:10px; margin-bottom:24px; }',
      '.wl-tabs { display:flex; gap:0; margin-bottom:20px; border-bottom:1px solid rgba(255,255,255,0.06); }',
      '.wl-tab { padding:10px 20px; background:none; border:none; border-bottom:2px solid transparent; color:rgba(255,255,255,0.4); font:0.9em -apple-system,sans-serif; cursor:pointer; }',
      '.wl-tab:hover { color:rgba(255,255,255,0.7); }',
      '.wl-tab.active { color:rgba(255,255,255,0.9); border-bottom-color:#6366f1; }',
      '.wl-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:20px; margin-bottom:16px; }',
      '.wl-label { font-size:0.75em; font-weight:600; color:rgba(255,255,255,0.3); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px; }',
      '.wl-addr { font-family:"SF Mono",SFMono-Regular,Consolas,monospace; font-size:0.85em; color:#818cf8; word-break:break-all; margin-bottom:12px; }',
      '.wl-input { width:100%; padding:10px 14px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:8px; color:rgba(255,255,255,0.9); font:0.9em -apple-system,sans-serif; outline:none; margin-bottom:12px; }',
      '.wl-input:focus { border-color:rgba(99,102,241,0.4); }',
      '.wl-input::placeholder { color:rgba(255,255,255,0.2); }',
      '.wl-seed { font-family:"SF Mono",SFMono-Regular,Consolas,monospace; font-size:0.85em; color:rgba(255,255,255,0.8); background:rgba(255,255,255,0.03); padding:16px; border-radius:8px; border:1px solid rgba(255,255,255,0.06); word-break:break-all; line-height:1.8; margin-bottom:12px; }',
      '.wl-warning { font-size:0.8em; color:#fbbf24; margin-bottom:12px; }',
      '.wl-qr { display:block; width:fit-content; padding:10px; background:#fff; border-radius:8px; margin-bottom:12px; line-height:0; }',
      '.wl-fee { font-size:0.8em; color:rgba(255,255,255,0.3); margin-bottom:12px; }',
      '.wl-hist-item { display:flex; align-items:center; gap:12px; padding:12px 0; border-bottom:1px solid rgba(255,255,255,0.04); }',
      '.wl-hist-icon { font-size:1.2em; }',
      '.wl-hist-info { flex:1; }',
      '.wl-hist-txid { font-family:"SF Mono",SFMono-Regular,Consolas,monospace; font-size:0.8em; color:rgba(255,255,255,0.4); max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
      '.wl-hist-amount { font-weight:600; font-size:0.9em; }',
      '.wl-hist-amount.in { color:#22c55e; }',
      '.wl-hist-amount.out { color:#f87171; }',
      '.wl-hist-conf { font-size:0.75em; color:rgba(255,255,255,0.25); }',
      '.wl-addr-select { width:100%; padding:8px 12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:6px; color:rgba(255,255,255,0.9); font:0.85em "SF Mono",monospace; outline:none; appearance:auto; margin-bottom:12px; }',
      '.wl-toast { position:fixed; bottom:20px; right:20px; padding:12px 20px; border-radius:8px; font-size:0.85em; font-weight:600; z-index:999; animation:wl-fade 3s forwards; }',
      '.wl-toast.success { background:#22c55e; color:#fff; }',
      '.wl-toast.error { background:#ef4444; color:#fff; }',
      '@keyframes wl-fade { 0%,80% { opacity:1; } 100% { opacity:0; } }'
    ].join('\n')
    container.appendChild(style)

    var wrap = document.createElement('div')
    wrap.className = 'wl-wrap'
    container.appendChild(wrap)

    function satsToBtm (sats) { return (sats / 100000000).toFixed(8) }
    function btmToSats (btm) { return Math.round(parseFloat(btm) * 100000000) }

    function toast (msg, type) {
      var t = document.createElement('div')
      t.className = 'wl-toast ' + (type || 'success')
      t.textContent = msg
      document.body.appendChild(t)
      setTimeout(function () { t.remove() }, 3000)
    }

    function getAddr (entry) {
      return typeof entry === 'string' ? entry : (entry && entry.address || '')
    }

    function getAddresses (w) {
      if (w.addresses && w.addresses.length) return w.addresses.map(getAddr)
      if (w.address) return [w.address]
      return []
    }

    function loadWallet () {
      var stored = localStorage.getItem('bitmark_wallet')
      if (stored) {
        try { wallet = JSON.parse(stored) } catch (e) { wallet = null }
      }
      if (wallet) addresses = getAddresses(wallet)
    }

    async function tryNostrLogin () {
      var account = getNostrAccount()
      if (!account) return false
      var ok = await loadCrypto()
      if (!ok) return false
      var addr = privkeyToAddress(account.privkey)
      wallet = {
        address: addr,
        encryptedKey: account.privkey,
        publicKey: secp256k1.getPublicKey(account.privkey, true).reduce(function (s, b) { return s + b.toString(16).padStart(2, '0') }, ''),
        nostrPubkey: account.pubkey,
        addresses: [{ index: 0, address: addr }],
        balance: 0
      }
      addresses = [addr]
      saveWallet()
      return true
    }

    function saveWallet () {
      if (wallet) localStorage.setItem('bitmark_wallet', JSON.stringify(wallet))
    }

    function clearWallet () {
      localStorage.removeItem('bitmark_wallet')
      wallet = null
      balance = 0
      addresses = []
      utxos = []
      history = []
      renderWallet()
    }

    async function refreshBalance () {
      if (!wallet || !addresses.length) return
      var totalBalance = 0
      utxos = []
      history = []
      for (var i = 0; i < addresses.length; i++) {
        var addr = addresses[i]
        try {
          var bal = await fetch(API + '/address/' + addr + '/balance').then(function (r) { return r.json() })
          var balVal = typeof bal === 'object' ? (bal.confirmed || bal.balance || 0) : (bal || 0)
          totalBalance += balVal
          var u = await fetch(API + '/address/' + addr + '/utxos').then(function (r) { return r.json() })
          if (Array.isArray(u)) utxos = utxos.concat(u.map(function (x) { x._addr = addr; x._idx = i; return x }))
          var txs = await fetch(API + '/address/' + addr + '/txs').then(function (r) { return r.json() })
          if (Array.isArray(txs)) history = history.concat(txs)
        } catch (e) { /* skip */ }
      }
      balance = totalBalance
    }

    async function renderWallet () {
      wrap.innerHTML = ''
      loadWallet()
      if (!wallet) {
        var fromNostr = await tryNostrLogin()
        if (fromNostr) {
          toast('Wallet loaded from Nostr key')
        }
      }
      if (!wallet) {
        renderNoWallet()
      } else {
        renderWalletUI()
      }
    }

    function renderNoWallet () {
      var div = document.createElement('div')
      div.className = 'wl-no-wallet'
      var p = document.createElement('p')
      p.textContent = 'No wallet found. Create a new wallet or restore from a seed phrase.'
      div.appendChild(p)

      var btnGroup = document.createElement('div')
      btnGroup.className = 'wl-btn-group'
      btnGroup.style.justifyContent = 'center'

      var createBtn = document.createElement('button')
      createBtn.className = 'wl-btn wl-btn-primary'
      createBtn.textContent = 'Create Wallet'
      createBtn.addEventListener('click', function () { renderCreateWallet() })
      btnGroup.appendChild(createBtn)

      var restoreBtn = document.createElement('button')
      restoreBtn.className = 'wl-btn wl-btn-secondary'
      restoreBtn.textContent = 'Restore Wallet'
      restoreBtn.addEventListener('click', function () { renderRestoreWallet() })
      btnGroup.appendChild(restoreBtn)

      div.appendChild(btnGroup)
      wrap.appendChild(div)
    }

    function renderCreateWallet () {
      wrap.innerHTML = ''
      var card = document.createElement('div')
      card.className = 'wl-card'

      var label = document.createElement('div')
      label.className = 'wl-label'
      label.textContent = 'Your Seed Phrase'
      card.appendChild(label)

      var info = document.createElement('p')
      info.style.cssText = 'font-size:0.85em;color:rgba(255,255,255,0.5);margin-bottom:16px;'
      info.textContent = 'Wallet creation requires BIP39 libraries. For now, restore from an existing seed phrase or private key.'
      card.appendChild(info)

      var input = document.createElement('textarea')
      input.className = 'wl-input'
      input.style.minHeight = '80px'
      input.placeholder = 'Enter 12-word seed phrase or 64-character hex private key...'
      card.appendChild(input)

      var warning = document.createElement('div')
      warning.className = 'wl-warning'
      warning.textContent = '\u26A0 Store your seed phrase safely. Anyone with it can access your funds.'
      card.appendChild(warning)

      var btnGroup = document.createElement('div')
      btnGroup.className = 'wl-btn-group'

      var saveBtn = document.createElement('button')
      saveBtn.className = 'wl-btn wl-btn-primary'
      saveBtn.textContent = 'Save Wallet'
      saveBtn.addEventListener('click', async function () {
        var seed = input.value.trim()
        if (!seed) return toast('Enter a seed phrase or key', 'error')
        var isHexKey = /^[0-9a-f]{64}$/i.test(seed)
        var addr
        if (isHexKey) {
          var ok = await loadCrypto()
          if (!ok) return toast('Failed to load crypto libraries', 'error')
          addr = privkeyToAddress(seed)
          wallet = {
            address: addr,
            encryptedKey: seed,
            publicKey: secp256k1.getPublicKey(seed, true).reduce(function (s, b) { return s + b.toString(16).padStart(2, '0') }, ''),
            addresses: [{ index: 0, address: addr }],
            balance: 0
          }
        } else {
          // Seed phrase — need BIP39 for full derivation, prompt for address for now
          addr = prompt('Enter your Bitmark address (starts with b):')
          if (!addr || !addr.startsWith('b')) return toast('Invalid address', 'error')
          wallet = {
            address: addr,
            mnemonic: seed,
            addresses: [{ index: 0, address: addr }],
            balance: 0
          }
        }
        saveWallet()
        toast('Wallet saved')
        renderWallet()
      })
      btnGroup.appendChild(saveBtn)

      var backBtn = document.createElement('button')
      backBtn.className = 'wl-btn wl-btn-secondary'
      backBtn.textContent = 'Back'
      backBtn.addEventListener('click', function () { renderWallet() })
      btnGroup.appendChild(backBtn)

      card.appendChild(btnGroup)
      wrap.appendChild(card)
    }

    var renderRestoreWallet = renderCreateWallet // same flow for now

    async function renderWalletUI () {
      var header = document.createElement('div')
      header.className = 'wl-header'
      var h2 = document.createElement('h2')
      h2.textContent = '\uD83D\uDCB0 Wallet'
      header.appendChild(h2)
      var balDiv = document.createElement('div')
      balDiv.className = 'wl-balance'
      balDiv.textContent = 'Loading\u2026'
      header.appendChild(balDiv)
      var balSub = document.createElement('div')
      balSub.className = 'wl-balance-sub'
      balSub.textContent = 'BTM'
      header.appendChild(balSub)
      wrap.appendChild(header)

      // Actions
      var actions = document.createElement('div')
      actions.className = 'wl-btn-group'
      var refreshBtn = document.createElement('button')
      refreshBtn.className = 'wl-btn wl-btn-secondary'
      refreshBtn.textContent = 'Refresh'
      refreshBtn.addEventListener('click', async function () {
        await refreshBalance()
        balDiv.textContent = satsToBtm(balance)
        renderTabContent()
      })
      actions.appendChild(refreshBtn)
      var logoutBtn = document.createElement('button')
      logoutBtn.className = 'wl-btn wl-btn-danger'
      logoutBtn.textContent = 'Clear Wallet'
      logoutBtn.addEventListener('click', function () {
        if (confirm('Clear wallet from this browser? Make sure you have your seed phrase backed up.')) clearWallet()
      })
      actions.appendChild(logoutBtn)
      wrap.appendChild(actions)

      // Tabs
      var tabsDiv = document.createElement('div')
      tabsDiv.className = 'wl-tabs'
      ;['receive', 'send', 'history'].forEach(function (t) {
        var btn = document.createElement('button')
        btn.className = 'wl-tab' + (t === tab ? ' active' : '')
        btn.textContent = t.charAt(0).toUpperCase() + t.slice(1)
        btn.addEventListener('click', function () {
          tab = t
          tabsDiv.querySelectorAll('.wl-tab').forEach(function (b) { b.classList.remove('active') })
          btn.classList.add('active')
          renderTabContent()
        })
        tabsDiv.appendChild(btn)
      })
      wrap.appendChild(tabsDiv)

      var content = document.createElement('div')
      content.id = 'wl-tab-content'
      wrap.appendChild(content)

      // Load balance
      await refreshBalance()
      balDiv.textContent = satsToBtm(balance)
      renderTabContent()
    }

    function renderTabContent () {
      var content = document.getElementById('wl-tab-content')
      if (!content) return
      content.innerHTML = ''
      if (tab === 'receive') renderReceive(content)
      else if (tab === 'send') renderSend(content)
      else if (tab === 'history') renderHistory(content)
    }

    function renderReceive (el) {
      var card = document.createElement('div')
      card.className = 'wl-card'

      if (addresses.length > 1) {
        var label = document.createElement('div')
        label.className = 'wl-label'
        label.textContent = 'Select Address'
        card.appendChild(label)
        var sel = document.createElement('select')
        sel.className = 'wl-addr-select'
        addresses.forEach(function (a, i) {
          var opt = document.createElement('option')
          opt.value = i
          opt.textContent = a
          if (i === selectedAddr) opt.selected = true
          sel.appendChild(opt)
        })
        sel.addEventListener('change', function () { selectedAddr = parseInt(sel.value); renderTabContent() })
        card.appendChild(sel)
      }

      var addrLabel = document.createElement('div')
      addrLabel.className = 'wl-label'
      addrLabel.textContent = 'Your Address'
      card.appendChild(addrLabel)

      var addr = addresses[selectedAddr]
      var addrDiv = document.createElement('div')
      addrDiv.className = 'wl-addr'
      addrDiv.textContent = addr || 'No address'
      card.appendChild(addrDiv)

      if (addr) {
        var qrWrap = document.createElement('div')
        qrWrap.className = 'wl-qr'
        card.appendChild(qrWrap)
        loadQRCode().then(function (ok) {
          if (!ok) return
          var canvas = document.createElement('canvas')
          QRCode.toCanvas(canvas, addr, { width: 180, margin: 1 }, function (err) {
            if (!err) qrWrap.appendChild(canvas)
          })
        })
      }

      var copyBtn = document.createElement('button')
      copyBtn.className = 'wl-btn wl-btn-secondary'
      copyBtn.textContent = 'Copy Address'
      copyBtn.addEventListener('click', function () {
        if (addr) { navigator.clipboard.writeText(addr); toast('Address copied') }
      })
      card.appendChild(copyBtn)

      el.appendChild(card)
    }

    function renderSend (el) {
      var card = document.createElement('div')
      card.className = 'wl-card'

      var toLabel = document.createElement('div')
      toLabel.className = 'wl-label'
      toLabel.textContent = 'Recipient Address'
      card.appendChild(toLabel)
      var toInput = document.createElement('input')
      toInput.className = 'wl-input'
      toInput.placeholder = 'b...'
      card.appendChild(toInput)

      var amtLabel = document.createElement('div')
      amtLabel.className = 'wl-label'
      amtLabel.textContent = 'Amount (BTM)'
      card.appendChild(amtLabel)
      var amtInput = document.createElement('input')
      amtInput.className = 'wl-input'
      amtInput.type = 'number'
      amtInput.step = '0.00000001'
      amtInput.placeholder = '0.00000000'
      card.appendChild(amtInput)

      var availDiv = document.createElement('div')
      availDiv.className = 'wl-fee'
      availDiv.textContent = 'Available: ' + satsToBtm(balance) + ' BTM'
      card.appendChild(availDiv)

      var feeDiv = document.createElement('div')
      feeDiv.className = 'wl-fee'
      feeDiv.textContent = 'Network fee: 0.00010000 BTM'
      card.appendChild(feeDiv)

      var sendBtn = document.createElement('button')
      sendBtn.className = 'wl-btn wl-btn-primary'
      sendBtn.textContent = 'Send Transaction'
      sendBtn.addEventListener('click', async function () {
        var to = toInput.value.trim()
        var amount = btmToSats(amtInput.value)
        if (!to || !to.startsWith('b')) return toast('Invalid address', 'error')
        if (amount <= 0) return toast('Invalid amount', 'error')
        if (amount + 10000 > balance) return toast('Insufficient balance', 'error')
        if (!wallet.encryptedKey) return toast('No private key available', 'error')

        var ok = await loadCrypto()
        if (!ok) return toast('Failed to load crypto libraries', 'error')

        sendBtn.disabled = true
        sendBtn.textContent = 'Building...'

        try {
          var fee = 10000
          var addr = addresses[selectedAddr]

          // Select UTXOs
          var totalInput = 0
          var selected = []
          for (var i = 0; i < utxos.length; i++) {
            selected.push(utxos[i])
            totalInput += utxos[i].value
            if (totalInput >= amount + fee) break
          }
          if (totalInput < amount + fee) throw new Error('Insufficient funds')

          var change = totalInput - amount - fee
          var outputs = [{ address: to, value: amount }]
          if (change > 0) outputs.push({ address: addr, value: change })

          var signedTx = await buildAndSignTx(selected, outputs, wallet.encryptedKey, wallet.publicKey, addr)

          sendBtn.textContent = 'Broadcasting...'

          var result = await fetch(API + '/tx', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hex: signedTx.hex })
          }).then(function (r) { return r.json() })

          if (result.error) throw new Error(result.error)

          toast('Sent! TXID: ' + (result.txid || signedTx.txid).slice(0, 16) + '...')
          toInput.value = ''
          amtInput.value = ''
          setTimeout(async function () {
            await refreshBalance()
            renderTabContent()
          }, 2000)
        } catch (e) {
          toast('Failed: ' + e.message, 'error')
        } finally {
          sendBtn.disabled = false
          sendBtn.textContent = 'Send Transaction'
        }
      })
      card.appendChild(sendBtn)

      el.appendChild(card)
    }

    function renderHistory (el) {
      if (!history.length) {
        var empty = document.createElement('div')
        empty.style.cssText = 'text-align:center;padding:30px;color:rgba(255,255,255,0.3);'
        empty.textContent = 'No transactions yet'
        el.appendChild(empty)
        return
      }

      var card = document.createElement('div')
      card.className = 'wl-card'
      card.style.padding = '8px 20px'

      history.forEach(function (tx) {
        var item = document.createElement('div')
        item.className = 'wl-hist-item'

        var icon = document.createElement('span')
        icon.className = 'wl-hist-icon'
        icon.textContent = '\u2194'
        item.appendChild(icon)

        var info = document.createElement('div')
        info.className = 'wl-hist-info'
        var txid = document.createElement('div')
        txid.className = 'wl-hist-txid'
        txid.textContent = tx.txid || tx.hash || ''
        info.appendChild(txid)
        var conf = document.createElement('div')
        conf.className = 'wl-hist-conf'
        conf.textContent = tx.confirmations != null ? tx.confirmations + ' confirmations' : ''
        info.appendChild(conf)
        item.appendChild(info)

        card.appendChild(item)
      })

      el.appendChild(card)
    }

    renderWallet()
  }
}
