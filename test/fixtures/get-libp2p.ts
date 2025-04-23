import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { memory } from '@libp2p/memory'
import { ping } from '@libp2p/ping'
import { webSockets } from '@libp2p/websockets'
import { createLibp2p } from 'libp2p'
import { http } from '../../src/index.js'
import { pingHTTP, type PingHTTP } from '../../src/ping/index.js'
import { authenticatedRoute, authenticatedWebSocketRoute } from '../../src/routes/peer-id-auth.js'
import type { Endpoint, HTTP } from '../../src/index.js'
import type { Libp2p } from '@libp2p/interface'

function addEndpoints (libp2p: Libp2p<{ http: HTTP }>): void {
  libp2p.services.http.handle('/libp2p/http/echo', {
    method: 'POST',
    handler: async (req) => {
      if (req.body == null) {
        return new Response(undefined, {
          status: 400
        })
      }

      const body = new TransformStream()
      const res = new Response(body.readable)

      req.body?.pipeTo(body.writable)
        .catch(err => {
          body.writable.abort(err)
            .catch(() => {})
        })

      return res
    }
  })

  libp2p.services.http.handle('/libp2p/http/peer-id', authenticatedRoute({
    method: 'GET',
    handler: async (req, peerId) => {
      return new Response(peerId.toString(), {
        status: 200
      })
    }
  }))

  libp2p.services.http.handle('/libp2p/http/optional-peer-id', authenticatedRoute({
    method: 'GET',
    requireAuth: false,
    handler: async (req, peerId) => {
      return new Response(peerId?.toString() ?? 'no-peer-id', {
        status: 200
      })
    }
  }))

  libp2p.services.http.handle('/libp2p/http/ws-peer-id', authenticatedWebSocketRoute({
    method: 'GET',
    handler: (ws, peerId) => {
      ws.send(peerId.toString())
      ws.close()
    },
    fallback: async (req, peerId) => {
      return new Response(peerId.toString(), {
        status: 200
      })
    }
  }))

  libp2p.services.http.handle('/libp2p/http/ws-optional-peer-id', authenticatedWebSocketRoute({
    method: 'GET',
    requireAuth: false,
    handler: (ws, peerId) => {
      ws.send(peerId?.toString() ?? 'no-peer-id')
      ws.close()
    },
    fallback: async (req, peerId) => {
      return new Response(peerId?.toString() ?? 'no-peer-id', {
        status: 200
      })
    }
  }))
}

/**
 * A node that listens for incoming HTTP over libp2p requests
 */
export async function getHTTPOverLibp2pHandler (server: Endpoint, listen: string = '/memory/address-1'): Promise<Libp2p<{ http: HTTP }>> {
  const libp2p = await createLibp2p({
    addresses: {
      listen: [
        listen
      ]
    },
    transports: [
      webSockets(),
      memory()
    ],
    connectionEncrypters: [
      noise()
    ],
    streamMuxers: [
      yamux()
    ],
    services: {
      http: http({ server }),
      ping: ping(),
      pingHTTP: pingHTTP()
    },
    connectionManager: {
      inboundConnectionThreshold: Infinity
    }
  })

  addEndpoints(libp2p)

  return libp2p
}

/**
 * A client node that makes HTTP over libp2p requests
 */
export async function getClient (): Promise<Libp2p<{ http: HTTP }>> {
  return createLibp2p({
    transports: [
      webSockets(),
      memory()
    ],
    connectionEncrypters: [
      noise()
    ],
    streamMuxers: [
      yamux()
    ],
    services: {
      http: http(),
      ping: ping(),
      pingHTTP: pingHTTP()
    }
  })
}

/**
 * A node that does not listen on any addresses but processes incoming libp2p
 * over HTTP requests
 */
export async function getLibp2pOverHttpHandler (): Promise< Libp2p<{ http: HTTP, pingHTTP: PingHTTP }>> {
  const libp2p = await createLibp2p({
    services: {
      http: http(),
      pingHTTP: pingHTTP()
    },
    connectionManager: {
      inboundConnectionThreshold: Infinity
    }
  })

  addEndpoints(libp2p)

  return libp2p
}
