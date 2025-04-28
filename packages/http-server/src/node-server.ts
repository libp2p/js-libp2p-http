import { streamToSocket } from '@libp2p/http-utils'
import type { WebServer } from '@libp2p/http'
import type { HeaderInfo } from '@libp2p/http-utils'
import type { Stream, Connection } from '@libp2p/interface'
import type { Socket } from 'node:net'

export interface ConnectionHandler {
  emit (event: 'connection', socket: Socket): void
}

export interface NodeServerInit {
  server: ConnectionHandler
}

class NodeServer implements WebServer {
  private readonly server: ConnectionHandler

  constructor (init: NodeServerInit) {
    this.server = init.server
  }

  async inject (info: HeaderInfo, stream: Stream, connection: Connection): Promise<void> {
    // re-yield the headers to enable node to set up the request properly
    const streamSource = stream.source
    stream.source = (async function * () {
      yield info.raw
      yield * streamSource
    })()

    this.server.emit('connection', streamToSocket(stream, connection))
  }
}

/**
 * A WebServer implementation that lets `node.HTTPServer` instances accept
 * incoming HTTP requests opened over libp2p streams
 */
export function nodeServer (server: ConnectionHandler): WebServer {
  return new NodeServer({ server })
}
