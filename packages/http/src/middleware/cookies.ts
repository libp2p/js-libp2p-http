import { toURL } from '@libp2p/http-utils'
import cookie from 'cookie'
import type { Middleware, MiddlewareOptions } from '@libp2p/http-utils'
import type { ComponentLogger, Logger } from '@libp2p/interface'
import type { Multiaddr } from '@multiformats/multiaddr'

interface CookiesComponents {
  logger: ComponentLogger
}

export interface CookiesInit {
  cookieExpiryCheckInterval?: number
}

interface Cookie {
  name: string
  value: string
  expires?: number
  domain?: string
  path?: string
}

export class Cookies implements Middleware {
  private readonly log: Logger
  private readonly cookies: Map<string, Cookie[]>

  constructor (components: CookiesComponents, init: CookiesInit = {}) {
    this.log = components.logger.forComponent('libp2p:http:cookies')
    this.cookies = new Map()
  }

  async prepareRequest (resource: URL | Multiaddr[], opts: MiddlewareOptions): Promise<void> {
    const credentials = opts.credentials ?? 'same-origin'

    if (credentials === 'omit') {
      return
    }

    const origin = opts.headers.get('origin')

    if (origin == null || origin === 'null') {
      return
    }

    const url = toURL(resource, opts.headers)
    const cookies = (this.cookies.get(url.hostname) ?? []).filter(cookie => {
      if (cookie.expires != null && cookie.expires < Date.now()) {
        return false
      }

      if (cookie.path != null && !url.pathname.startsWith(cookie.path)) {
        return false
      }

      return true
    })
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ')

    if (cookies.length > 0) {
      opts.headers.set('cookie', cookies)
    }
  }

  async processResponse (resource: URL | Multiaddr[], opts: MiddlewareOptions, response: Response): Promise<void> {
    const credentials = opts.credentials ?? 'same-origin'

    if (credentials === 'omit') {
      removeSetCookie(response)
      return
    }

    const origin = opts.headers.get('origin')

    if (origin == null || origin === 'null') {
      return
    }

    const url = toURL(resource, opts.headers)
    for (const value of response.headers.getSetCookie()) {
      const cookies = [
        ...(this.cookies.get(url.hostname) ?? []),
        ...toCookies(cookie.parse(value))
      ]

      this.cookies.set(url.hostname, cookies)
    }

    removeSetCookie(response)
  }
}

/**
 * the fetch spec requires not exposing set-cookie to client code
 */
function removeSetCookie (response: Response): Response {
  if (response.headers.has('set-cookie')) {
    response.headers.delete('set-cookie')
  }

  return response
}

function toCookies (parsed: Record<string, string | undefined>): Cookie[] {
  const metadata: Omit<Cookie, 'name' | 'value'> = {}
  const output: Cookie[] = []

  Object.entries(parsed).forEach(([name, value]) => {
    if (name.toLowerCase() === 'domain' && value != null) {
      metadata.domain = value
    }

    if (name.toLowerCase() === 'max-age' && value != null) {
      metadata.expires = Date.now() + (parseInt(value, 10) * 1000)
    }

    if (!COOKIE_FIELDS.includes(name.toLowerCase()) && value != null) {
      output.push({
        name,
        value
      })
    }
  })

  return output.map(c => ({
    ...c,
    ...metadata
  }))
}

const COOKIE_FIELDS = [
  'domain',
  'expires',
  'httponly',
  'max-age',
  'partitioned',
  'path',
  'samesite',
  'secure'
]
