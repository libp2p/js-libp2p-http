import { createLibp2p } from 'libp2p'
import { http } from '../../src/index.js'
import { pingHTTP, type PingHTTP } from '../../src/ping/index.js'
import { incomingMessageToRequest, writeResponse } from '../../src/servers/node.js'
import type { HTTP } from '../../src/index.js'
import type { Libp2p } from '@libp2p/interface'
import type { IncomingMessage, ServerResponse } from 'node:http'

export interface Libp2pOverHTTPHandler {
  /**
   * Returns `true` if the libp2p HTTP service will handle this WebSocket (e.g.
   * it is for protocol map published at the `/.well-known` location or there is
   * a protocol handler registered for this path).
   */
  (ws: WebSocket): boolean

  /**
   * Returns `true` if the libp2p HTTP service will handle this request (e.g. it
   * is for protocol map published at the `/.well-known` location or there is a
   * protocol handler registered for this path).
   */
  (req: IncomingMessage, res: ServerResponse): boolean
}

export interface Libp2pOverHttpHandlerResults {
  handler: Libp2pOverHTTPHandler
  libp2p: Libp2p<{ http: HTTP, pingHTTP: PingHTTP }>
}

export async function getLibp2pOverHttpHandler (): Promise<Libp2pOverHttpHandlerResults> {
  const libp2p = await createLibp2p({
    services: {
      http: http(),
      pingHTTP: pingHTTP()
    },
    connectionManager: {
      inboundConnectionThreshold: Infinity
    }
  })

  const handler = (...args: any[]): boolean => {
    if (args.length === 1) {
      const ws: WebSocket = args[0]

      if (libp2p.services.http.canHandle(ws)) {
        libp2p.services.http.onWebSocket(ws)
        return true
      }
    } else if (args.length === 2) {
      const req: IncomingMessage = args[0]
      const res: ServerResponse = args[1]

      if (libp2p.services.http.canHandle(req)) {
        libp2p.services.http.onRequest(incomingMessageToRequest(req))
          .then(result => {
            writeResponse(result, res)
          })
          .catch(err => {
            res.writeHead(500, err.toString())
            res.end()
          })
        return true
      }
    }

    return false
  }

  return {
    libp2p,
    handler
  }
}
