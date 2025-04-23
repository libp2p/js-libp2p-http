import { stop } from '@libp2p/interface'
import { multiaddr } from '@multiformats/multiaddr'
import { expect } from 'aegir/chai'
import pDefer from 'p-defer'
import { pEvent } from 'p-event'
import { createServer } from '../src/http/index.js'
import { peerIdAuth } from '../src/middleware/peer-id-auth.js'
import { nodeServer } from '../src/servers/node.js'
import { createHttp } from './fixtures/create-http.js'
import { getClient, getHTTPOverLibp2pHandler } from './fixtures/get-libp2p.js'
import type { HTTP } from '../src/index.js'
import type { Multiaddr } from '@multiformats/multiaddr'
import type { Libp2p } from 'libp2p'

interface Test {
  name: string
  startServer(): Promise<Multiaddr[]>
  stopServer(): Promise<void>
}

let listener: Libp2p<{ http: HTTP }>

const tests: Test[] = [{
  name: 'in-process server',
  startServer: async () => {
    const server = createHttp(createServer())
    listener = await getHTTPOverLibp2pHandler(nodeServer(server))

    return listener.getMultiaddrs()
  },
  stopServer: async () => {
    await stop(listener)
  }
}, {
  name: 'js',
  startServer: async () => {
    return [
      multiaddr(process.env.LIBP2P_JS_HTTP_MULTIADDR ?? '')
    ]
  },
  stopServer: async () => {

  }
}, {
  name: 'node:http',
  startServer: async () => {
    return [
      multiaddr(process.env.LIBP2P_NODE_HTTP_MULTIADDR ?? '')
    ]
  },
  stopServer: async () => {

  }
}, {
  name: 'express/js',
  startServer: async () => {
    return [
      multiaddr(process.env.LIBP2P_JS_EXPRESS_MULTIADDR ?? '')
    ]
  },
  stopServer: async () => {

  }
}, {
  name: 'express/node:http',
  startServer: async () => {
    return [
      multiaddr(process.env.LIBP2P_NODE_EXPRESS_MULTIADDR ?? '')
    ]
  },
  stopServer: async () => {

  }
}, {
  name: 'fastify/js',
  startServer: async () => {
    return [
      multiaddr(process.env.LIBP2P_JS_FASTIFY_MULTIADDR ?? '')
    ]
  },
  stopServer: async () => {

  }
}, {
  name: 'fastify/node:http',
  startServer: async () => {
    return [
      multiaddr(process.env.LIBP2P_NODE_FASTIFY_MULTIADDR ?? '')
    ]
  },
  stopServer: async () => {

  }
}]

