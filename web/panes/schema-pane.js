export default {
  label: 'Form',
  icon: '\uD83D\uDCDD',

  canHandle (subject, store) {
    return store.get(subject.value) !== null
  },

  render (subject, store, container) {
    var style = document.createElement('style')
    style.textContent = [
      '.schema-wrap { padding:24px 32px; max-width:700px; }',
      '.schema-title { font-size:1.4em; font-weight:700; color:rgba(255,255,255,0.9); margin-bottom:4px; }',
      '.schema-desc { font-size:0.85em; color:rgba(255,255,255,0.4); margin-bottom:20px; }',
      '.schema-section { font-size:0.95em; font-weight:600; color:rgba(255,255,255,0.7); margin:20px 0 10px; padding-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.08); }',
      '.schema-row { margin-bottom:14px; }',
      '.schema-label { display:flex; align-items:center; gap:6px; font-size:0.8em; font-weight:600; color:rgba(255,255,255,0.5); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:5px; }',
      '.schema-required { color:#f87171; font-size:0.9em; }',
      '.schema-type { font-weight:400; color:rgba(255,255,255,0.25); text-transform:lowercase; letter-spacing:0; }',
      '.schema-input { width:100%; padding:10px 14px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:8px; color:rgba(255,255,255,0.9); font:0.9em -apple-system,sans-serif; outline:none; resize:vertical; }',
      '.schema-input:focus { border-color:rgba(124,58,237,0.4); }',
      '.schema-input::placeholder { color:rgba(255,255,255,0.2); }',
      '.schema-input.invalid { border-color:#f87171; }',
      '.schema-select { width:100%; padding:10px 14px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:8px; color:rgba(255,255,255,0.9); font:0.9em -apple-system,sans-serif; outline:none; appearance:auto; }',
      '.schema-select:focus { border-color:rgba(124,58,237,0.4); }',
      '.schema-checkbox-row { display:flex; align-items:center; gap:8px; }',
      '.schema-error { font-size:0.75em; color:#f87171; margin-top:3px; }',
      '.schema-array-items { margin-left:0; }',
      '.schema-array-item { display:flex; align-items:center; gap:8px; margin-bottom:6px; }',
      '.schema-array-item .schema-input { flex:1; }',
      '.schema-array-remove { background:none; border:none; color:rgba(255,255,255,0.2); font-size:1.2em; cursor:pointer; padding:4px 8px; border-radius:6px; }',
      '.schema-array-remove:hover { color:#ef4444; background:rgba(239,68,68,0.1); }',
      '.schema-array-add { background:none; border:1px dashed rgba(255,255,255,0.1); border-radius:8px; padding:8px 14px; color:rgba(255,255,255,0.3); font:0.85em -apple-system,sans-serif; cursor:pointer; width:100%; text-align:center; }',
      '.schema-array-add:hover { border-color:rgba(124,58,237,0.3); color:rgba(255,255,255,0.5); }',
      '.schema-actions { display:flex; align-items:center; gap:12px; margin-top:20px; padding-top:16px; border-top:1px solid rgba(255,255,255,0.06); }',
      '.schema-save { padding:10px 24px; background:#7c3aed; border:none; border-radius:8px; color:#fff; font:600 0.9em -apple-system,sans-serif; cursor:pointer; }',
      '.schema-save:hover { background:#6d28d9; }',
      '.schema-save:disabled { opacity:0.5; cursor:not-allowed; }',
      '.schema-status { font-size:0.85em; color:rgba(255,255,255,0.4); }',
      '.schema-errors-summary { background:rgba(248,113,113,0.1); border:1px solid rgba(248,113,113,0.2); border-radius:8px; padding:10px 14px; margin-bottom:16px; font-size:0.85em; color:#f87171; }',
      '.schema-none { color:rgba(255,255,255,0.3); font-size:0.9em; padding:20px 0; }'
    ].join('\n')
    container.appendChild(style)

    var wrap = document.createElement('div')
    wrap.className = 'schema-wrap'
    container.appendChild(wrap)

    // --- Load schema ---
    var dataEl = document.querySelector('script[type="application/ld+json"]')
    var data = dataEl ? JSON.parse(dataEl.textContent) : {}
    var schemaUrl = data['$schema']

    if (!schemaUrl) {
      // Auto-generate schema from data
      var schema = generateSchema(data)
      buildForm(schema, data, wrap)
      return
    }

    var loading = document.createElement('div')
    loading.className = 'schema-none'
    loading.textContent = 'Loading schema...'
    wrap.appendChild(loading)

    fetch(schemaUrl).then(function (res) { return res.json() }).then(function (schema) {
      wrap.removeChild(loading)
      buildForm(schema, data, wrap)
    }).catch(function (err) {
      loading.textContent = 'Failed to load schema: ' + err.message
    })

    function generateSchema (obj) {
      var props = {}
      for (var key in obj) {
        if (key === '@context' || key === '$schema') continue
        var val = obj[key]
        if (Array.isArray(val)) {
          props[key] = { type: 'array', items: { type: 'object' } }
        } else if (typeof val === 'object' && val !== null) {
          props[key] = { type: 'object', properties: {} }
          for (var k in val) {
            props[key].properties[k] = { type: typeof val[k] }
          }
        } else if (typeof val === 'boolean') {
          props[key] = { type: 'boolean' }
        } else if (typeof val === 'number') {
          props[key] = { type: 'number' }
        } else {
          props[key] = { type: 'string' }
        }
      }
      return {
        title: 'Properties',
        type: 'object',
        properties: props
      }
    }

    function buildForm (schema, data, parent) {
      // Title
      var title = document.createElement('h2')
      title.className = 'schema-title'
      title.textContent = schema.title || 'Form'
      parent.appendChild(title)

      if (schema.description) {
        var desc = document.createElement('p')
        desc.className = 'schema-desc'
        desc.textContent = schema.description
        parent.appendChild(desc)
      }

      // Errors summary
      var errorsSummary = document.createElement('div')
      errorsSummary.className = 'schema-errors-summary'
      errorsSummary.style.display = 'none'
      parent.appendChild(errorsSummary)

      var fieldEls = {}
      var errorEls = {}
      var properties = schema.properties || {}
      var required = schema.required || []

      // Build fields
      for (var key in properties) {
        var prop = properties[key]
        var value = data[key]
        var isRequired = required.indexOf(key) !== -1

        if (prop.type === 'array') {
          buildArrayField(key, prop, value, isRequired, parent, fieldEls, errorEls)
        } else if (prop.type === 'object') {
          buildObjectField(key, prop, value, isRequired, parent, fieldEls, errorEls)
        } else {
          buildSimpleField(key, prop, value, isRequired, parent, fieldEls, errorEls)
        }
      }

      // Actions
      var actions = document.createElement('div')
      actions.className = 'schema-actions'
      var saveBtn = document.createElement('button')
      saveBtn.className = 'schema-save'
      saveBtn.textContent = 'Save'
      var statusEl = document.createElement('span')
      statusEl.className = 'schema-status'
      actions.appendChild(saveBtn)
      actions.appendChild(statusEl)
      parent.appendChild(actions)

      saveBtn.addEventListener('click', async function () {
        // Validate
        var errors = validate(schema, fieldEls)
        showErrors(errors, errorEls, errorsSummary)
        if (errors.length > 0) return

        // Collect values
        var newData = collectValues(data, properties, fieldEls)

        // Save
        var el = document.querySelector('script[type="application/ld+json"]')
        if (el) el.textContent = JSON.stringify(newData, null, 2)

        statusEl.textContent = 'Saving...'
        try {
          var dataUrl = new URL(el.getAttribute('src'), window.location.href).href
          var opts = { method: 'PUT', headers: { 'Content-Type': 'application/ld+json' }, body: JSON.stringify(newData, null, 2) }
          if (window.xlogin && window.xlogin.authFetch) {
            await window.xlogin.authFetch(dataUrl, opts)
          } else {
            await fetch(dataUrl, opts)
          }
          statusEl.textContent = 'Saved'
        } catch (e) {
          statusEl.textContent = 'Save failed'
        }
        setTimeout(function () { statusEl.textContent = '' }, 2000)
      })
    }

    function buildSimpleField (key, prop, value, isRequired, parent, fieldEls, errorEls) {
      var row = document.createElement('div')
      row.className = 'schema-row'

      var label = document.createElement('div')
      label.className = 'schema-label'
      var labelText = document.createElement('span')
      labelText.textContent = prop.title || formatLabel(key)
      label.appendChild(labelText)
      if (isRequired) {
        var req = document.createElement('span')
        req.className = 'schema-required'
        req.textContent = '*'
        label.appendChild(req)
      }
      var typeHint = document.createElement('span')
      typeHint.className = 'schema-type'
      typeHint.textContent = prop.type || 'string'
      label.appendChild(typeHint)
      row.appendChild(label)

      var input
      if (prop.enum) {
        input = document.createElement('select')
        input.className = 'schema-select'
        var emptyOpt = document.createElement('option')
        emptyOpt.value = ''
        emptyOpt.textContent = '— select —'
        input.appendChild(emptyOpt)
        prop.enum.forEach(function (opt) {
          var o = document.createElement('option')
          o.value = opt
          o.textContent = opt
          if (value === opt) o.selected = true
          input.appendChild(o)
        })
      } else if (prop.type === 'boolean') {
        var checkRow = document.createElement('div')
        checkRow.className = 'schema-checkbox-row'
        input = document.createElement('input')
        input.type = 'checkbox'
        input.checked = !!value
        var checkLabel = document.createElement('span')
        checkLabel.textContent = prop.description || key
        checkLabel.style.cssText = 'font-size:0.9em;color:rgba(255,255,255,0.7);'
        checkRow.appendChild(input)
        checkRow.appendChild(checkLabel)
        row.appendChild(checkRow)
        fieldEls[key] = { el: input, type: 'boolean' }
        var errEl = document.createElement('div')
        errEl.className = 'schema-error'
        row.appendChild(errEl)
        errorEls[key] = errEl
        parent.appendChild(row)
        return
      } else if (prop.format === 'textarea' || (typeof value === 'string' && value.length > 80)) {
        input = document.createElement('textarea')
        input.className = 'schema-input'
        input.rows = 3
        input.value = value !== undefined && value !== null ? String(value) : ''
      } else {
        input = document.createElement('input')
        input.className = 'schema-input'
        input.type = prop.format === 'date' ? 'date' : prop.type === 'number' ? 'number' : 'text'
        input.value = value !== undefined && value !== null ? String(value) : ''
      }

      if (prop.placeholder) input.placeholder = prop.placeholder
      if (prop.description && !prop.enum) input.placeholder = prop.description
      row.appendChild(input)

      fieldEls[key] = { el: input, type: prop.type || 'string' }

      var errEl = document.createElement('div')
      errEl.className = 'schema-error'
      row.appendChild(errEl)
      errorEls[key] = errEl

      parent.appendChild(row)
    }

    function buildArrayField (key, prop, value, isRequired, parent, fieldEls, errorEls) {
      var section = document.createElement('div')
      section.className = 'schema-section'
      section.textContent = prop.title || formatLabel(key)
      parent.appendChild(section)

      var listWrap = document.createElement('div')
      listWrap.className = 'schema-array-items'
      parent.appendChild(listWrap)

      var arr = Array.isArray(value) ? value : []
      var itemSchema = prop.items || {}
      var hasSubProps = itemSchema.type === 'object' && itemSchema.properties

      function renderArrayItems () {
        listWrap.innerHTML = ''

        arr.forEach(function (item, idx) {
          if (hasSubProps) {
            // Structured sub-form for each item
            var card = document.createElement('div')
            card.style.cssText = 'background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:14px 16px;margin-bottom:8px;position:relative;'

            var itemFields = {}
            var itemObj = (typeof item === 'object' && item !== null) ? item : {}
            var subProps = itemSchema.properties
            var subRequired = itemSchema.required || []

            for (var subKey in subProps) {
              var subProp = subProps[subKey]
              var subVal = itemObj[subKey]
              var subRow = document.createElement('div')
              subRow.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:6px;'

              var subLabel = document.createElement('span')
              subLabel.style.cssText = 'width:80px;flex-shrink:0;font-size:0.75em;font-weight:600;color:rgba(255,255,255,0.4);text-transform:uppercase;'
              subLabel.textContent = subProp.title || formatLabel(subKey)
              subRow.appendChild(subLabel)

              var subInput
              if (subProp.enum) {
                subInput = document.createElement('select')
                subInput.className = 'schema-select'
                subInput.style.cssText += 'padding:7px 10px;font-size:0.85em;'
                var emptyOpt = document.createElement('option')
                emptyOpt.value = ''
                emptyOpt.textContent = '— none —'
                subInput.appendChild(emptyOpt)
                subProp.enum.forEach(function (opt) {
                  if (opt === '') return
                  var o = document.createElement('option')
                  o.value = opt
                  o.textContent = opt
                  if (subVal === opt) o.selected = true
                  subInput.appendChild(o)
                })
              } else {
                subInput = document.createElement('input')
                subInput.className = 'schema-input'
                subInput.style.cssText += 'padding:7px 10px;font-size:0.85em;'
                subInput.type = subProp.type === 'number' ? 'number' : 'text'
                subInput.value = subVal !== undefined && subVal !== null ? String(subVal) : ''
                if (subProp.placeholder) subInput.placeholder = subProp.placeholder
              }

              ;(function (k, inp, tp) {
                inp.addEventListener('change', function () {
                  if (typeof arr[idx] !== 'object' || arr[idx] === null) arr[idx] = {}
                  var v = inp.tagName === 'SELECT' ? inp.value : inp.value
                  if (tp === 'number') {
                    var n = parseFloat(v)
                    arr[idx][k] = isNaN(n) ? v : n
                  } else {
                    if (v === '') { delete arr[idx][k] } else { arr[idx][k] = v }
                  }
                })
              })(subKey, subInput, subProp.type)

              subRow.appendChild(subInput)
              card.appendChild(subRow)
              itemFields[subKey] = subInput
            }

            var removeBtn = document.createElement('button')
            removeBtn.className = 'schema-array-remove'
            removeBtn.style.cssText += 'position:absolute;top:10px;right:10px;color:rgba(255,255,255,0.15);'
            removeBtn.textContent = '\u00d7'
            removeBtn.addEventListener('click', (function (i) {
              return function () { arr.splice(i, 1); renderArrayItems() }
            })(idx))
            card.appendChild(removeBtn)

            listWrap.appendChild(card)
          } else {
            // Simple text input for non-object items
            var row = document.createElement('div')
            row.className = 'schema-array-item'
            var input = document.createElement('input')
            input.className = 'schema-input'
            input.value = typeof item === 'object' ? JSON.stringify(item) : String(item)
            input.addEventListener('change', (function (i) {
              return function () {
                try { arr[i] = JSON.parse(input.value) } catch (e) { arr[i] = input.value }
              }
            })(idx))
            row.appendChild(input)
            var removeBtn = document.createElement('button')
            removeBtn.className = 'schema-array-remove'
            removeBtn.textContent = '\u00d7'
            removeBtn.addEventListener('click', (function (i) {
              return function () { arr.splice(i, 1); renderArrayItems() }
            })(idx))
            row.appendChild(removeBtn)
            listWrap.appendChild(row)
          }
        })
      }

      renderArrayItems()

      var addBtn = document.createElement('button')
      addBtn.className = 'schema-array-add'
      addBtn.textContent = '+ Add item'
      addBtn.addEventListener('click', function () {
        if (hasSubProps) {
          var newItem = {}
          for (var k in itemSchema.properties) {
            if (itemSchema.properties[k].type === 'number') newItem[k] = 0
            else newItem[k] = ''
          }
          arr.push(newItem)
        } else {
          arr.push('')
        }
        renderArrayItems()
      })
      parent.appendChild(addBtn)

      fieldEls[key] = { el: null, type: 'array', getArray: function () { return arr } }

      var errEl = document.createElement('div')
      errEl.className = 'schema-error'
      parent.appendChild(errEl)
      errorEls[key] = errEl
    }

    function buildObjectField (key, prop, value, isRequired, parent, fieldEls, errorEls) {
      var section = document.createElement('div')
      section.className = 'schema-section'
      section.textContent = prop.title || formatLabel(key)
      parent.appendChild(section)

      var subFields = {}
      var subErrors = {}
      var objVal = (typeof value === 'object' && value !== null) ? value : {}
      var subProps = prop.properties || {}

      for (var subKey in subProps) {
        buildSimpleField(subKey, subProps[subKey], objVal[subKey], false, parent, subFields, subErrors)
      }

      fieldEls[key] = { el: null, type: 'object', subFields: subFields }
      errorEls[key] = null
    }

    function validate (schema, fieldEls) {
      var errors = []
      var required = schema.required || []
      var properties = schema.properties || {}

      for (var key in properties) {
        var prop = properties[key]
        var field = fieldEls[key]
        if (!field) continue

        var val = getFieldValue(field)

        if (required.indexOf(key) !== -1) {
          if (val === '' || val === undefined || val === null) {
            errors.push({ key: key, message: (prop.title || formatLabel(key)) + ' is required' })
            continue
          }
        }

        if (val === '' || val === undefined) continue

        if (prop.minLength && typeof val === 'string' && val.length < prop.minLength) {
          errors.push({ key: key, message: 'Minimum ' + prop.minLength + ' characters' })
        }
        if (prop.maxLength && typeof val === 'string' && val.length > prop.maxLength) {
          errors.push({ key: key, message: 'Maximum ' + prop.maxLength + ' characters' })
        }
        if (prop.minimum !== undefined && typeof val === 'number' && val < prop.minimum) {
          errors.push({ key: key, message: 'Minimum value is ' + prop.minimum })
        }
        if (prop.maximum !== undefined && typeof val === 'number' && val > prop.maximum) {
          errors.push({ key: key, message: 'Maximum value is ' + prop.maximum })
        }
        if (prop.pattern && typeof val === 'string' && !new RegExp(prop.pattern).test(val)) {
          errors.push({ key: key, message: 'Invalid format' })
        }
        // Validate array items
        if (prop.type === 'array' && Array.isArray(val) && prop.items) {
          var itemSchema = prop.items
          val.forEach(function (item, idx) {
            if (itemSchema.type === 'object' && typeof item !== 'object') {
              errors.push({ key: key, message: 'Item ' + (idx + 1) + ' must be an object' })
            }
            if (itemSchema.type === 'object' && itemSchema.required && typeof item === 'object') {
              itemSchema.required.forEach(function (reqKey) {
                if (!item[reqKey] || item[reqKey] === '') {
                  errors.push({ key: key, message: 'Item ' + (idx + 1) + ': ' + (itemSchema.properties && itemSchema.properties[reqKey] && itemSchema.properties[reqKey].title || reqKey) + ' is required' })
                }
              })
            }
            if (itemSchema.properties && typeof item === 'object') {
              for (var ik in itemSchema.properties) {
                var iProp = itemSchema.properties[ik]
                var iVal = item[ik]
                if (iProp.minLength && typeof iVal === 'string' && iVal.length < iProp.minLength) {
                  errors.push({ key: key, message: 'Item ' + (idx + 1) + ': ' + (iProp.title || ik) + ' min ' + iProp.minLength + ' chars' })
                }
              }
            }
          })
        }
      }

      return errors
    }

    function showErrors (errors, errorEls, summary) {
      // Clear
      for (var key in errorEls) {
        if (errorEls[key]) {
          errorEls[key].textContent = ''
          var input = document.querySelector('.schema-input.invalid')
          if (input) input.classList.remove('invalid')
        }
      }

      if (errors.length === 0) {
        summary.style.display = 'none'
        return
      }

      summary.style.display = 'block'
      summary.textContent = errors.length + ' validation error' + (errors.length > 1 ? 's' : '')

      errors.forEach(function (err) {
        if (errorEls[err.key]) {
          errorEls[err.key].textContent = err.message
        }
      })
    }

    function getFieldValue (field) {
      if (field.type === 'boolean') return field.el.checked
      if (field.type === 'array') return field.getArray()
      if (field.type === 'object') {
        var obj = {}
        for (var k in field.subFields) {
          obj[k] = getFieldValue(field.subFields[k])
        }
        return obj
      }
      if (field.type === 'number') {
        var n = parseFloat(field.el.value)
        return isNaN(n) ? field.el.value : n
      }
      return field.el.value
    }

    function collectValues (originalData, properties, fieldEls) {
      var newData = {}
      for (var key in originalData) {
        newData[key] = originalData[key]
      }
      for (var key in properties) {
        var field = fieldEls[key]
        if (!field) continue
        var val = getFieldValue(field)
        if (val !== '' && val !== undefined) {
          newData[key] = val
        }
      }
      return newData
    }

    function formatLabel (key) {
      return key.replace(/^(schema:|@)/, '').replace(/([A-Z])/g, ' $1').replace(/^./, function (s) { return s.toUpperCase() })
    }
  }
}
