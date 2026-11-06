import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'

export function stringBody (str: string, headers: Headers): ReadableStream {
  const bytes = uint8ArrayFromString(str)
  headers.set('Content-Length', `${bytes.byteLength}`)
  headers.set('Content-Type', 'text/plain; charset="UTF-8"')

  return new ReadableStream({
    start (controller) {
      controller.enqueue(bytes)
      controller.close()
    }
  })
}
