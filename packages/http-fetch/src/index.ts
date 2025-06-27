/**
 * @packageDocumentation
 *
 * This is an implementation of the [fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
 * that uses libp2p streams as the underlying transport layer, instead of a TCP
 * socket.
 */

import { byteStream } from 'it-byte-stream'
import { readResponse } from './read-response.js'
import { sendRequest } from './send-request.js'
import type { ComponentLogger, Logger, Stream } from '@libp2p/interface'

export interface FetchInit extends RequestInit {
  logger: ComponentLogger

  /**
   * The maximum number of bytes that will be parsed as headers, defaults to
   * 80KB
   *
   * @default 81_920
   */
  maxHeaderSize?: number
}

export interface SendRequestInit extends RequestInit {
  log: Logger
  maxHeaderSize?: number
}

export async function fetch (stream: Stream, resource: string | URL, init: FetchInit): Promise<Response> {
  const log = init.logger.forComponent('libp2p:http:fetch')
  resource = typeof resource === 'string' ? new URL(resource) : resource
  const bytes = byteStream(stream)

  await sendRequest(bytes, resource, {
    ...init,
    log
  })

  return readResponse(bytes, resource, {
    ...init,
    log
  })
}