for (const test of tests) {
  describe(`peer id auth - ${test.name}`, () => {
    let client: Libp2p<{ http: HTTP }>
    let listenerMultiaddrs: Multiaddr[]

    beforeEach(async () => {
      client = await getClient()
      listenerMultiaddrs = await test.startServer()
    })

    afterEach(async () => {
      await stop(client)
      await test.stopServer()
    })

    it('should support peer id auth', async () => {
      const response = await client.services.http.fetch(listenerMultiaddrs.map(ma => ma.encapsulate(`/http-path/${encodeURIComponent('libp2p/http/peer-id')}`)), {
        headers: {
          host: 'test-with-auth.com'
        },
        middleware: [
          peerIdAuth()
        ]
      })
      expect(response.status).to.equal(200)
      await expect(response.text()).to.eventually.equal(client.peerId.toString())
    })

    it('should support optional peer id auth', async () => {
      const response = await client.services.http.fetch(listenerMultiaddrs.map(ma => ma.encapsulate(`/http-path/${encodeURIComponent('libp2p/http/optional-peer-id')}`)), {
        headers: {
          host: 'test-with-auth.com'
        },
        middleware: [
          peerIdAuth()
        ]
      })
      expect(response.status).to.equal(200)
      await expect(response.text()).to.eventually.equal(client.peerId.toString())
    })

    it('should support optional peer id auth without auth', async () => {
      const response = await client.services.http.fetch(listenerMultiaddrs.map(ma => ma.encapsulate(`/http-path/${encodeURIComponent('libp2p/http/optional-peer-id')}`)), {
        headers: {
          host: 'test-with-auth.com'
        }
      })
      expect(response.status).to.equal(200)
      await expect(response.text()).to.eventually.equal('no-peer-id')
    })

    it('should support WebSocket peer id auth', async () => {
      const deferred = pDefer<string>()
      const socket = await client.services.http.connect(listenerMultiaddrs.map(ma => ma.encapsulate(`/http-path/${encodeURIComponent('libp2p/http/ws-peer-id')}`)), {
        headers: {
          host: 'test-with-auth.com'
        },
        middleware: [
          peerIdAuth()
        ]
      })

      if (socket.readyState !== WebSocket.OPEN) {
        await pEvent(socket, 'open')
      }

      socket.addEventListener('error', (evt: any) => {
        deferred.reject(evt.error)
      })
      socket.addEventListener('close', () => {
        deferred.reject(new Error('Socket closed before message received'))
      })
      socket.addEventListener('message', (evt) => {
        deferred.resolve(new TextDecoder().decode(evt.data))
      })

      await expect(deferred.promise).to.eventually.equal(client.peerId.toString())
    })

    it('should support WebSocket optional peer id auth', async () => {
      const deferred = pDefer<string>()
      const socket = await client.services.http.connect(listenerMultiaddrs.map(ma => ma.encapsulate(`/http-path/${encodeURIComponent('libp2p/http/ws-optional-peer-id')}`)), {
        headers: {
          host: 'test-with-auth.com'
        },
        middleware: [
          peerIdAuth()
        ]
      })

      if (socket.readyState !== WebSocket.OPEN) {
        await pEvent(socket, 'open')
      }

      socket.addEventListener('error', (evt: any) => {
        deferred.reject(evt.error)
      })
      socket.addEventListener('close', () => {
        deferred.reject(new Error('Socket closed before message received'))
      })
      socket.addEventListener('message', (evt) => {
        deferred.resolve(new TextDecoder().decode(evt.data))
      })

      await expect(deferred.promise).to.eventually.equal(client.peerId.toString())
    })

    it('should support WebSocket optional peer id auth without auth', async () => {
      const deferred = pDefer<string>()
      const socket = await client.services.http.connect(listenerMultiaddrs.map(ma => ma.encapsulate(`/http-path/${encodeURIComponent('libp2p/http/ws-optional-peer-id')}`)), {
        headers: {
          host: 'test-with-auth.com'
        }
      })

      if (socket.readyState !== WebSocket.OPEN) {
        await pEvent(socket, 'open')
      }

      socket.addEventListener('error', (evt: any) => {
        deferred.reject(evt.error)
      })
      socket.addEventListener('close', () => {
        deferred.reject(new Error('Socket closed before message received'))
      })
      socket.addEventListener('message', (evt) => {
        deferred.resolve(new TextDecoder().decode(evt.data))
      })

      await expect(deferred.promise).to.eventually.equal('no-peer-id')
    })

    it('should fall back to HTTP on WebSocket route with peer id auth', async () => {
      const response = await client.services.http.fetch(listenerMultiaddrs.map(ma => ma.encapsulate(`/http-path/${encodeURIComponent('libp2p/http/ws-peer-id')}`)), {
        headers: {
          host: 'test-with-auth.com'
        },
        middleware: [
          peerIdAuth()
        ]
      })
      expect(response.status).to.equal(200)
      await expect(response.text()).to.eventually.equal(client.peerId.toString())
    })

    it('should fall back to HTTP on WebSocket route with optional peer id auth', async () => {
      const response = await client.services.http.fetch(listenerMultiaddrs.map(ma => ma.encapsulate(`/http-path/${encodeURIComponent('libp2p/http/ws-optional-peer-id')}`)), {
        headers: {
          host: 'test-with-auth.com'
        },
        middleware: [
          peerIdAuth()
        ]
      })
      expect(response.status).to.equal(200)
      await expect(response.text()).to.eventually.equal(client.peerId.toString())
    })

    it('should fall back to HTTP on WebSocket route with optional peer id auth without auth', async () => {
      const response = await client.services.http.fetch(listenerMultiaddrs.map(ma => ma.encapsulate(`/http-path/${encodeURIComponent('libp2p/http/ws-optional-peer-id')}`)), {
        headers: {
          host: 'test-with-auth.com'
        }
      })
      expect(response.status).to.equal(200)
      await expect(response.text()).to.eventually.equal('no-peer-id')
    })
  })
}
