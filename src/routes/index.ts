import type { WEBSOCKET_HANDLER } from '../constants.js'
import type { HTTPRequestHandler, WebSocketHandler } from '../index.js'

/**
 * Options used to define a HTTP route that can handle requests
 */
export interface RouteOptions {
  /**
   * Specify a path to serve the protocol from. If omitted the protocol name
   * will be used.
   *
   * Paths can be looked up from the protocol map using `getProtocolMap()` or by
   * making a GET request to `/.well-known/libp2p/protocols`.
   */
  path?: string

  /**
   * A list of HTTP verbs this handler will respond to. If the handler is found
   * but the request method is not present a 405 will be returned.
   *
   * @default ['GET']
   */
  method?: string | string[]

  /**
   * By default all handlers support CORS headers, pass `false` here to disallow
   * access to fetch requests.
   *
   * @default true
   */
  cors?: boolean
}

/**
 * A simple route that defines a handler function
 */
export interface HandlerRoute<H> extends RouteOptions {
  handler: H
}

/**
 * A route that requires initialization before use
 */
export interface ServiceRoute<H> extends RouteOptions {
  init(components: any): H
}

/**
 * A WebSocket route can make it's handler available for invocation with a
 * pre-upgraded WebSocket object
 */
export interface WebSocketRoute {
  [WEBSOCKET_HANDLER]?: WebSocketHandler
}

/**
 * A union of the various route types
 */
export type HTTPRoute<H = HTTPRequestHandler> = (HandlerRoute<H> | ServiceRoute<H>) & WebSocketRoute

/**
 * Returns true if the passed route requires initialization
 */
export function isInitializable <H extends HandlerRoute<any>, S extends ServiceRoute<any>> (obj: H | S): obj is S {
  // @ts-expect-error init is not a property of H
  return typeof obj.init === 'function'
}

/**
 * Initializes a `ServiceRoute` and converts it to a `HandlerRoute`.
 *
 * If the passed route has an `init` method, it invokes it and sets the
 * `handler` field on the endpoint with the return value, then deletes the
 * `init` property, otherwise it returns the endpoint unaltered.
 */
export function initializeRoute <H> (serviceOrHandler: HTTPRoute<H>, components: any): HandlerRoute<H> {
  if (isInitializable(serviceOrHandler)) {
    const route: any = serviceOrHandler
    route.handler = serviceOrHandler.init(components)
    delete route.init

    return route
  }

  return serviceOrHandler
}
