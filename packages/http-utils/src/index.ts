/**
 * @packageDocumentation
 *
 * Contains shared code and utilities used by `@libp2p/http-*` modules.
 */

import { InvalidParametersError, isPeerId, ProtocolError } from '@libp2p/interface'
import { peerIdFromString } from '@libp2p/peer-id'
import { fromStringTuples, isMultiaddr, multiaddr } from '@multiformats/multiaddr'
import { multiaddrToUri } from '@multiformats/multiaddr-to-uri'
import { uriToMultiaddr } from '@multiformats/uri-to-multiaddr'
import { queuelessPushable } from 'it-queueless-pushable'
import itToBrowserReadableStream from 'it-to-browser-readablestream'
import { base36 } from 'multiformats/bases/base36'
import { base64pad } from 'multiformats/bases/base64'
import { sha1 } from 'multiformats/hashes/sha1'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { DNS_CODECS, HTTP_CODEC, HTTP_PATH_CODEC } from './constants.js'
import { Request } from './request.js'
import type { AbortOptions, PeerId, Stream } from '@libp2p/interface'
import type { Multiaddr } from '@multiformats/multiaddr'
import type { Uint8ArrayList } from 'uint8arraylist'

/**
 * A subset of options passed to middleware
 */
export interface MiddlewareOptions extends AbortOptions {
  method: string
  headers: Headers
  middleware: Middleware[]
  credentials?: RequestCredentials
  keepalive?: boolean
  redirect?: RequestRedirect
  integrity?: string
  mode?: RequestMode
  referrer?: string
  referrerPolicy?: ReferrerPolicy
}

/**
 * Middleware that allows augmenting the client request/response with additional
 * fields or headers.
 */
export interface Middleware {
  /**
   * Called before a request is made
   */
  prepareRequest?(resource: URL | Multiaddr[], opts: MiddlewareOptions): void | Promise<void>

  /**
   * Called after a request is made but before the body has been read - the
   * processor may do any necessary housekeeping based on the server response
   */
  processResponse?(resource: URL | Multiaddr[], opts: MiddlewareOptions, response: Response): void | Promise<void>
}

export function toURL (resource: URL | Multiaddr[], headers: Headers): URL {
  if (resource instanceof URL) {
    return resource
  }

  const host = getHost(resource, headers)
  const { httpPath } = stripHTTPPath(resource)

  return new URL(`http://${host}${httpPath}`)
}

/**
 * Normalizes byte-like input to a `Uint8Array`
 */
export function toUint8Array (obj: DataView | ArrayBuffer | Uint8Array): Uint8Array {
  if (obj instanceof Uint8Array) {
    return obj
  }

  if (obj instanceof DataView) {
    return new Uint8Array(obj.buffer, obj.byteOffset, obj.byteLength)
  }

  return new Uint8Array(obj, 0, obj.byteLength)
}

export function streamToRequest (info: HeaderInfo, stream: Stream): globalThis.Request {
  const init: RequestInit = {
    method: info.method,
    headers: info.headers
  }

  if ((init.method !== 'GET' || info.upgrade) && init.method !== 'HEAD') {
    let source: AsyncGenerator<any> = stream.source

    if (!info.upgrade) {
      source = takeBytes(stream.source, info.headers.get('content-length'))
    }

    init.body = itToBrowserReadableStream<Uint8Array>(source)
    // @ts-expect-error this is required by NodeJS despite being the only reasonable option https://fetch.spec.whatwg.org/#requestinit
    init.duplex = 'half'
  }

  return new Request(normalizeUrl(info).toString(), init)
}

export async function responseToStream (res: Response, stream: Stream): Promise<void> {
  const pushable = queuelessPushable<Uint8Array>()
  stream.sink(pushable)
    .catch(err => {
      stream.abort(err)
    })

  await pushable.push(uint8ArrayFromString([
    `HTTP/1.1 ${res.status} ${res.statusText}`,
    ...writeHeaders(res.headers),
    '',
    ''
  ].join('\r\n')))

  if (res.body == null) {
    await pushable.end()
    return
  }

  const reader = res.body.getReader()
  let result = await reader.read()

  while (true) {
    if (result.value != null) {
      await pushable.push(result.value)
    }

    if (result.done) {
      break
    }

    result = await reader.read()
  }

  await pushable.end()

  await stream.closeWrite()
    .catch(err => {
      stream.abort(err)
    })
}

