import { Agent as NodeAgent } from 'node:http'
import { streamToSocket, toResource } from '@libp2p/http-utils'
import { isPeerId } from '@libp2p/interface'
import { Agent as UndiciAgent } from 'undici'
import { HTTP_PROTOCOL } from './constants.js'
import { HTTP as HTTPBrowser } from './http.browser.js'
import type { HTTP as HTTPInterface } from './index.js'
import type { AbortOptions, PeerId } from '@libp2p/interface'
import type { ConnectionManager, Registrar } from '@libp2p/interface-internal'
import type { Multiaddr } from '@multiformats/multiaddr'
import type { Agent, AgentOptions } from 'node:http'
import type { Socket, TcpNetConnectOpts } from 'node:net'
import type { Dispatcher } from 'undici'

export type { HTTPComponents } from './http.browser.js'

async function createConnection (connectionManager: ConnectionManager, peer: PeerId | Multiaddr | Multiaddr[], options?: AbortOptions): Promise<Socket> {
  const connection = await connectionManager.openConnection(peer, options)
  const stream = await connection.newStream(HTTP_PROTOCOL, options)

  return streamToSocket(stream, connection)
}

interface HTTPDispatcherComponents {
  connectionManager: ConnectionManager
}

interface HTTPDispatcherInit extends UndiciAgent.Options {
  peer: PeerId | Multiaddr | Multiaddr[]
}

export class Libp2pDispatcher extends UndiciAgent {
  constructor (components: HTTPDispatcherComponents, init: HTTPDispatcherInit) {
    super({
      ...init,
      connect: (options, cb) => {
        createConnection(components.connectionManager, init.peer, {
          // @ts-expect-error types are wonky
          signal: options.timeout != null ? AbortSignal.timeout(options.timeout) : undefined
        })
          .then(socket => {
            cb(null, socket)
          }, err => {
            cb(err, null)
          })
      }
    })
  }
}

interface HTTPAgentComponents {
  connectionManager: ConnectionManager
}

interface HTTPAgentInit extends AgentOptions {
  peer: PeerId | Multiaddr | Multiaddr[]
}

class Libp2pAgent extends NodeAgent {
  public readonly keepAliveMsecs: number = 100
  private readonly components: HTTPAgentComponents
  private readonly peer: PeerId | Multiaddr | Multiaddr[]

  constructor (components: HTTPAgentComponents, init: HTTPAgentInit) {
    super(init)
    this.components = components
    this.peer = init.peer
  }

  // @ts-expect-error types are wrong
  createConnection (options: TcpNetConnectOpts, cb: (err?: Error, socket?: Socket) => void): void {
    createConnection(this.components.connectionManager, this.peer, options)
      .then(socket => {
        cb(undefined, socket)
      }, err => {
        cb(err)
      })
  }
}

export interface HTTPClientComponents {
  registrar: Registrar
  connectionManager: ConnectionManager
}

export class HTTP extends HTTPBrowser implements HTTPInterface {
  agent (peer: PeerId | Multiaddr | Multiaddr[], options?: AgentOptions): Agent {
    if (!isPeerId(peer) && toResource(peer) instanceof URL) {
      return new NodeAgent(options)
    }

    // @ts-expect-error types are wrong
    return new Libp2pAgent(this.components, {
      ...options,
      peer
    })
  }

  dispatcher (peer: PeerId | Multiaddr | Multiaddr[], options?: UndiciAgent.Options): Dispatcher {
    if (!isPeerId(peer) && toResource(peer) instanceof URL) {
      return new UndiciAgent(options)
    }

    return new Libp2pDispatcher(this.components, {
      ...options,
      peer
    })
  }
}
