export default {
  label: 'Properties',
  icon: '\uD83D\uDCCB',

  canHandle (subject, store) {
    return store.get(subject.value) !== null
  },

  render (subject, store, container) {
    var node = store.get(subject.value)

    var style = document.createElement('style')
    style.textContent = [
      '.props-wrap { padding:24px 32px; max-width:700px; }',
      '.props-title { font-size:1.4em; font-weight:700; color:rgba(255,255,255,0.9); margin-bottom:20px; }',
      '.props-row { display:flex; align-items:flex-start; gap:16px; margin-bottom:12px; }',
      '.props-label { width:140px; flex-shrink:0; font-size:0.8em; font-weight:600; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:0.5px; padding-top:10px; }',
      '.props-input { flex:1; padding:10px 14px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:8px; color:rgba(255,255,255,0.9); font:0.9em -apple-system,sans-serif; outline:none; resize:vertical; }',
      '.props-input:focus { border-color:rgba(124,58,237,0.4); }',
      '.props-input::placeholder { color:rgba(255,255,255,0.25); }',
      '.props-save { margin-top:16px; padding:10px 24px; background:#7c3aed; border:none; border-radius:8px; color:#fff; font:600 0.9em -apple-system,sans-serif; cursor:pointer; }',
      '.props-save:hover { background:#6d28d9; }',
      '.props-status { display:inline-block; margin-left:12px; font-size:0.85em; color:rgba(255,255,255,0.4); }'
    ].join('\n')
    container.appendChild(style)

    var wrap = document.createElement('div')
    wrap.className = 'props-wrap'
    container.appendChild(wrap)

    var title = document.createElement('h2')
    title.className = 'props-title'
    title.textContent = 'Properties'
    wrap.appendChild(title)

    var fields = [
      { key: 'schema:name', label: 'Name', type: 'text', placeholder: 'List name' },
      { key: 'schema:description', label: 'Description', type: 'textarea', placeholder: 'Description' },
      { key: '@type', label: 'Type', type: 'text', placeholder: 'schema:ItemList' },
      { key: '@id', label: 'ID', type: 'text', placeholder: '#this' }
    ]

    var inputs = {}

    function getData () {
      var el = document.querySelector('script[type="application/ld+json"]')
      return el ? JSON.parse(el.textContent) : null
    }

    function setData (data) {
      var el = document.querySelector('script[type="application/ld+json"]')
      if (el) el.textContent = JSON.stringify(data, null, 2)
    }

    fields.forEach(function (field) {
      var row = document.createElement('div')
      row.className = 'props-row'

      var label = document.createElement('div')
      label.className = 'props-label'
      label.textContent = field.label
      row.appendChild(label)

      var input
      if (field.type === 'textarea') {
        input = document.createElement('textarea')
        input.rows = 3
      } else {
        input = document.createElement('input')
        input.type = 'text'
      }
      input.className = 'props-input'
      input.placeholder = field.placeholder

      var data = getData()
      if (data) input.value = data[field.key] || ''

      inputs[field.key] = input
      row.appendChild(input)
      wrap.appendChild(row)
    })

    var btnRow = document.createElement('div')
    var saveBtn = document.createElement('button')
    saveBtn.className = 'props-save'
    saveBtn.textContent = 'Save'
    var status = document.createElement('span')
    status.className = 'props-status'
    btnRow.appendChild(saveBtn)
    btnRow.appendChild(status)
    wrap.appendChild(btnRow)

    saveBtn.addEventListener('click', async function () {
      var data = getData()
      if (!data) return

      fields.forEach(function (field) {
        var val = inputs[field.key].value.trim()
        if (val) {
          data[field.key] = val
        }
      })

      setData(data)
      status.textContent = 'Saving...'

      try {
        var dataEl = document.querySelector('script[type="application/ld+json"]')
        var dataUrl = new URL(dataEl.getAttribute('src'), window.location.href).href
        var json = JSON.stringify(data, null, 2)
        var opts = { method: 'PUT', headers: { 'Content-Type': 'application/ld+json' }, body: json }
        if (window.xlogin && window.xlogin.authFetch) {
          await window.xlogin.authFetch(dataUrl, opts)
        } else {
          await fetch(dataUrl, opts)
        }
        status.textContent = 'Saved'
      } catch (e) {
        status.textContent = 'Save failed'
        console.warn('Save error:', e)
      }
      setTimeout(function () { status.textContent = '' }, 2000)
    })
  }
}
