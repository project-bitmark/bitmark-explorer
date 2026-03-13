export default {
  label: 'Source',
  icon: '\uD83D\uDCC4',

  canHandle (subject, store) {
    return true
  },

  render (subject, store, container) {
    var node = store.get(subject.value)
    var pre = document.createElement('pre')
    pre.style.cssText = 'padding:24px 32px;font-size:0.85em;line-height:1.6;color:rgba(255,255,255,0.8);white-space:pre-wrap;word-break:break-word;margin:0'
    pre.textContent = JSON.stringify(node, null, 2)
    container.appendChild(pre)
    var dataEl = document.querySelector('script[type="application/ld+json"]')
    var src = dataEl ? dataEl.getAttribute('src') : null
    if (src) {
      var link = document.createElement('a')
      link.href = new URL(src, window.location.href).href
      link.target = '_blank'
      link.textContent = link.href
      link.style.cssText = 'display:block;padding:0 32px 16px;font-size:0.85em;color:#a78bfa;text-decoration:none;'
      link.addEventListener('mouseover', function () { link.style.textDecoration = 'underline' })
      link.addEventListener('mouseout', function () { link.style.textDecoration = 'none' })
      container.appendChild(link)
    }
  }
}
