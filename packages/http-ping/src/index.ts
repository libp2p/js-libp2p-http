// http-ping implementation
import { PingHTTPService as PingHTTPServiceClass } from './ping.js'
import type { FetchInit, WebSocketInit, HTTP } from '../index.js'
import type { ComponentLogger, PeerId } from '@libp2p/interface'
import type { Multiaddr } from '@multiformats/multiaddr'

export const HTTP_PING_PROTOCOL = '/http-ping/1'

export interface PingHTTPComponents {
  http: HTTP
  logger: ComponentLogger
}

export interface PingHTTPOptions extends FetchInit {
}

export interface PingWebSocketOptions extends WebSocketInit {
  /**
   * Make a request over a WebSocket instead of HTTP
   */
  webSocket: true
}

export interface PingHTTP {
  ping (peer: PeerId | Multiaddr | Multiaddr[], options?: PingHTTPOptions | PingWebSocketOptions): Promise<number>
}

export function pingHTTP (): (components: PingHTTPComponents) => PingHTTP {
  return (components) => new PingHTTPServiceClass(components)
}
