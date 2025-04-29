/* eslint-disable no-console */

import { http } from '@libp2p/http'
import { peerIdAuth } from '@libp2p/http/middleware'
import { createLibp2p } from 'libp2p'

// create a libp2p node that can act as a client
const node = await createLibp2p({
  services: {
    http: http()
  }
})

const res = await node.services.http.fetch('http://localhost:8001/log-my-id', {
  middleware: [
    peerIdAuth({
      verifyPeer: (peerId) => {
        console.log('Server ID:', peerId.toString())

        return true
      }
    })
  ]
})

console.log('Client ID:', node.peerId.toString())
console.info('GET', res.url, res.status, res.statusText)
console.info(await res.text())
