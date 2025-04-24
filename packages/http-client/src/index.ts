/**
 * @packageDocumentation
 *
 * This module exports libp2p-compatible versions of the [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
 * and [WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
 * APIs.
 *
 * This is necessary because certain features are disabled in browsers but we
 * need access to them in order to serve web pages in a runtime-agnostic way.
 */
export * from './fetch/index.js'
export * from './middleware/index.js'
export * from './websocket/index.js'
