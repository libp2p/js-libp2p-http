import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { Hono } from 'hono'
import { http } from '@libp2p/http'
import { fetchServer } from '@libp2p/http-server'

// this Hono app is where any business logic necessary to server HTTP
// resources will take place
const app = new Hono()
app.get('/', (c) => {
  return c.text('Hello World!')
})

// create a libp2p node that listens on a TCP address
const node = await createLibp2p({
  addresses: {
    listen: [
      '/ip4/0.0.0.0/tcp/1234'
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
      // allow injecting requests into the Hono app
      server: fetchServer(app.fetch)
    })
  }
})

console.info('Server listening on:')
node.getMultiaddrs().forEach(ma => {
  console.info(ma.toString())
})
