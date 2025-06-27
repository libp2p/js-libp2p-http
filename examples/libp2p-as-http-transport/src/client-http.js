/* eslint-disable no-console */

import { request } from 'node:http'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { http } from '@libp2p/http'
import { tcp } from '@libp2p/tcp'
import { multiaddr } from '@multiformats/multiaddr'
import { createLibp2p } from 'libp2p'

// Take the first argument as the path of the folder to add
const args = process.argv.slice(2)

// Example of how to use arguments
if (args.length === 0) {
  console.error('No argument provided')
  console.error('Usage: node client.js <serverAddress>')
  process.exit(1)
}

// turn the passed arg into a multiaddr
const addr = multiaddr(args[0])

const node = await createLibp2p({
  transports: [
    tcp()
  ],
  connectionEncrypters: [
    noise()
  ],
  streamMuxers: [
    yamux()
  ],
  services: {
    http: http()
  },
  connectionMonitor: {
    enabled: false
  }
})

// this agent will direct all requests to the passed PeerId/Multiaddr
const agent = node.services.http.agent(addr)

// make an HTTP request over libp2p
const req = request({
  host: 'example.com',
  method: 'GET',
  agent
}, (res) => {
  console.info(req.method, addr.toString(), res.statusCode, res.statusMessage)

  res.on('data', (buf) => {
    console.info(buf.toString())
  })
})

req.on('error', (err) => {
  console.error('problem with request', err)
})

req.end()
