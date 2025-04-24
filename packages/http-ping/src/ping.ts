// http-ping implementation
import { ProtocolError, serviceDependencies } from '@libp2p/interface'
import { raceEvent } from 'race-event'
import { raceSignal } from 'race-signal'
import { equals as uint8ArrayEquals } from 'uint8arrays/equals'
import { Response } from '../fetch/response.js'
import { authenticatedWebSocketRoute } from '../routes/peer-id-auth.js'
import { toMultiaddrs } from '../utils.js'
import { HTTP_PING_PROTOCOL } from './index.js'
import type { PingHTTPComponents, PingHTTP as PingHTTPInterface, PingHTTPOptions, PingWebSocketOptions } from './index.js'
import type { Logger, PeerId, Startable } from '@libp2p/interface'
import type { Multiaddr } from '@multiformats/multiaddr'

const PING_SIZE = 32

export class PingHTTPService implements PingHTTPInterface, Startable {
  private readonly components: PingHTTPComponents
  private readonly log: Logger

  constructor (components: PingHTTPComponents) {
    this.components = components
    this.log = components.logger.forComponent('libp2p:http:ping')

    this.onHTTPRequest = this.onHTTPRequest.bind(this)
    this.onWebSocket = this.onWebSocket.bind(this)
  }

  readonly [Symbol.toStringTag] = '@libp2p/ping-http'

  readonly [serviceDependencies]: string[] = [
    '@libp2p/http'
  ]

  start (): void {
    this.components.http.handle(HTTP_PING_PROTOCOL, authenticatedWebSocketRoute({
      requireAuth: false,
      method: ['GET', 'POST'],
      handler: this.onWebSocket,
      fallback: this.onHTTPRequest
    }))
  }

  stop (): void {
    this.components.http.unhandle(HTTP_PING_PROTOCOL)
  }

  async onHTTPRequest (req: Request): Promise<Response> {
    this.log('incoming HTTP ping request')

    if (req.body == null) {
      this.log.error('body was null')
      return new Response(null, { status: 400 })
    }

    const ab = await req.arrayBuffer()
    const buf = new Uint8Array(ab, 0, ab.byteLength)

    if (buf.byteLength !== PING_SIZE) {
      this.log.error('ping data length was incorrect - expected %d got %d', PING_SIZE, buf.byteLength)
      return new Response(null, { status: 400 })
    }

    return new Response(buf, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': `${PING_SIZE}`
      }
    })
  }

  onWebSocket (ws: WebSocket): void {
    this.log('incoming WebSocket ping request')

    ws.addEventListener('message', (evt) => {
      const buf = new Uint8Array(evt.data, 0, evt.data.byteLength)

      if (buf.length !== PING_SIZE) {
        this.log.error('ping data length was incorrect - expected %d got %d', PING_SIZE, buf.byteLength)
        ws.close(400)
        return
      }

      ws.send(buf)
      ws.close()
    })
  }

  async ping (peer: PeerId | Multiaddr | Multiaddr[], options: PingHTTPOptions | PingWebSocketOptions = {}): Promise<number> {
    const pingEndpoint = await this.components.http.getProtocolPath(peer, HTTP_PING_PROTOCOL, {
      ...options,
      signal: options.signal ?? undefined
    })
    const dialTarget = toMultiaddrs(peer)
      .map(ma => ma.encapsulate(`/http-path/${encodeURIComponent(pingEndpoint.substring(1))}`))

    const start = Date.now()
    const buf = new Uint8Array(PING_SIZE)
    // fill buffer with random data
    crypto.getRandomValues(buf)

    this.log('ping %s', peer)
    const output = await raceSignal(isPingWebSocketOptions(options) ? this.webSocketPing(dialTarget, buf, options) : this.httpPing(dialTarget, buf, options), options?.signal ?? undefined)
    const respBuf = new Uint8Array(output, 0, output.byteLength)

    if (respBuf.length !== PING_SIZE) {
      throw new ProtocolError(`Unexpected response size: ${respBuf.length}`)
    }

    if (!uint8ArrayEquals(respBuf, buf)) {
      throw new ProtocolError('Ping body mismatch')
    }

    return Date.now() - start
  }

  async httpPing (dialTarget: Multiaddr[], buf: Uint8Array, options: PingHTTPOptions): Promise<ArrayBuffer> {
    const res = await this.components.http.fetch(dialTarget, {
      ...options,
      method: 'POST',
      body: buf
    })

    if (res.status !== 200) {
      throw new ProtocolError(`Unexpected status code: ${res.status}`)
    }

    return res.arrayBuffer()
  }

  async webSocketPing (dialTarget: Multiaddr[], buf: Uint8Array, options: PingWebSocketOptions): Promise<ArrayBuffer> {
    this.log('opening websocket connection to %a', dialTarget)
    const socket = await this.components.http.connect(dialTarget, options)

    if (socket.readyState !== WebSocket.OPEN) {
      await raceEvent(socket, 'open', options.signal)
      this.log('websocket connection to %a open', dialTarget)
    }

    const p = new Promise<ArrayBuffer>((resolve, reject) => {
      socket.addEventListener('message', (evt) => {
        this.log('received ping response from %a', dialTarget)
        resolve(evt.data)
      })
      socket.addEventListener('error', (evt: any) => {
        this.log('ping to %a errored - %e', dialTarget, evt.error ?? evt)
        reject(new Error('An error occurred'))
      })
      socket.addEventListener('close', () => {
        this.log('ping to %a closed prematurely - %e', dialTarget)
        reject(new Error('The WebSocket was closed before the pong was received'))
      })
    })

    this.log('send ping message to %a', dialTarget)
    socket.send(buf)

    return p
  }
}

function isPingWebSocketOptions (obj: any): obj is PingWebSocketOptions {
  return obj?.webSocket === true
}
