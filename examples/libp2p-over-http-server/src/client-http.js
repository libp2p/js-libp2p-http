/* eslint-disable no-console */

import { WELL_KNOWN_PROTOCOLS_PATH } from '@libp2p/http'
import { HTTP_PING_PROTOCOL } from '@libp2p/http-ping'
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

// first let's invoke the libp2p endpoint without using libp2p

// 1. get the map of supported protocol id -> path
const wellKnownResponse = await fetch(new URL(`${uri}${WELL_KNOWN_PROTOCOLS_PATH}`))
const protocols = await wellKnownResponse.json()

// 2. make a request to the protocol handler
const result = await fetch(new URL(`${uri}${protocols[HTTP_TEST_PROTOCOL]?.path}`))
console.info('GET', result.url, result.status, result.statusText)
console.info(await result.text())

// 3. let's use the ping protocol
const start = Date.now()
const body = Uint8Array.from(new Array(32).fill(0))
const pong = await fetch(new URL(`${uri}${protocols[HTTP_PING_PROTOCOL]?.path}`), {
  method: 'POST',
  body
})
console.info('GET', pong.url, pong.status, pong.statusText)
const buf = await pong.arrayBuffer()

// check that we read all of the data
if (buf.byteLength !== body.byteLength) {
  throw new Error('Short read')
}

console.info('Ping took', Date.now() - start, 'ms')
