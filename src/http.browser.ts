import { UnsupportedOperationError, serviceCapabilities, start, stop } from '@libp2p/interface'
import { PROTOCOL, WELL_KNOWN_PROTOCOLS } from './constants.js'
import { Cookies } from './cookies.js'
import { fetch } from './fetch/index.js'
import { HTTPRegistrar } from './registrar.js'
import { getHost, prepareAndSendRequest, processResponse, stripHTTPPath, toMultiaddrs, toResource } from './utils.js'
import { WebSocket as WebSocketClass } from './websocket/websocket.js'
import type { HTTPInit, HTTP as HTTPInterface, WebSocketInit, HTTPRequestHandler, ProtocolMap, RequestHandlerOptions, FetchInit, RequestProcessor } from './index.js'
import type { ComponentLogger, Logger, PeerId, PrivateKey, Startable } from '@libp2p/interface'
import type { ConnectionManager, Registrar } from '@libp2p/interface-internal'
import type { Multiaddr } from '@multiformats/multiaddr'

export interface HTTPComponents {
  privateKey: PrivateKey
  registrar: Registrar
  connectionManager: ConnectionManager
  logger: ComponentLogger
}

export class HTTP implements HTTPInterface, Startable {
  private readonly log: Logger
  protected readonly components: HTTPComponents
  private readonly httpRegistrar: HTTPRegistrar
  private readonly processors: RequestProcessor[]

  constructor (components: HTTPComponents, init: HTTPInit = {}) {
    this.components = components
    this.log = components.logger.forComponent('libp2p:http')
    this.httpRegistrar = new HTTPRegistrar(components, init)
    this.processors = [
      new Cookies(components, init)
    ]
  }

  readonly [Symbol.toStringTag] = '@libp2p/http'

  readonly [serviceCapabilities]: string[] = [
    '@libp2p/http'
  ]

  async start (): Promise<void> {
    await start(
      this.httpRegistrar,
      ...this.processors
    )
  }

  async stop (): Promise<void> {
    await stop(
      this.httpRegistrar,
      ...this.processors
    )
  }

  agent (...args: any[]): any {
    throw new UnsupportedOperationError('This method is not supported in browsers')
  }

  dispatcher (...args: any[]): any {
    throw new UnsupportedOperationError('This method is not supported in browsers')
  }

  connect (resource: string | URL | Multiaddr | Multiaddr[], protocols?: string[], init: WebSocketInit = {}): globalThis.WebSocket {
    const url = toResource(resource)

    if (url instanceof URL) {
      const socket = new globalThis.WebSocket(url, protocols)
      socket.binaryType = 'arraybuffer'

      return socket
    }

    // strip http-path tuple but record the value if set
    const { addresses, httpPath } = stripHTTPPath(url)

    return new WebSocketClass(addresses, new URL(`http://${getHost(url, init)}${decodeURIComponent(httpPath)}`), this.components.connectionManager, {
      ...init,
      protocols,
      isClient: true
    })
  }

  async fetch (resource: string | URL | Multiaddr | Multiaddr[], init: FetchInit = {}): Promise<Response> {
    const url = toResource(resource)

    const response = await prepareAndSendRequest(url, init, init.processors ?? this.processors, async () => {
      return this.sendRequest(url, init)
    })

    return processResponse(url, init, init.processors ?? this.processors, response)
  }

  async getSupportedProtocols (peer: PeerId | Multiaddr | Multiaddr[]): Promise<ProtocolMap> {
    const addresses = toMultiaddrs(peer, `/http-path/${encodeURIComponent(WELL_KNOWN_PROTOCOLS.substring(1))}`)
    const resp = await this.fetch(addresses, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    })

    if (resp.status !== 200) {
      throw new Error(`Unexpected status code: ${resp.status}`)
    }

    return resp.json()
  }

  async getProtocolPath (peer: PeerId | Multiaddr, protocol: string): Promise<string> {
    const peerMeta = await this.getSupportedProtocols(peer)

    if (peerMeta[protocol] == null) {
      throw new Error(`Peer does not serve protocol: ${protocol}`)
    }

    return peerMeta[protocol].path
  }

  canHandle (req: { url?: string }): boolean {
    return this.httpRegistrar.canHandle(req)
  }

  async onRequest (req: Request): Promise<Response> {
    return this.httpRegistrar.onRequest(req)
  }

  onWebSocket (ws: WebSocket): void {
    this.httpRegistrar.onWebSocket(ws)
  }

  handle (protocol: string, handler: HTTPRequestHandler, options?: RequestHandlerOptions): void {
    this.httpRegistrar.handle(protocol, handler, options)
  }

  unhandle (protocol: string): void {
    this.httpRegistrar.unhandle(protocol)
  }

  getProtocolMap (): ProtocolMap {
    return this.httpRegistrar.getProtocolMap()
  }

  private async sendRequest (resource: Multiaddr[] | URL, init: FetchInit): Promise<Response> {
    if (resource instanceof URL) {
      return globalThis.fetch(resource, init)
    }

    const host = getHost(resource, init)

    // strip http-path tuple but record the value if set
    const { addresses, httpPath } = stripHTTPPath(resource)

    const connection = await this.components.connectionManager.openConnection(addresses, {
      signal: init.signal ?? undefined
    })
    const stream = await connection.newStream(PROTOCOL, {
      signal: init.signal ?? undefined
    })

    return fetch(stream, new URL(`http://${host}${decodeURIComponent(httpPath)}`), {
      ...init,
      logger: this.components.logger
    })
  }
}

export function toURL (resource: URL | Multiaddr[], init: FetchInit): URL {
  if (resource instanceof URL) {
    return resource
  }

  const host = getHost(resource, init)
  const { httpPath } = stripHTTPPath(resource)

  return new URL(`http://${host}${httpPath}`)
}
