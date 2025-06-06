import { toUint8Array } from '@libp2p/http-utils'

export function bytesBody (bytes: Uint8Array, headers: Headers): ReadableStream {
  headers.set('Content-Length', `${bytes.byteLength}`)
  headers.set('Content-Type', 'application/octet-stream')

  return new ReadableStream({
    start (controller) {
      controller.enqueue(toUint8Array(bytes))
      controller.close()
    }
  })
}
