/**
 * Bitmarkd JSON-RPC Client
 */

import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

export class BitmarkRPC {
  constructor (options = {}) {
    this.host = options.host || process.env.RPC_HOST || '127.0.0.1'
    this.port = options.port || process.env.RPC_PORT || 9266
    this.user = options.user || process.env.RPC_USER || ''
    this.password = options.password || process.env.RPC_PASS || ''

    if (!this.user || !this.password) this.loadConfig()
  }

  loadConfig () {
    try {
      var content = readFileSync(join(homedir(), '.bitmark', 'bitmark.conf'), 'utf-8')
      for (var line of content.split('\n')) {
        var [key, value] = line.split('=').map(s => s.trim())
        if (key === 'rpcuser') this.user = value
        if (key === 'rpcpassword') this.password = value
        if (key === 'rpcport') this.port = parseInt(value)
      }
    } catch (e) { /* no config */ }
  }

  async call (method, params = []) {
    var auth = Buffer.from(this.user + ':' + this.password).toString('base64')
    var res = await fetch('http://' + this.host + ':' + this.port + '/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + auth },
      body: JSON.stringify({ jsonrpc: '1.0', id: Date.now(), method, params })
    })
    var data = await res.json()
    if (data.error) throw new Error('RPC Error ' + data.error.code + ': ' + data.error.message)
    return data.result
  }

  getBlockCount () { return this.call('getblockcount') }
  getBlockHash (height) { return this.call('getblockhash', [height]) }
  getBlock (hash, verbose) { return this.call('getblock', [hash, verbose !== false]) }
  getRawTransaction (txid, verbose) { return this.call('getrawtransaction', [txid, verbose !== false ? 1 : 0]) }
  sendRawTransaction (hex) { return this.call('sendrawtransaction', [hex, true]) }
  decodeRawTransaction (hex) { return this.call('decoderawtransaction', [hex]) }
  getInfo () { return this.call('getinfo') }
}
