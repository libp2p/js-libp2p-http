import type { Readable } from 'node:stream'

export function readableToReadableStream (readable: Readable): ReadableStream {
  return new ReadableStream({
    start (controller) {
      readable.on('data', buf => {
        controller.enqueue(buf)

        // pause until more data requested (backpressure)
        readable.pause()
      })
      readable.on('end', () => {
        controller.close()
      })
      readable.on('error', (err) => {
        controller.error(err)
      })
    },
    pull () {
      // let data flow again
      readable.resume()
    }
  })
}
