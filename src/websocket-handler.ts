import { WEBSOCKET_HANDLER } from './constants.js'
import { getServerUpgradeHeaders } from './websocket/utils.js'
import { RequestWebSocket } from './websocket/websocket.js'
import type { HTTPRequestHandler, WebSocketHandler } from './index.js'

export interface WebSocketHandlerOptions {
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

/**
 * Negotiate a connection upgrade to the WebSocket protocol and call the passed
 * handler
 */
export function webSocketHandler (handler: WebSocketHandler, options?: WebSocketHandlerOptions): HTTPRequestHandler {
  const fn = async (req: Request): Promise<Response> => {
    // check upgrade has been requested
    if (req.headers.get('connection') !== 'upgrade' && req.headers.get('upgrade') !== 'websocket') {
      if (options?.fallback != null) {
        return options.fallback(req)
      }

      return new Response(null, {
        status: 400,
        statusText: 'Bad Request'
      })
    }

    const transform = new TransformStream()

    try {
      const res = {
        status: 101,
        statusText: 'Switching Protocols',
        headers: await getServerUpgradeHeaders(req.headers),
        body: transform.readable
      }

      const ws = new RequestWebSocket(req, transform.writable, options)
      handler(ws)

      // @ts-expect-error the Undici Response class requires statuses to be
      // 200-500 so we can't use it, just return an object with the correct
      // properties instead
      return res
    } catch {
      return new Response(null, {
        status: 400,
        statusText: 'Bad Request'
      })
    }
  }
  fn[WEBSOCKET_HANDLER] = handler

  return fn
}
