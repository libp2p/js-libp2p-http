/* eslint-disable no-console */

import { http } from '@libp2p/http'
import { pingHTTP } from '@libp2p/http-ping'
import { createLibp2p } from 'libp2p'
import { HTTP_TEST_PROTOCOL } from './common.js'

// Take the first argument as the path of the folder to add
const args = process.argv.slice(2)

// Example of how to use arguments
if (args.length === 0) {
  console.error('No argument provided')
  console.error('Usage: node client.js <serverAddress>')
}

// the HTTP address of the server
const uri = args[0]

// our client node
const node = await createLibp2p({
  services: {
    http: http(),
    pingHTTP: pingHTTP()
  }
})

// make a HTTP request over libp2p
const res = await node.services.http.fetchProtocol(uri, HTTP_TEST_PROTOCOL)
console.info('GET', uri, res.status, res.statusText)
console.info(await res.text())

// make a ping request over libp2p
const pong = await node.services.pingHTTP.ping(uri)
console.info('Ping took', pong, 'ms')
