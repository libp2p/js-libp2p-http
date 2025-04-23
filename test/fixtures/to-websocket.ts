import { normalizeUrl } from '../../src/utils.js'
import type { IncomingMessage } from '../../src/http/incoming-message.js'
import type { WebSocket as WSSWebSocket } from 'ws'

export function toWebSocket (ws: WSSWebSocket, req: IncomingMessage): WebSocket {
  const url = normalizeUrl(req)

  Object.defineProperty(ws, 'url', {
    value: url.toString(),
    writable: false
  })

  // @ts-expect-error not a WS/WebSocket method
  ws.dispatchEvent = (evt: Event) => {
    if (evt.type === 'close') {
      ws.emit('close')
    }

    if (evt.type === 'open') {
      ws.emit('open')
    }

    if (evt.type === 'message') {
      const m = evt as MessageEvent
      ws.emit('data', m.data)
    }

    if (evt.type === 'error') {
      ws.emit('error', new Error('An error occurred'))
    }
    ws.emit(evt.type, evt)
  }

  // @ts-expect-error ws is now WebSocket
  return ws
}
