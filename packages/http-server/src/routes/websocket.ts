import { InvalidParametersError } from '@libp2p/interface'
import { WEBSOCKET_HANDLER } from '../constants.js'
import { Response } from '../fetch/response.js'
import { isWebSocketUpgrade, normalizeMethod } from '../utils.js'
import { getServerUpgradeHeaders } from '../websocket/utils.js'
import { RequestWebSocket } from '../websocket/websocket.js'
import { initializeRoute } from './index.js'
import type { HTTPRequestHandler, WebSocketHandler } from '../index.js'
import type { HTTPRoute, RouteOptions } from './index.js'

export interface WebSocketRouteOptions extends RouteOptions {
  /**
   * If the request does not have a `Connection: upgrade` header, pass a
   * fallback here to handle the request normally, otherwise the request
   * will be rejected with a 400 error.
   */
  fallback?: HTTPRequestHandler

  /**
   * The maximum message size to be sent or received over the socket in bytes
   *
   * @default 10_485_760
   */
  maxMessageSize?: number
}

export type WebSocketRoute = HTTPRoute<WebSocketHandler> & WebSocketRouteOptions

/**
 * Negotiate a connection upgrade to the WebSocket protocol and call the passed
 * handler
 */
export function webSocketRoute (route: WebSocketRoute): HTTPRoute {
  const method = normalizeMethod(route.method, ['GET'])

  if (route.fallback == null && method.filter(method => method !== 'GET').length > 0) {
    throw new InvalidParametersError('WebSocket handlers only support the GET HTTP method')
  }

  const output: HTTPRoute = {
    ...route,
    init: (components) => {
      const next = initializeRoute(route, components)

      // allow invoking the handler with a pre-upgraded socket
      output[WEBSOCKET_HANDLER] = next.handler

      return async (req: Request): Promise<Response> => {
        // check upgrade has been requested
        if (!isWebSocketUpgrade(req.method, req.headers)) {
          if (route?.fallback != null) {
            return route.fallback(req)
          }

          return new Response(null, {
            status: 400
          })
        }

        const transform = new TransformStream()

        try {
          const res = new Response(transform.readable, {
            status: 101,
            headers: await getServerUpgradeHeaders(req.headers)
          })

          const ws = new RequestWebSocket(req, transform.writable, route)
          next.handler(ws)

          return res
        } catch (err) {
          return new Response(null, {
            status: 500
          })
        }
      }
    }
  }

  return output
}