export const NOT_FOUND_RESPONSE = uint8ArrayFromString([
  'HTTP/1.1 404 Not Found',
  'Connection: close',
  '',
  ''
].join('\r\n'))

export const BAD_REQUEST = uint8ArrayFromString([
  'HTTP/1.1 400 Bad Request',
  'Connection: close',
  '',
  ''
].join('\r\n'))

export const INTERNAL_SERVER_ERROR = uint8ArrayFromString([
  'HTTP/1.1 500 Internal Server Error',
  'Connection: close',
  '',
  ''
].join('\r\n'))

export const NOT_IMPLEMENTED_ERROR = uint8ArrayFromString([
  'HTTP/1.1 501 Not Implemented',
  'Connection: close',
  '',
  ''
].join('\r\n'))

/**
 * Normalizes the dial target to a list of multiaddrs with an optionally
 * encapsulated suffix
 */
export function toMultiaddrs (peer: PeerId | Multiaddr | Multiaddr[], suffix?: string): Multiaddr[] {
  let mas: Multiaddr[]

  if (isPeerId(peer)) {
    mas = [
      multiaddr(`/p2p/${peer}`)
    ]
  } else if (Array.isArray(peer)) {
    mas = peer
  } else {
    mas = [
      peer
    ]
  }

  if (suffix != null) {
    mas = mas.map(ma => ma.encapsulate(suffix))
  }

  return mas
}

export function writeHeaders (headers: Headers): string[] {
  const output = []

  if (headers.get('Connection') == null) {
    headers.set('Connection', 'close')
  }

  for (const [key, value] of headers.entries()) {
    output.push(`${key}: ${value}`)
  }

  return output
}

async function * takeBytes (source: AsyncGenerator<Uint8ArrayList>, bytes?: number | string | null): AsyncGenerator<Uint8Array> {
  bytes = parseInt(`${bytes ?? ''}`)

  if (bytes == null || isNaN(bytes)) {
    return source
  }

  let count = 0

  for await (const buf of source) {
    count += buf.byteLength

    if (count > bytes) {
      yield buf.subarray(0, count - bytes)
      return
    }

    yield buf.subarray()

    if (count === bytes) {
      return
    }
  }
}

/**
 * Attempts to convert the passed `resource` into a HTTP(s) URL or an array of
 * multiaddrs.
 *
 * The returned URL should be handled by the global fetch, the multiaddr(s)
 * should be handled by libp2p.
 */
export function toResource (resource: string | URL | Multiaddr | Multiaddr[]): URL | Multiaddr[] {
  if (typeof resource === 'string') {
    if (resource.startsWith('/')) {
      resource = multiaddr(resource)
    } else {
      resource = new URL(resource)
    }
  }

  if (resource instanceof URL) {
    if (resource.protocol === 'multiaddr:') {
      resource = uriToMultiaddr(resource.toString())
    }
  }

  if (isMultiaddr(resource)) {
    resource = [resource]
  }

  // check for `/http/` tuple and transform to URL if present
  if (Array.isArray(resource)) {
    for (const ma of resource) {
      const stringTuples = ma.stringTuples()

      if (stringTuples.find(([codec]) => codec === HTTP_CODEC) != null) {
        const uri = multiaddrToUri(ma)
        return new URL(uri)
      }
    }
  }

  return resource
}

export function getHeaders (init: RequestInit = {}): Headers {
  if (init.headers instanceof Headers) {
    return init.headers
  }

  init.headers = new Headers(init.headers)

  return init.headers
}

export function getHeader (header: string, headers: HeadersInit = {}): string | undefined {
  if (headers instanceof Headers) {
    return headers.get(header) ?? undefined
  }

  if (Array.isArray(headers)) {
    return headers.find(([key, value]) => {
      if (key === header) {
        return value
      }

      return undefined
    })?.[1]
  }

  return headers[header]
}

function isValidHost (host?: string): host is string {
  return host != null && host !== ''
}

