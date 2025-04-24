/* eslint-disable no-console */

import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { http } from '@libp2p/http'
import { tcp } from '@libp2p/tcp'
import express from 'express'
import { createLibp2p } from 'libp2p'

// create an express server
const app = express()

// configure a route
app.get('/my-resource', (req, res) => {
  res.send('hello from express!')
})

// this libp2p node will pass HTTP requests to Express
const listener = await createLibp2p({
  addresses: {
    listen: ['/ip4/127.0.0.1/tcp/0']
  },
  transports: [tcp()],
  connectionEncrypters: [noise()],
  streamMuxers: [yamux()],
  services: {
    http: http()
  }
})

const listenAddrs = listener.getMultiaddrs()
console.error('libp2p is listening on the following addresses:')

for (const addr of listenAddrs) {
  console.info(addr.toString())
}

// wait for SIGINT
await new Promise(resolve => process.on('SIGINT', resolve))

// Stop the http server
listener.close()

// stop libp2p
await listener.stop()
console.error('libp2p has stopped')
