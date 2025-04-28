import { fetch } from '@libp2p/http-fetch'
import { getHeaders, getHost, stripHTTPPath, toMultiaddrs, toResource } from '@libp2p/http-utils'
import { WebSocket } from '@libp2p/http-websocket'
import { UnsupportedOperationError, serviceCapabilities, start, stop } from '@libp2p/interface'
import { HTTP_PROTOCOL } from './constants.js'
import { Cookies } from './middleware/cookies.js'
import { Origin } from './middleware/origin.js'
import { HTTPRegistrar } from './registrar.js'
import { prepareAndConnect, prepareAndSendRequest, processResponse } from './utils.js'
import { WELL_KNOWN_PROTOCOLS_PATH } from './index.js'
import type { HTTPInit, HTTP as HTTPInterface, ProtocolMap, FetchInit, HTTPRoute, ConnectInit, MiddlewareOptions } from './index.js'
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
  private readonly origin: Origin
  private readonly cookies: Cookies

  constructor (components: HTTPComponents, init: HTTPInit = {}) {
    this.components = components
    this.log = components.logger.forComponent('libp2p:http')
    this.httpRegistrar = new HTTPRegistrar(components, init)
    this.origin = new Origin()
    this.cookies = new Cookies(components, init)
  }

  readonly [Symbol.toStringTag] = '@libp2p/http'

  readonly [serviceCapabilities]: string[] = [
    '@libp2p/http'
  ]

  async start (): Promise<void> {
    await start(
      this.httpRegistrar
    )
  }

  async stop (): Promise<void> {
    await stop(
      this.httpRegistrar
    )
  }

  agent (...args: any[]): any {
    throw new UnsupportedOperationError('This method is not supported in browsers')
  }

  dispatcher (...args: any[]): any {
    throw new UnsupportedOperationError('This method is not supported in browsers')
  }

  async connect (resource: string | URL | Multiaddr | Multiaddr[], init: ConnectInit = {}): Promise<globalThis.WebSocket> {
    const url = toResource(resource)
    const headers = getHeaders(init)
    const opts: MiddlewareOptions = {
      ...init,
      headers,
      method: 'GET',
      middleware: init.middleware?.map(fn => fn(this.components)) ?? []
    }

    headers.set('connection', 'upgrade')
    headers.set('upgrade', 'websocket')

    return prepareAndConnect(url, opts, async () => {
      if (url instanceof URL) {
        const socket = new globalThis.WebSocket(url, init.protocols)
        socket.binaryType = 'arraybuffer'

        return socket
      }

      // strip http-path tuple but record the value if set
      const { addresses, httpPath } = stripHTTPPath(url)

      return new WebSocket(
        addresses,
        new URL(`http://${getHost(url, opts.headers)}${decodeURIComponent(httpPath)}`),
        this.components.connectionManager,
        opts
      )
    })
  }

  async fetch (resource: string | URL | Multiaddr | Multiaddr[], init: FetchInit = {}): Promise<Response> {
    const url = toResource(resource)
    const opts: MiddlewareOptions = {
      ...init,
      headers: getHeaders(init),
      method: 'GET',
      middleware: [
        this.origin,
        this.cookies,
        ...init.middleware?.map(fn => fn(this.components)) ?? []
      ]
    }

    const response = await prepareAndSendRequest(url, opts, async () => {
      return this.sendRequest(url, init)
    })

    return processResponse(url, opts, response)
  }

  async getSupportedProtocols (peer: PeerId | Multiaddr | Multiaddr[]): Promise<ProtocolMap> {
    const addresses = toMultiaddrs(peer, `/http-path/${encodeURIComponent(WELL_KNOWN_PROTOCOLS_PATH.substring(1))}`)
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

  onWebSocket (ws: globalThis.WebSocket): void {
    this.httpRegistrar.onWebSocket(ws)
  }

  handle (protocol: string, handler: HTTPRoute): void {
    this.httpRegistrar.handle(protocol, handler)
  }

  unhandle (protocol: string): void {
    this.httpRegistrar.unhandle(protocol)
  }

  getProtocolMap (): ProtocolMap {
    return this.httpRegistrar.getProtocolMap()
  }

  private async sendRequest (resource: Multiaddr[] | URL, init: FetchInit): Promise<Response> {
    if (resource instanceof URL) {
      this.log('making request with global fetch')
      return globalThis.fetch(resource, init)
    }

    this.log('making request with libp2p fetch')
    const host = getHost(resource, getHeaders(init))

    // strip http-path tuple but record the value if set
    const { addresses, httpPath } = stripHTTPPath(resource)

    const connection = await this.components.connectionManager.openConnection(addresses, {
      signal: init.signal ?? undefined
    })
    const stream = await connection.newStream(HTTP_PROTOCOL, {
      signal: init.signal ?? undefined
    })

    return fetch(stream, new URL(`http://${host}${decodeURIComponent(httpPath)}`), {
      ...init,
      logger: this.components.logger
    })
  }
}
