import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import express from 'express'
import { http } from '@libp2p/http'
import { nodeServer } from '@libp2p/http-server'
import { createServer } from 'node:http'

// this express app is where any business logic necessary to server HTTP
// resources will take place
const app = express()
app.get('/', (req, res) => {
  res.send('Hello World!')
})

// this Node.js http.Server will receive incoming socket connections and convert
// them to HTTP requests - note that we don't need to call `server.listen` -
// libp2p will provide the networking layer
const server = createServer()
server.on('request', (req, res) => {
  app(req, res)
})

// create a libp2p node that listens on a TCP address
const node = await createLibp2p({
  addresses: {
    listen: [
      '/ip4/0.0.0.0/tcp/0'
    ]
  },
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
    http: http({
      // allow injecting requests into the Node.js http.Server
      server: nodeServer(server)
    })
  }
})

console.info('Server listening on:')
node.getMultiaddrs().forEach(ma => {
  console.info(ma.toString())
})
