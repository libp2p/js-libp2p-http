import { HTTPParser } from '@achingbrain/http-parser-js'
import { InvalidParametersError } from '@libp2p/interface'
import { queuelessPushable } from 'it-queueless-pushable'
import { Uint8ArrayList } from 'uint8arraylist'
import { PROTOCOL, WEBSOCKET_HANDLER, WELL_KNOWN_PROTOCOLS } from './constants.js'
import { Response } from './fetch/response.js'
import { NOT_FOUND_RESPONSE, responseToStream, streamToRequest } from './utils.js'
import { wellKnownHandler } from './well-known-handler.js'
import type { Endpoint, HTTPRequestHandler, HeaderInfo, ProtocolMap, RequestHandlerOptions, WebSocketHandler } from './index.js'
import type { ComponentLogger, IncomingStreamData, Logger, Stream } from '@libp2p/interface'
import type { Registrar } from '@libp2p/interface-internal'

export interface HTTPRegistrarComponents {
  logger: ComponentLogger
  registrar: Registrar
}

export interface HTTPRegistrarInit {
  server?: Endpoint
}

interface ProtocolHandler {
  protocol: string
  path: string
  handler: HTTPRequestHandler
  authenticated?: boolean
}

export class HTTPRegistrar {
  private readonly log: Logger
  private readonly components: HTTPRegistrarComponents
  private protocols: ProtocolHandler[]
  private readonly endpoint?: Endpoint
  private readonly wellKnownHandler: ProtocolHandler

  constructor (components: HTTPRegistrarComponents, init: HTTPRegistrarInit = {}) {
    this.components = components
    this.log = components.logger.forComponent('libp2p:http:registrar')
    this.protocols = []
    this.onStream = this.onStream.bind(this)
    this.endpoint = init.server
    this.wellKnownHandler = {
      protocol: '',
      path: WELL_KNOWN_PROTOCOLS,
      handler: wellKnownHandler(this)
    }
  }

  async start (): Promise<void> {
    await this.components.registrar.handle(PROTOCOL, (data) => {
      this.onStream(data)
        .catch(err => {
          this.log.error('could not handle incoming stream - %e', err)
        })
    })
  }

  async stop (): Promise<void> {
    await this.components.registrar.unhandle(PROTOCOL)
  }

  private async onStream ({ stream, connection }: IncomingStreamData): Promise<void> {
    const info = await readHeaders(stream)

    if (this.canHandle(info)) {
      this.log('handling incoming request %s %s', info.method, info.url)
      const res = await this.onRequest(streamToRequest(info, stream))
      await responseToStream(res, stream)
      await stream.close()
      return
    }

    // pass request to endpoint if available
    if (this.endpoint == null) {
      this.log('cannot handle incoming request %s %s and no endpoint configured', info.method, info.url)
      await stream.sink([NOT_FOUND_RESPONSE])
      return
    }

    this.log('passing incoming request %s %s to endpoint', info.method, info.url)
    this.endpoint.inject(info, stream, connection)
      .catch(err => {
        this.log.error('error injecting request to endpoint - %e', err)
        stream.abort(err)
      })
  }

  canHandle (req: { url?: string }): boolean {
    if (req.url === WELL_KNOWN_PROTOCOLS || this.protocols.find(p => p.path === req.url) != null) {
      this.log('can handle %s', req.url)
      return true
    }

    this.log('cannot handle %s', req.url)
    return false
  }

  async onRequest (request: Request): Promise<Response> {
    const result = this.findHandler(request.url)

    if (result?.handler != null) {
      return result.handler(request)
    }

    return new Response(null, {
      status: 404,
      statusText: 'Not Found'
    })
  }

  onWebSocket (ws: WebSocket): void {
    const result = this.findHandler(ws.url)

    if (result != null) {
      // @ts-expect-error hidden field
      const wsHandler: WebSocketHandler = result.handler[WEBSOCKET_HANDLER]

      if (wsHandler != null) {
        wsHandler(ws)
        return
      }
    }

    ws.close(404, 'Not Found')
  }

  private findHandler (url: string): ProtocolHandler | undefined {
    const pathname = url.startsWith('/') ? url : new URL(url).pathname

    if (pathname === WELL_KNOWN_PROTOCOLS) {
      return this.wellKnownHandler
    }

    this.log('search for handler on path %s', pathname)

    const handler = this.protocols.find(p => p.path === pathname)

    if (handler != null) {
      this.log('found handler for HTTP protocol %s on path %s', handler.protocol, url)
    }

    return handler
  }

  handle (protocol: string, handler: HTTPRequestHandler, options: RequestHandlerOptions = {}): void {
    let path = options.path ?? crypto.randomUUID()

    if (this.protocols.find(p => p.protocol === protocol) != null) {
      throw new InvalidParametersError(`HTTP protocol handler for ${protocol} already registered`)
    }

    if (path === '' || !path.startsWith('/')) {
      path = `/${path}`
    }

    // add handler
    this.protocols.push({
      protocol,
      path,
      handler,
      authenticated: options.authenticate
    })

    // sort by path length desc so the most specific handler is invoked first
    this.protocols.sort(({ path: a }, { path: b }) => b.length - a.length)
  }

  unhandle (protocol: string): void {
    this.protocols = this.protocols.filter(p => p.protocol === protocol)
  }

  getProtocolMap (): ProtocolMap {
    const output: ProtocolMap = {}

    for (const p of this.protocols) {
      output[p.protocol] = {
        path: p.path
      }
    }

    return output
  }
}

/**
 * Reads HTTP headers from an incoming stream
 */
async function readHeaders (stream: Stream): Promise<HeaderInfo> {
  return new Promise<any>((resolve, reject) => {
    const parser = new HTTPParser('REQUEST')
    const source = queuelessPushable<Uint8ArrayList>()
    const earlyData = new Uint8ArrayList()
    let headersComplete = false

    parser[HTTPParser.kOnHeadersComplete] = (info) => {
      headersComplete = true
      const headers = new Headers()

      // set incoming headers
      for (let i = 0; i < info.headers.length; i += 2) {
        headers.set(info.headers[i].toLowerCase(), info.headers[i + 1])
      }

      resolve({
        ...info,
        headers,
        raw: earlyData,
        method: HTTPParser.methods[info.method]
      })
    }

    // replace source with request body
    const streamSource = stream.source
    stream.source = source

    Promise.resolve().then(async () => {
      for await (const chunk of streamSource) {
        // only use the message parser until the headers have been read
        if (!headersComplete) {
          earlyData.append(chunk)
          parser.execute(chunk.subarray())
        } else {
          await source.push(new Uint8ArrayList(chunk))
        }
      }

      await source.end()
    })
      .catch((err: Error) => {
        stream.abort(err)
        reject(err)
      })
      .finally(() => {
        parser.finish()
      })
  })
}
