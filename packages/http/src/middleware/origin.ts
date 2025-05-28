import { toURL } from '@libp2p/http-utils'
import type { Middleware, MiddlewareOptions } from '@libp2p/http-utils'
import type { Multiaddr } from '@multiformats/multiaddr'

export class Origin implements Middleware {
  async prepareRequest (resource: URL | Multiaddr[], opts: MiddlewareOptions): Promise<void> {
    if (opts.headers.get('origin') != null) {
      return
    }

    if (opts.mode === 'no-cors') {
      return
    }

    const url = toURL(resource, opts.headers)

    opts.headers.set('origin', `${url.protocol}//${url.host}`)
  }
}
