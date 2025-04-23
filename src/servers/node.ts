import { streamToSocket } from '../stream-to-socket.js'
import { readableToReadableStream } from '../utils.js'
import type { Endpoint, HTTP, HeaderInfo } from '../index.js'
import type { Stream, Connection, Libp2p } from '@libp2p/interface'
import type { ServerResponse, IncomingMessage } from 'node:http'
import type { Socket } from 'node:net'

export interface ConnectionHandler {
  emit (event: 'connection', socket: Socket): void
}

export interface NodeServerInit {
  server: ConnectionHandler
}

class NodeServer implements Endpoint {
  private readonly server: ConnectionHandler

  constructor (init: NodeServerInit) {
    this.server = init.server
  }

  async inject (info: HeaderInfo, stream: Stream, connection: Connection): Promise<void> {
    // re-yield the headers to enable node to set up the request properly
    const streamSource = stream.source
    stream.source = (async function * () {
      yield info.raw
      yield * streamSource
    })()

    this.server.emit('connection', streamToSocket(stream, connection))
  }
}

export function nodeServer (server: ConnectionHandler): Endpoint {
  return new NodeServer({ server })
}

function incomingMessageToRequest (req: IncomingMessage): Request {
  const headers = incomingHttpHeadersToHeaders(req.headers)
  const init: RequestInit = {
    method: req.method,
    headers
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    // @ts-expect-error this is required by NodeJS despite being the only reasonable option https://fetch.spec.whatwg.org/#requestinit
    init.duplex = 'half'
    init.body = readableToReadableStream(req)
  }

  const url = new URL(`http://${headers.get('host') ?? 'example.com'}${req.url ?? '/'}`)

  return new Request(url, init)
}

function incomingHttpHeadersToHeaders (input: IncomingMessage['headers']): Headers {
  const headers = new Headers()

  for (const [key, value] of Object.entries(input)) {
    if (value == null) {
      continue
    }

    if (Array.isArray(value)) {
      for (const val of value) {
        headers.append(key, val)
      }
    } else {
      headers.set(key, value)
    }
  }

  return headers
}

function writeResponse (res: Response, ser: ServerResponse): void {
  ser.statusCode = res.status
  ser.statusMessage = res.statusText

  res.headers.forEach((val, key) => {
    ser.setHeader(key, val)
  })

  if (res.body == null) {
    ser.end()
  } else {
    const reader = res.body.getReader()

    Promise.resolve().then(async () => {
      while (true) {
        const { done, value } = await reader.read()

        if (value != null) {
          ser.write(value)
        }

        if (done) {
          break
        }
      }

      ser.end()
    })
      .catch(err => {
        ser.end(err)
      })
  }
}

export interface DidHandle {
  (...args: any[]): boolean
}

/**
 * Helper function to ascertain whether the passed libp2p node handled the
 * incoming HTTP or WebSocket request.
 *
 * @example Delegating handling of HTTP requests
 *
 * ```ts
 * import { createLibp2p } from 'libp2p'
 * import { canHandle } from '@libp2p/http/servers'
 * import createServer from 'node:http'
 *
 * const libp2p = await createLibp2p({
 *   // ...options
 * })
 *
 * const handled = canHandle(libp2p)
 *
 * createServer((req, res) => {
 *   if (handled(req, res)) {
 *     // libp2p handled the request, nothing else to do
 *     return
 *   }
 *
 *   // handle request normally - pass off to express/fastify/etc or return 404
 * })
 * ```
 */
export function canHandle (libp2p: Libp2p<{ http: HTTP }>): DidHandle {
  return (...args: any[]): boolean => {
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
}
