function labelFromUri(uri) {
  if (!uri) return ''
  var hash = uri.lastIndexOf('#')
  if (hash !== -1) return uri.slice(hash + 1)
  var slash = uri.lastIndexOf('/')
  if (slash !== -1) return uri.slice(slash + 1)
  return uri
}

export default {
  label: 'Outline',
  icon: '\uD83D\uDD0D',

  canHandle(subject, store) {
    var stmts = store.statementsMatching(subject, undefined, undefined)
    return stmts.length > 0
  },

  render(subject, store, container) {
    var stmts = store.statementsMatching(subject, undefined, undefined)

    // Group by predicate
    var groups = new Map()
    for (var st of stmts) {
      var pred = st.predicate.value
      if (!groups.has(pred)) {
        groups.set(pred, { predicate: pred, label: labelFromUri(pred), objects: [] })
      }
      groups.get(pred).objects.push(st.object)
    }

    var sorted = [...groups.values()].sort(function (a, b) {
      if (a.predicate.includes('rdf-syntax-ns#type')) return -1
      if (b.predicate.includes('rdf-syntax-ns#type')) return 1
      return a.label.localeCompare(b.label)
    })

    // Find label for subject
    var nameKeys = ['name', 'title', 'label']
    var subjectLabel = labelFromUri(subject.value)
    for (var st of stmts) {
      if (nameKeys.some(function (k) { return st.predicate.value.toLowerCase().includes(k) }) &&
          st.predicate.value !== 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
        subjectLabel = st.object.value
        break
      }
    }

    var root = document.createElement('div')

    var style = document.createElement('style')
    style.textContent = [
      '.ol-view { padding: 24px 32px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }',
      '.ol-title { font-size: 1.4em; font-weight: 700; color: rgba(255,255,255,0.9); margin: 0 0 4px; }',
      '.ol-uri { margin: 0 0 6px; }',
      '.ol-uri code { font-size: 0.8em; color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 4px; }',
      '.ol-count { color: rgba(255,255,255,0.45); font-size: 0.85em; margin: 0 0 16px; }',
      '.ol-table { width: 100%; border-collapse: collapse; }',
      '.ol-table th { text-align: left; padding: 8px 12px; font-size: 0.8em; font-weight: 600; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.1); }',
      '.ol-table td { padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); vertical-align: top; font-size: 0.9em; }',
      '.ol-pred { color: rgba(255,255,255,0.7); }',
      '.ol-pred a { color: rgba(255,255,255,0.7); text-decoration: none; }',
      '.ol-pred a:hover { text-decoration: underline; color: rgba(255,255,255,0.9); }',
      '.ol-val { color: rgba(255,255,255,0.85); }',
      '.ol-link { color: #a78bfa; text-decoration: none; }',
      '.ol-link:hover { text-decoration: underline; }',
      '.ol-empty { color: rgba(255,255,255,0.35); font-size: 0.95em; }'
    ].join('\n')
    root.appendChild(style)

    var view = document.createElement('div')
    view.className = 'ol-view'

    var h2 = document.createElement('h2')
    h2.className = 'ol-title'
    h2.textContent = subjectLabel
    view.appendChild(h2)

    var uriP = document.createElement('p')
    uriP.className = 'ol-uri'
    var code = document.createElement('code')
    code.textContent = subject.value
    uriP.appendChild(code)
    view.appendChild(uriP)

    if (sorted.length === 0) {
      var empty = document.createElement('p')
      empty.className = 'ol-empty'
      empty.textContent = 'No triples found for this resource.'
      view.appendChild(empty)
      root.appendChild(view)
      container.appendChild(root)
      return
    }

    var total = sorted.reduce(function (s, g) { return s + g.objects.length }, 0)
    var countP = document.createElement('p')
    countP.className = 'ol-count'
    countP.textContent = total + ' triple' + (total !== 1 ? 's' : '') + ' across ' + sorted.length + ' predicate' + (sorted.length !== 1 ? 's' : '')
    view.appendChild(countP)

    var table = document.createElement('table')
    table.className = 'ol-table'

    var thead = document.createElement('thead')
    var headerRow = document.createElement('tr')
    var th1 = document.createElement('th')
    th1.textContent = 'Property'
    var th2 = document.createElement('th')
    th2.textContent = 'Value'
    headerRow.appendChild(th1)
    headerRow.appendChild(th2)
    thead.appendChild(headerRow)
    table.appendChild(thead)

    var tbody = document.createElement('tbody')
    for (var group of sorted) {
      for (var i = 0; i < group.objects.length; i++) {
        var row = document.createElement('tr')

        if (i === 0) {
          var predTd = document.createElement('td')
          predTd.className = 'ol-pred'
          if (group.objects.length > 1) predTd.rowSpan = group.objects.length
          var a = document.createElement('a')
          a.href = group.predicate
          a.textContent = group.label
          a.title = group.predicate
          a.target = '_blank'
          a.rel = 'noopener'
          predTd.appendChild(a)
          row.appendChild(predTd)
        }

        var valTd = document.createElement('td')
        valTd.className = 'ol-val'
        var obj = group.objects[i]
        if (obj.termType === 'NamedNode') {
          var link = document.createElement('a')
          link.className = 'ol-link'
          link.href = obj.value
          link.textContent = labelFromUri(obj.value)
          link.title = obj.value
          valTd.appendChild(link)
        } else {
          valTd.textContent = obj.value
        }
        row.appendChild(valTd)
        tbody.appendChild(row)
      }
    }

    table.appendChild(tbody)
    view.appendChild(table)
    root.appendChild(view)
    container.appendChild(root)
  }
}
