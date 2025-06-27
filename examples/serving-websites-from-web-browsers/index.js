import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { devToolsMetrics } from '@libp2p/devtools-metrics'
import { http } from '@libp2p/http'
import { nodeServer } from '@libp2p/http-server'
import { createServer } from '@libp2p/http-server/node'
import { identify } from '@libp2p/identify'
import { ping } from '@libp2p/ping'
import { webRTC } from '@libp2p/webrtc'
import { webSockets } from '@libp2p/websockets'
import { multiaddr } from '@multiformats/multiaddr'
import { WebRTC } from '@multiformats/multiaddr-matcher'
import { createLibp2p } from 'libp2p'

const WEB_PAGE = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>A website served from a web browser</title>
  </head>
  <body>
    <h1>This web page was served from a browser</h1>
    <p>The user agent of the browser was ${navigator.userAgent}</p>
  </body>
</html>
`

const server = createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    appendOutput(`${req.method} ${req.url} 200`)
    res.write(WEB_PAGE)
    res.end()
    return
  }

  appendOutput(`${req.method} ${req.url} 404`)
  res.write('404 Not found')
  res.end()
})

const DOM = {
  dialMultiaddrInput: () => document.getElementById('dial-multiaddr-input'),
  dialMultiaddrButton: () => document.getElementById('dial-multiaddr-button'),

  output: () => document.getElementById('output'),

  listeningAddressesList: () => document.getElementById('listening-addresses')
}

const appendOutput = (line) => {
  DOM.output().innerText += `${line}\n`
}

const libp2p = await createLibp2p({
  addresses: {
    listen: [
      // make a reservation on any discovered relays - this will let other
      // peers use the relay to contact us
      '/p2p-circuit',
      // create listeners for incoming WebRTC connection attempts on on all
      // available Circuit Relay connections
      '/webrtc'
    ]
  },
  transports: [
    // the WebSocket transport lets us dial a local relay
    webSockets(),
    // support dialing/listening on WebRTC addresses
    webRTC(),
    // support dialing/listening on Circuit Relay addresses
    circuitRelayTransport()
  ],
  // a connection encrypter is necessary to dial the relay
  connectionEncrypters: [noise()],
  // a stream muxer is necessary to dial the relay
  streamMuxers: [yamux()],
  connectionGater: {
    denyDialMultiaddr: () => {
      // by default we refuse to dial local addresses from browsers since they
      // are usually sent by remote peers broadcasting undialable multiaddrs and
      // cause errors to appear in the console but in this example we are
      // explicitly connecting to a local node so allow all addresses
      return false
    }
  },
  services: {
    identify: identify(),
    http: http({
      server: nodeServer(server)
    }),
    ping: ping()
  },
  metrics: devToolsMetrics()
})

// update listening addresses
libp2p.addEventListener('self:peer:update', () => {
  const multiaddrs = libp2p.getMultiaddrs()
    .filter(ma => WebRTC.exactMatch(ma))
    .map((ma) => {
      const el = document.createElement('li')
      el.textContent = ma.toString()
      return el
    })
  DOM.listeningAddressesList().replaceChildren(...multiaddrs)
})

// dial remote peer
DOM.dialMultiaddrButton().onclick = async () => {
  const ma = multiaddr(DOM.dialMultiaddrInput().value)
  appendOutput(`Dialing '${ma}'`)
  await libp2p.dial(ma)
  appendOutput(`Connected to '${ma}'`)
}
