import { responseToStream, streamToRequest } from '@libp2p/http-utils'
import type { WebServer } from '@libp2p/http'
import type { HeaderInfo } from '@libp2p/http-utils'
import type { Stream, Connection } from '@libp2p/interface'

export interface Fetch {
  (req: Request): Promise<Response>
}

export interface FetchServerInit {
  server: Fetch
}

class FetchServer implements WebServer {
  private readonly server: Fetch

  constructor (init: FetchServerInit) {
    this.server = init.server
  }

  async inject (info: HeaderInfo, stream: Stream, connection: Connection): Promise<void> {
    const res = await this.server(streamToRequest(info, stream))
    await responseToStream(res, stream)
  }
}

/**
 * A WebServer implementation that lets W3C Request/Response-orientated servers
 * accept incoming HTTP requests opened over libp2p streams
 */
export function fetchServer (server: Fetch): WebServer {
  return new FetchServer({ server })
}
