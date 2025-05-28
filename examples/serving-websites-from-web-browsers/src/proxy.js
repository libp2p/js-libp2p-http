/* eslint-disable no-console */

import { createServer } from 'node:net'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { circuitRelayServer, circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { HTTP_PROTOCOL } from '@libp2p/http'
import { identify } from '@libp2p/identify'
import { ping } from '@libp2p/ping'
import { webRTC } from '@libp2p/webrtc'
import { webSockets } from '@libp2p/websockets'
import { multiaddr } from '@multiformats/multiaddr'
import { byteStream } from 'it-byte-stream'
import { createLibp2p } from 'libp2p'

const args = process.argv.slice(2)

// Example of how to use arguments
if (args.length === 0) {
  console.error('No argument provided')
  console.error('Usage: node proxy.js <serverAddress>')
  process.exit(1)
}

const address = multiaddr(args[0])

// create a libp2p node that functions as proxy for the webserver running in a
// web browser
const node = await createLibp2p({
  transports: [
    webRTC(),
    circuitRelayTransport(),
    webSockets()
  ],
  connectionEncrypters: [noise()],
  streamMuxers: [yamux()],
  services: {
    identify: identify(),
    relay: circuitRelayServer(),
    ping: ping()
  }
})

const server = createServer((socket) => {
  Promise.resolve()
    .then(async () => {
      const stream = await node.dialProtocol(address, HTTP_PROTOCOL, {
        signal: AbortSignal.timeout(5_000)
      })

      const bytes = byteStream(stream)

      socket.on('data', buf => {
        bytes.write(buf)
      })
      socket.on('close', () => {
        stream.close()
      })
      socket.on('error', (err) => {
        stream.abort(err)
      })

      while (true) {
        const buf = await bytes.read()

        if (buf == null) {
          break
        }

        socket.write(buf.subarray())
      }

      socket.end()
      stream.close()
    })
    .catch(err => {
      console.error('failed to proxy request', err)
      socket.destroy()
    })
})

server.listen(0, () => {
  console.info('Proxy listening on:')
  console.info(`http://127.0.0.1:${server.address().port}`)
})
