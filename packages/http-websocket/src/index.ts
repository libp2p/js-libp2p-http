import type { AbortOptions } from '@libp2p/interface'

export interface WebSocketEvents {
  'close': CloseEvent
  'error': Event
  'message': MessageEvent
  'open': Event
}

export interface CloseListener {
  (evt: CloseEvent): void
}

export interface ErrorListener {
  (evt: Event): void
}

export interface MessageListener {
  (evt: MessageEvent): void
}

export interface OpenListener {
  (evt: Event): void
}
/*
export interface WebSocket extends TypedEventTarget<WebSocketEvents> {
  CONNECTING: 0
  OPEN: 1
  CLOSING: 2
  CLOSED: 3
  binaryType: BinaryType
  bufferedAmount: number
  extensions: string
  protocol: string
  readyState: number
  url: string
  onopen: OpenListener | null
  onmessage: MessageListener | null
  onerror: ErrorListener | null
  onclose: CloseListener | null

  close (code?: number, reason?: string): void
  send (data: string | Blob | Uint8Array | ArrayBuffer | DataView): void
}
  */

export interface WebSocketInit extends AbortOptions {
  headers: Headers
  protocols?: string[]
  onHandshakeResponse?(res: Response): Promise<void>
}

export { WebSocket, RequestWebSocket, StreamWebSocket, ServerWebSocket } from './websocket.js'
export { CLOSE_CODES, CLOSE_MESSAGES } from './message.js'
