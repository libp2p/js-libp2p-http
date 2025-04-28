import { writeHeaders } from '@libp2p/http-utils'
import { fromString as uint8arrayFromString } from 'uint8arrays/from-string'
import { normalizeContent } from './utils.js'
import type { SendRequestInit } from './index.js'
import type { Stream } from '@libp2p/interface'
import type { ByteStream } from 'it-byte-stream'

export async function sendRequest (bytes: ByteStream<Stream>, url: URL, init: SendRequestInit): Promise<void> {
  const headers = new Headers(init.headers)

  const host = headers.get('host') ?? url.hostname
  headers.set('host', host)

  if (headers.get('user-agent') == null) {
    headers.set('user-agent', 'libp2p/fetch')
  }

  const content = normalizeContent(init.body, headers)

  const req = [
    `${init?.method?.toUpperCase() ?? 'GET'} ${url.pathname ?? '/'} HTTP/1.1`,
    ...writeHeaders(headers),
    '',
    ''
  ]

  await bytes.write(uint8arrayFromString(req.join('\r\n')), {
    signal: init.signal ?? undefined
  })

  if (content != null) {
    init.log('request sending body')
    await sendBody(bytes, content, init)
  }
}

async function sendBody (bytes: ByteStream<Stream>, stream: ReadableStream<Uint8Array>, init: SendRequestInit): Promise<void> {
  const reader = stream.getReader()

  while (true) {
    const { done, value } = await reader.read()

    if (value != null) {
      init.log('request send %d bytes', value.byteLength)
      await bytes.write(value, {
        signal: init.signal ?? undefined
      })
    }

    if (done) {
      init.log('request finished sending body')
      break
    }
  }
}
