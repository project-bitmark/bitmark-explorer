var API = ''

export default {
  label: 'Explorer',
  icon: '\uD83D\uDD0D',

  canHandle (subject, store) {
    var node = store.get(subject.value)
    var type = store.type(node)
    return type && type.includes('WebApplication')
  },

  render (subject, store, container) {
    var view = 'home'
    var viewData = null

    var style = document.createElement('style')
    style.textContent = [
      '.bx-wrap { padding:24px 32px; }',
      '.bx-header { display:flex; align-items:center; gap:16px; margin-bottom:20px; }',
      '.bx-header h2 { font-size:1.8rem; font-weight:700; color:rgba(255,255,255,0.95); }',
      '.bx-search { flex:1; display:flex; gap:8px; }',
      '.bx-search input { flex:1; padding:10px 16px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:8px; color:rgba(255,255,255,0.9); font:0.9em -apple-system,sans-serif; outline:none; }',
      '.bx-search input:focus { border-color:rgba(99,102,241,0.4); }',
      '.bx-search input::placeholder { color:rgba(255,255,255,0.2); }',
      '.bx-search button { padding:10px 20px; background:#6366f1; border:none; border-radius:8px; color:#fff; font:600 0.85em -apple-system,sans-serif; cursor:pointer; white-space:nowrap; }',
      '.bx-search button:hover { background:#4f46e5; }',
      '.bx-breadcrumb { display:flex; align-items:center; gap:6px; margin-bottom:16px; font-size:0.85em; color:rgba(255,255,255,0.3); }',
      '.bx-breadcrumb a { color:#818cf8; text-decoration:none; cursor:pointer; }',
      '.bx-breadcrumb a:hover { color:#a5b4fc; }',
      '.bx-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:24px; }',
      '.bx-stat { padding:16px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:10px; }',
      '.bx-stat-label { font-size:0.7em; font-weight:600; color:rgba(255,255,255,0.3); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; }',
      '.bx-stat-value { font-size:1.2em; font-weight:700; color:rgba(255,255,255,0.9); }',
      '.bx-stat-value.accent { color:#818cf8; }',
      '.bx-table { width:100%; border-collapse:collapse; }',
      '.bx-table th { text-align:left; padding:10px 12px; font-size:0.75em; font-weight:600; color:rgba(255,255,255,0.3); text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid rgba(255,255,255,0.06); }',
      '.bx-table td { padding:12px; font-size:0.9em; color:rgba(255,255,255,0.75); border-bottom:1px solid rgba(255,255,255,0.04); }',
      '.bx-table tr:hover { background:rgba(255,255,255,0.02); }',
      '.bx-link { color:#818cf8; text-decoration:none; cursor:pointer; }',
      '.bx-link:hover { color:#a5b4fc; text-decoration:underline; }',
      '.bx-mono { font-family:"SF Mono",SFMono-Regular,Consolas,monospace; font-size:0.85em; }',
      '.bx-hash { max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:inline-block; vertical-align:bottom; }',
      '.bx-loading { text-align:center; padding:40px; color:rgba(255,255,255,0.3); }',
      '.bx-error { text-align:center; padding:40px; color:#f87171; }',
      '.bx-detail { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:12px; overflow:hidden; margin-bottom:20px; }',
      '.bx-detail-header { padding:20px 24px; border-bottom:1px solid rgba(255,255,255,0.06); }',
      '.bx-detail-title { font-size:1.3em; font-weight:700; color:rgba(255,255,255,0.95); margin-bottom:4px; }',
      '.bx-detail-hash { font-family:"SF Mono",SFMono-Regular,Consolas,monospace; font-size:0.8em; color:rgba(255,255,255,0.35); word-break:break-all; }',
      '.bx-detail-grid { padding:20px 24px; display:grid; grid-template-columns:1fr 1fr; gap:14px; }',
      '.bx-field-label { font-size:0.7em; font-weight:600; color:rgba(255,255,255,0.3); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px; }',
      '.bx-field-value { font-size:0.9em; color:rgba(255,255,255,0.8); word-break:break-all; }',
      '.bx-io { display:grid; grid-template-columns:1fr auto 1fr; gap:16px; align-items:start; padding:20px 24px; }',
      '.bx-io-arrow { color:rgba(255,255,255,0.15); font-size:1.5em; padding-top:20px; }',
      '.bx-io-item { padding:10px 14px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.04); border-radius:8px; margin-bottom:8px; }',
      '.bx-io-addr { font-family:"SF Mono",SFMono-Regular,Consolas,monospace; font-size:0.8em; color:#818cf8; word-break:break-all; cursor:pointer; }',
      '.bx-io-addr:hover { color:#a5b4fc; }',
      '.bx-io-amount { font-size:0.85em; color:rgba(255,255,255,0.6); margin-top:4px; }',
      '.bx-io-label { font-size:0.75em; font-weight:600; color:rgba(255,255,255,0.25); text-transform:uppercase; margin-bottom:8px; }',
      '.bx-badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:0.75em; font-weight:600; }',
      '.bx-badge.synced { background:rgba(34,197,94,0.2); color:#22c55e; }',
      '.bx-badge.syncing { background:rgba(251,191,36,0.2); color:#fbbf24; }',
      '.bx-section-title { font-size:1em; font-weight:600; color:rgba(255,255,255,0.7); margin-bottom:12px; }',
      '.bx-utxo-table { width:100%; border-collapse:collapse; margin-top:12px; }',
      '.bx-utxo-table th { text-align:left; padding:8px 10px; font-size:0.7em; font-weight:600; color:rgba(255,255,255,0.3); text-transform:uppercase; border-bottom:1px solid rgba(255,255,255,0.06); }',
      '.bx-utxo-table td { padding:8px 10px; font-size:0.85em; color:rgba(255,255,255,0.7); border-bottom:1px solid rgba(255,255,255,0.04); }'
    ].join('\n')
    container.appendChild(style)

    var wrap = document.createElement('div')
    wrap.className = 'bx-wrap'
    container.appendChild(wrap)

    function formatBtm (val) {
      if (val == null) return '\u2014'
      // API may return whole BTM or satoshis
      var n = typeof val === 'number' ? val : parseFloat(val)
      if (n > 1000000) return (n / 100000000).toFixed(8) // satoshis
      return n.toFixed(8) // already BTM
    }

    function formatTime (ts) {
      if (!ts) return '\u2014'
      var d = new Date(ts * 1000)
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ' ' + d.toTimeString().slice(0, 5)
    }

    function formatNumber (n) {
      return n != null ? n.toLocaleString() : '\u2014'
    }

    function truncHash (hash, len) {
      if (!hash) return ''
      len = len || 8
      return hash.slice(0, len) + '\u2026' + hash.slice(-len)
    }

    async function apiFetch (path) {
      var res = await fetch(API + path)
      if (!res.ok) throw new Error('API error: ' + res.status)
      var text = await res.text()
      try { return JSON.parse(text) } catch (e) { return text }
    }

    function handleSearch (query) {
      query = query.trim()
      if (!query) return
      if (/^\d+$/.test(query)) {
        loadBlock(parseInt(query))
      } else if (query.startsWith('b')) {
        loadAddress(query)
      } else {
        loadTx(query)
      }
    }

    function renderView () {
      wrap.innerHTML = ''
      renderHeader()
      if (view !== 'home') renderBreadcrumb()
      if (view === 'home') loadHome()
      else if (view === 'block') renderBlockDetail()
      else if (view === 'tx') renderTxDetail()
      else if (view === 'address') renderAddrDetail()
    }

    function renderHeader () {
      var header = document.createElement('div')
      header.className = 'bx-header'
      var h2 = document.createElement('h2')
      h2.textContent = '\u0243 Explorer'
      header.appendChild(h2)

      var search = document.createElement('div')
      search.className = 'bx-search'
      var input = document.createElement('input')
      input.placeholder = 'Block height, txid, or address (b...)\u2026'
      var btn = document.createElement('button')
      btn.textContent = 'Search'
      var doSearch = function () { handleSearch(input.value) }
      btn.addEventListener('click', doSearch)
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch() })
      search.appendChild(input)
      search.appendChild(btn)
      header.appendChild(search)
      wrap.appendChild(header)
    }

    function renderBreadcrumb () {
      var bc = document.createElement('div')
      bc.className = 'bx-breadcrumb'
      var home = document.createElement('a')
      home.textContent = 'Home'
      home.addEventListener('click', function () { view = 'home'; renderView() })
      bc.appendChild(home)
      bc.appendChild(document.createTextNode(' \u203A '))
      if (view === 'block') bc.appendChild(document.createTextNode('Block ' + formatNumber(viewData.height)))
      else if (view === 'tx') bc.appendChild(document.createTextNode('Tx ' + truncHash(viewData.txid)))
      else if (view === 'address') bc.appendChild(document.createTextNode('Address ' + truncHash(viewData.address, 6)))
      wrap.appendChild(bc)
    }

    function showLoading () {
      var div = document.createElement('div')
      div.className = 'bx-loading'
      div.textContent = 'Loading\u2026'
      wrap.appendChild(div)
    }

    function showError (msg) {
      var div = document.createElement('div')
      div.className = 'bx-error'
      div.textContent = msg
      wrap.appendChild(div)
    }

    // === HOME ===
    async function loadHome () {
      showLoading()
      try {
        var status = await apiFetch('/status')
        wrap.lastChild.remove() // remove loading

        var synced = status.synced || (status.indexed_height >= status.node_height)
        var statsEl = document.createElement('div')
        statsEl.className = 'bx-stats'
        var stats = [
          { label: 'Block Height', value: formatNumber(status.node_height || status.nodeHeight), accent: true },
          { label: 'Indexed', value: formatNumber(status.indexed_height || status.indexedHeight) },
          { label: 'Transactions', value: formatNumber(status.tx_count || status.txCount) },
          { label: 'UTXOs', value: formatNumber(status.utxo_count || status.utxoCount) }
        ]
        stats.forEach(function (s) {
          var card = document.createElement('div')
          card.className = 'bx-stat'
          var lbl = document.createElement('div')
          lbl.className = 'bx-stat-label'
          lbl.textContent = s.label
          var val = document.createElement('div')
          val.className = 'bx-stat-value' + (s.accent ? ' accent' : '')
          val.textContent = s.value
          card.appendChild(lbl)
          card.appendChild(val)
          statsEl.appendChild(card)
        })
        wrap.appendChild(statsEl)

        // Sync badge
        var badgeDiv = document.createElement('div')
        badgeDiv.style.cssText = 'margin-bottom:16px;'
        var badge = document.createElement('span')
        badge.className = 'bx-badge ' + (synced ? 'synced' : 'syncing')
        badge.textContent = synced ? '\u2713 Synced' : '\u25CB Syncing\u2026'
        badgeDiv.appendChild(badge)
        wrap.appendChild(badgeDiv)

        // Recent blocks
        var title = document.createElement('div')
        title.className = 'bx-section-title'
        title.textContent = 'Recent Blocks'
        wrap.appendChild(title)
        await loadRecentBlocks(status.indexed_height || status.indexedHeight)
      } catch (e) {
        showError('Failed to load status: ' + e.message)
      }
    }

    async function loadRecentBlocks (tipHeight) {
      var table = document.createElement('table')
      table.className = 'bx-table'
      var thead = document.createElement('thead')
      var headRow = document.createElement('tr')
      ;['Height', 'Hash', 'Transactions', 'Time'].forEach(function (h) {
        var th = document.createElement('th')
        th.textContent = h
        headRow.appendChild(th)
      })
      thead.appendChild(headRow)
      table.appendChild(thead)
      var tbody = document.createElement('tbody')

      var loaded = 0
      for (var i = tipHeight; i > Math.max(0, tipHeight - 15); i--) {
        try {
          var block = await apiFetch('/block/' + i)
          var tr = document.createElement('tr')

          var tdH = document.createElement('td')
          var hLink = document.createElement('a')
          hLink.className = 'bx-link'
          hLink.textContent = formatNumber(block.height)
          ;(function (h) { hLink.addEventListener('click', function () { loadBlock(h) }) })(block.height)
          tdH.appendChild(hLink)
          tr.appendChild(tdH)

          var tdHash = document.createElement('td')
          var hashEl = document.createElement('span')
          hashEl.className = 'bx-mono bx-hash'
          hashEl.textContent = block.hash
          hashEl.title = block.hash
          tdHash.appendChild(hashEl)
          tr.appendChild(tdHash)

          var tdTx = document.createElement('td')
          tdTx.textContent = formatNumber(block.tx_count || block.txCount || (block.tx ? block.tx.length : 0))
          tr.appendChild(tdTx)

          var tdTime = document.createElement('td')
          tdTime.textContent = formatTime(block.timestamp || block.time)
          tr.appendChild(tdTime)

          tbody.appendChild(tr)
          loaded++
        } catch (e) { /* skip failed block */ }
      }
      table.appendChild(tbody)
      wrap.appendChild(table)
    }

    // === BLOCK ===
    async function loadBlock (height) {
      view = 'block'
      viewData = { height: height }
      renderView()
      showLoading()
      try {
        var block = await apiFetch('/block/' + height + '?full=true')
        viewData = block
        viewData.height = height
        renderView()
        renderBlockDetail()
      } catch (e) {
        showError('Failed to load block: ' + e.message)
      }
    }

    function renderBlockDetail () {
      if (!viewData || !viewData.hash) return
      var detail = document.createElement('div')
      detail.className = 'bx-detail'

      var header = document.createElement('div')
      header.className = 'bx-detail-header'
      var title = document.createElement('div')
      title.className = 'bx-detail-title'
      title.textContent = 'Block ' + formatNumber(viewData.height)
      header.appendChild(title)
      var hash = document.createElement('div')
      hash.className = 'bx-detail-hash'
      hash.textContent = viewData.hash
      header.appendChild(hash)
      detail.appendChild(header)

      var grid = document.createElement('div')
      grid.className = 'bx-detail-grid'
      var fields = [
        { label: 'Timestamp', value: formatTime(viewData.timestamp || viewData.time) },
        { label: 'Transactions', value: formatNumber(viewData.tx_count || viewData.txCount || (viewData.tx ? viewData.tx.length : 0)) },
        { label: 'Height', value: formatNumber(viewData.height) },
        { label: 'Confirmations', value: formatNumber(viewData.confirmations) },
        { label: 'Algorithm', value: viewData.algo || '\u2014' },
        { label: 'Difficulty', value: viewData.difficulty != null ? viewData.difficulty.toLocaleString() : '\u2014' },
        { label: 'Size', value: viewData.size ? viewData.size + ' B' : '\u2014' },
        { label: 'Previous Hash', value: viewData.previousblockhash || '\u2014' }
      ]
      fields.forEach(function (f) {
        var div = document.createElement('div')
        var lbl = document.createElement('div')
        lbl.className = 'bx-field-label'
        lbl.textContent = f.label
        var val = document.createElement('div')
        val.className = 'bx-field-value'
        val.textContent = f.value
        div.appendChild(lbl)
        div.appendChild(val)
        grid.appendChild(div)
      })
      detail.appendChild(grid)
      wrap.appendChild(detail)

      // Transaction list
      var txIds = viewData.tx || viewData.txids || []
      if (txIds.length) {
        var stitle = document.createElement('div')
        stitle.className = 'bx-section-title'
        stitle.textContent = 'Transactions (' + txIds.length + ')'
        wrap.appendChild(stitle)

        var table = document.createElement('table')
        table.className = 'bx-table'
        var thead = document.createElement('thead')
        var hr = document.createElement('tr')
        var th = document.createElement('th')
        th.textContent = 'TXID'
        hr.appendChild(th)
        thead.appendChild(hr)
        table.appendChild(thead)
        var tbody = document.createElement('tbody')

        txIds.forEach(function (txid) {
          var id = typeof txid === 'string' ? txid : (txid.txid || txid.hash || '')
          var tr = document.createElement('tr')
          var td = document.createElement('td')
          var link = document.createElement('a')
          link.className = 'bx-link bx-mono'
          link.textContent = id
          link.addEventListener('click', function () { loadTx(id) })
          td.appendChild(link)
          tr.appendChild(td)
          tbody.appendChild(tr)
        })
        table.appendChild(tbody)
        wrap.appendChild(table)
      }
    }

    // === TX ===
    async function loadTx (txid) {
      view = 'tx'
      viewData = { txid: txid }
      renderView()
      showLoading()
      try {
        var tx = await apiFetch('/tx/' + txid)
        viewData = tx
        viewData.txid = txid
        renderView()
        renderTxDetail()
      } catch (e) {
        showError('Failed to load transaction: ' + e.message)
      }
    }

    function renderTxDetail () {
      if (!viewData || !viewData.txid) return
      var detail = document.createElement('div')
      detail.className = 'bx-detail'

      var header = document.createElement('div')
      header.className = 'bx-detail-header'
      var title = document.createElement('div')
      title.className = 'bx-detail-title'
      title.textContent = 'Transaction'
      header.appendChild(title)
      var hash = document.createElement('div')
      hash.className = 'bx-detail-hash'
      hash.textContent = viewData.txid
      header.appendChild(hash)
      detail.appendChild(header)

      var grid = document.createElement('div')
      grid.className = 'bx-detail-grid'
      var fields = [
        { label: 'Block Height', value: viewData.height != null ? formatNumber(viewData.height) : (viewData.blockHeight != null ? formatNumber(viewData.blockHeight) : '\u2014') },
        { label: 'Confirmations', value: viewData.confirmations != null ? formatNumber(viewData.confirmations) : '\u2014' },
        { label: 'Size', value: viewData.size ? viewData.size + ' B' : '\u2014' },
        { label: 'Lock Time', value: viewData.locktime != null ? formatNumber(viewData.locktime) : '\u2014' }
      ]
      fields.forEach(function (f) {
        var div = document.createElement('div')
        var lbl = document.createElement('div')
        lbl.className = 'bx-field-label'
        lbl.textContent = f.label
        var val = document.createElement('div')
        val.className = 'bx-field-value'
        val.textContent = f.value
        div.appendChild(lbl)
        div.appendChild(val)
        grid.appendChild(div)
      })
      detail.appendChild(grid)
      wrap.appendChild(detail)

      // Inputs & Outputs
      var inputs = viewData.vin || viewData.inputs || []
      var outputs = viewData.vout || viewData.outputs || []

      if (inputs.length || outputs.length) {
        var io = document.createElement('div')
        io.className = 'bx-io'

        // Inputs
        var inCol = document.createElement('div')
        var inLabel = document.createElement('div')
        inLabel.className = 'bx-io-label'
        inLabel.textContent = 'Inputs (' + inputs.length + ')'
        inCol.appendChild(inLabel)
        inputs.forEach(function (inp) {
          var item = document.createElement('div')
          item.className = 'bx-io-item'
          if (inp.coinbase) {
            var cb = document.createElement('div')
            cb.className = 'bx-io-addr'
            cb.textContent = 'Coinbase'
            cb.style.color = '#22c55e'
            item.appendChild(cb)
          } else {
            var addr = document.createElement('div')
            addr.className = 'bx-io-addr'
            var addrStr = inp.address || inp.addr || (inp.prevout && inp.prevout.scriptpubkey_address) || (inp.scriptPubKey && inp.scriptPubKey.addresses && inp.scriptPubKey.addresses[0]) || 'Unknown'
            addr.textContent = addrStr
            if (addrStr !== 'Unknown') {
              ;(function (a) { addr.addEventListener('click', function () { loadAddress(a) }) })(addrStr)
            }
            item.appendChild(addr)
            var val = inp.value || inp.amount || (inp.prevout && inp.prevout.value)
            if (val != null) {
              var amt = document.createElement('div')
              amt.className = 'bx-io-amount'
              amt.textContent = formatBtm(val) + ' BTM'
              item.appendChild(amt)
            }
          }
          inCol.appendChild(item)
        })
        io.appendChild(inCol)

        var arrow = document.createElement('div')
        arrow.className = 'bx-io-arrow'
        arrow.textContent = '\u2192'
        io.appendChild(arrow)

        // Outputs
        var outCol = document.createElement('div')
        var outLabel = document.createElement('div')
        outLabel.className = 'bx-io-label'
        outLabel.textContent = 'Outputs (' + outputs.length + ')'
        outCol.appendChild(outLabel)
        outputs.forEach(function (out) {
          var item = document.createElement('div')
          item.className = 'bx-io-item'
          var addr = document.createElement('div')
          addr.className = 'bx-io-addr'
          var addrStr = out.address || out.addr || (out.scriptPubKey && out.scriptPubKey.addresses && out.scriptPubKey.addresses[0]) || (out.scriptPubKey && out.scriptPubKey.address) || 'Script'
          addr.textContent = addrStr
          if (addrStr !== 'Script') {
            ;(function (a) { addr.addEventListener('click', function () { loadAddress(a) }) })(addrStr)
          }
          item.appendChild(addr)
          var val = out.value != null ? out.value : out.amount
          if (val != null) {
            var amt = document.createElement('div')
            amt.className = 'bx-io-amount'
            amt.textContent = formatBtm(val) + ' BTM'
            item.appendChild(amt)
          }
          outCol.appendChild(item)
        })
        io.appendChild(outCol)
        wrap.appendChild(io)
      }
    }

    // === ADDRESS ===
    async function loadAddress (addr) {
      view = 'address'
      viewData = { address: addr }
      renderView()
      showLoading()
      try {
        var balance = await apiFetch('/address/' + addr + '/balance')
        var utxos = await apiFetch('/address/' + addr + '/utxos')
        var txs = await apiFetch('/address/' + addr + '/txs')
        viewData = { address: addr, balance: balance, utxos: utxos, txs: txs }
        renderView()
        renderAddrDetail()
      } catch (e) {
        showError('Failed to load address: ' + e.message)
      }
    }

    function renderAddrDetail () {
      if (!viewData || !viewData.address) return
      var detail = document.createElement('div')
      detail.className = 'bx-detail'

      var header = document.createElement('div')
      header.className = 'bx-detail-header'
      var title = document.createElement('div')
      title.className = 'bx-detail-title'
      title.textContent = 'Address'
      header.appendChild(title)
      var hash = document.createElement('div')
      hash.className = 'bx-detail-hash'
      hash.textContent = viewData.address
      header.appendChild(hash)
      detail.appendChild(header)

      var grid = document.createElement('div')
      grid.className = 'bx-detail-grid'
      var bal = viewData.balance
      var balDisplay = typeof bal === 'object' ? (bal.confirmed_btm != null ? bal.confirmed_btm.toFixed(8) : formatBtm(bal.confirmed || 0)) : formatBtm(bal || 0)
      var fields = [
        { label: 'Balance', value: balDisplay + ' BTM' },
        { label: 'UTXOs', value: formatNumber(Array.isArray(viewData.utxos) ? viewData.utxos.length : 0) }
      ]
      fields.forEach(function (f) {
        var div = document.createElement('div')
        var lbl = document.createElement('div')
        lbl.className = 'bx-field-label'
        lbl.textContent = f.label
        var val = document.createElement('div')
        val.className = 'bx-field-value'
        val.textContent = f.value
        div.appendChild(lbl)
        div.appendChild(val)
        grid.appendChild(div)
      })
      detail.appendChild(grid)
      wrap.appendChild(detail)

      // UTXOs
      if (Array.isArray(viewData.utxos) && viewData.utxos.length) {
        var stitle = document.createElement('div')
        stitle.className = 'bx-section-title'
        stitle.textContent = 'UTXOs (' + viewData.utxos.length + ')'
        wrap.appendChild(stitle)

        var table = document.createElement('table')
        table.className = 'bx-utxo-table'
        var thead = document.createElement('thead')
        var hr = document.createElement('tr')
        ;['TXID', 'Index', 'Amount', 'Block'].forEach(function (h) {
          var th = document.createElement('th')
          th.textContent = h
          hr.appendChild(th)
        })
        thead.appendChild(hr)
        table.appendChild(thead)
        var tbody = document.createElement('tbody')
        viewData.utxos.forEach(function (utxo) {
          var tr = document.createElement('tr')

          var tdTx = document.createElement('td')
          var txLink = document.createElement('a')
          txLink.className = 'bx-link bx-mono bx-hash'
          txLink.textContent = utxo.txid
          txLink.title = utxo.txid
          txLink.addEventListener('click', function () { loadTx(utxo.txid) })
          tdTx.appendChild(txLink)
          tr.appendChild(tdTx)

          var tdIdx = document.createElement('td')
          tdIdx.textContent = utxo.vout != null ? utxo.vout : (utxo.outputIndex != null ? utxo.outputIndex : '\u2014')
          tr.appendChild(tdIdx)

          var tdAmt = document.createElement('td')
          tdAmt.className = 'bx-mono'
          tdAmt.textContent = formatBtm(utxo.value || utxo.amount || 0) + ' BTM'
          tr.appendChild(tdAmt)

          var tdBlock = document.createElement('td')
          var bLink = document.createElement('a')
          bLink.className = 'bx-link'
          var blockH = utxo.height != null ? utxo.height : utxo.blockHeight
          bLink.textContent = blockH != null ? formatNumber(blockH) : '\u2014'
          if (blockH != null) {
            ;(function (h) { bLink.addEventListener('click', function () { loadBlock(h) }) })(blockH)
          }
          tdBlock.appendChild(bLink)
          tr.appendChild(tdBlock)

          tbody.appendChild(tr)
        })
        table.appendChild(tbody)
        wrap.appendChild(table)
      }

      // Recent txs
      if (Array.isArray(viewData.txs) && viewData.txs.length) {
        var stitle2 = document.createElement('div')
        stitle2.className = 'bx-section-title'
        stitle2.style.marginTop = '20px'
        stitle2.textContent = 'Recent Transactions (' + viewData.txs.length + ')'
        wrap.appendChild(stitle2)

        var table2 = document.createElement('table')
        table2.className = 'bx-table'
        var thead2 = document.createElement('thead')
        var hr2 = document.createElement('tr')
        ;['TXID', 'Block', 'Confirmations'].forEach(function (h) {
          var th = document.createElement('th')
          th.textContent = h
          hr2.appendChild(th)
        })
        thead2.appendChild(hr2)
        table2.appendChild(thead2)
        var tbody2 = document.createElement('tbody')
        viewData.txs.forEach(function (tx) {
          var id = tx.txid || tx.hash || tx
          var tr = document.createElement('tr')

          var tdId = document.createElement('td')
          var link = document.createElement('a')
          link.className = 'bx-link bx-mono bx-hash'
          link.textContent = typeof id === 'string' ? id : JSON.stringify(id)
          link.addEventListener('click', function () { loadTx(typeof id === 'string' ? id : id.txid) })
          tdId.appendChild(link)
          tr.appendChild(tdId)

          var tdBlock = document.createElement('td')
          tdBlock.textContent = tx.blockHeight != null ? formatNumber(tx.blockHeight) : '\u2014'
          tr.appendChild(tdBlock)

          var tdConf = document.createElement('td')
          tdConf.textContent = tx.confirmations != null ? formatNumber(tx.confirmations) : '\u2014'
          tr.appendChild(tdConf)

          tbody2.appendChild(tr)
        })
        table2.appendChild(tbody2)
        wrap.appendChild(table2)
      }
    }

    // Initial load
    renderView()
  }
}
