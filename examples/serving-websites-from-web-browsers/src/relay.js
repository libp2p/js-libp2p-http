import { createLibp2p } from 'libp2p'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { webSockets } from '@libp2p/websockets'
import { circuitRelayServer } from '@libp2p/circuit-relay-v2'
import { identify } from '@libp2p/identify'
import { ping } from '@libp2p/ping'

// create a libp2p node that functions as Circuit Relay server
const node = await createLibp2p({
  addresses: {
    listen: [
      '/ip4/127.0.0.1/tcp/0/ws'
    ]
  },
  transports: [
    webSockets()
  ],
  connectionEncrypters: [
    noise()
  ],
  streamMuxers: [
    yamux()
  ],
  services: {
    identify: identify(),
    relay: circuitRelayServer(),
    ping: ping()
  }
})

console.info('Relay listening on:')
node.getMultiaddrs().forEach(ma => {
  console.info(ma.toString())
})
