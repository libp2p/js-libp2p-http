import { getHeaders, isWebSocketUpgrade } from '../utils.js'

/**
 * Extends the native Request class to be more flexible.
 *
 * - body - normally GET requests cannot have a body, but if the request is for
 * a WebSocket upgrade, we need the body to turn into the socket
 *
 * - headers - the global browser request removes certain headers like
 * Authorization and Sec-WebSocket-Protocol but we need to preserve them
 */
export class Request extends globalThis.Request {
  public readonly method: string
  public readonly headers: Headers

  constructor (input: RequestInfo | URL, init: RequestInit = {}) {
    const headers = getHeaders(init)
    const method = init.method ?? 'GET'

    if (isWebSocketUpgrade(method, headers)) {
      // temporarily override the method name since undici does not allow GET
      // requests with bodies
      init.method = 'UPGRADE'
    }

    super(input, init)

    this.method = method
    this.headers = headers
  }
}