export function getHost (addresses: URL | Multiaddr[], headers: Headers): string {
  let host: string | undefined
  let port = 80
  let protocol = 'http:'

  if (addresses instanceof URL) {
    host = addresses.hostname
    port = parseInt(addresses.port, 10)
    protocol = addresses.protocol
  }

  if (!isValidHost(host)) {
    host = headers.get('host') ?? undefined
  }

  // try to extract domain from DNS addresses
  if (!isValidHost(host) && Array.isArray(addresses)) {
    for (const address of addresses) {
      const stringTuples = address.stringTuples()
      const filtered = stringTuples.filter(([key]) => DNS_CODECS.includes(key))?.[0]?.[1]

      if (filtered != null) {
        host = filtered
        break
      }
    }
  }

  // try to use remote PeerId as domain
  if (!isValidHost(host) && Array.isArray(addresses)) {
    for (const address of addresses) {
      const peerStr = address.getPeerId()

      // try to extract port from multiaddr if it is available
      try {
        const options = address.toOptions()
        port = options.port
      } catch {}

      if (peerStr != null) {
        const peerId = peerIdFromString(peerStr)
        // host has to be case-insensitive
        host = peerId.toCID().toString(base36)
        break
      }
    }
  }

  if (isValidHost(host)) {
    // add port if not standard
    if (protocol === 'http:' && port !== 80) {
      host = `${host}:${port}`
    }

    if (protocol === 'https:' && port !== 443) {
      host = `${host}:${port}`
    }

    return host
  }

  throw new InvalidParametersError('Could not determine request host name - a request must have a host header, be made to a DNS-based multiaddr or an http(s) URL')
}

export function stripHTTPPath (addresses: Multiaddr[]): { httpPath: string, addresses: Multiaddr[] } {
  // strip http-path tuple but record the value if set
  let httpPath = '/'
  addresses = addresses.map(ma => {
    return fromStringTuples(
      ma.stringTuples().filter(t => {
        if (t[0] === HTTP_PATH_CODEC && t[1] != null) {
          httpPath = `/${t[1]}`
        }

        return t[0] !== HTTP_PATH_CODEC
      })
    )
  })

  return {
    httpPath,
    addresses
  }
}

export function normalizeMethod (method?: string | string[], defaultMethod = ['GET']): string[] {
  if (method == null) {
    return defaultMethod
  }

  if (typeof method === 'string') {
    method = [method]
  }

  return method.map(m => m.toUpperCase())
}

/**
 * Returns a fully qualified URL representing the resource that is being
 * requested
 */
export function normalizeUrl (req: { url?: string, headers?: Headers | { host?: string } }): URL {
  const url = req.url ?? '/'

  if (url.startsWith('http')) {
    return new URL(url)
  }

  const host = getHostFromReq(req)

  return new URL(`http://${host}${url}`)
}

function getHostFromReq (req: any): string {
  let host = req.headers?.host

  if (host == null) {
    host = req.headers?.Host
  }

  if (host == null && typeof req.headers.get === 'function') {
    host = req.headers.get('host')
  }

  if (host == null) {
    throw new InvalidParametersError('Could not read host')
  }

  return host
}

export function isWebSocketUpgrade (method: string, headers: Headers): boolean {
  return method === 'GET' && headers.get('connection')?.toLowerCase() === 'upgrade' && headers.get('upgrade')?.toLowerCase() === 'websocket'
}

/**
 * Handles node.js-style headers for which the values can be string[]
 */
function getHeaderFromHeaders (headers: Headers | Record<string, string | string[] | undefined>, key: string): string | undefined {
  if (headers instanceof Headers) {
    return headers.get(key) ?? undefined
  }

  const header = headers[key]

  if (Array.isArray(header)) {
    return header.join(',')
  }

  return header
}

export async function getServerUpgradeHeaders (headers: Headers | Record<string, string | string[] | undefined>): Promise<Headers> {
  if (getHeaderFromHeaders(headers, 'sec-websocket-version') !== '13') {
    throw new ProtocolError('Invalid version')
  }

  const secWebSocketKey = getHeaderFromHeaders(headers, 'sec-websocket-key')

  if (secWebSocketKey == null) {
    throw new ProtocolError('Missing sec-websocket-key')
  }

  const token = `${secWebSocketKey}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`
  const hash = await sha1.digest(uint8ArrayFromString(token))
  const webSocketAccept = base64pad.encode(
    hash.digest
  ).substring(1)

  return new Headers({
    Upgrade: 'websocket',
    Connection: 'upgrade',
    'Sec-WebSocket-Accept': webSocketAccept
  })
}

/**
 * Parsed from the incoming HTTP message
 */
export interface HeaderInfo {
  versionMajor: number
  versionMinor: number
  headers: Headers
  method: string
  url: string
  statusCode: number
  statusMessage: string
  upgrade: boolean
  shouldKeepAlive: boolean
  raw: Uint8ArrayList
}

export * from './request.js'
export * from './response.js'
export * from './constants.js'
export * from './stream-to-socket.js'
