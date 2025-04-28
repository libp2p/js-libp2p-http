import { peerIdAuth } from '@libp2p/http/middleware'
import { nodeServer } from '@libp2p/http-server'
import { createServer } from '@libp2p/http-server/node'
import { stop } from '@libp2p/interface'
import { multiaddr } from '@multiformats/multiaddr'
import { expect } from 'aegir/chai'
import pDefer from 'p-defer'
import { pEvent } from 'p-event'
import { createHttp } from './fixtures/create-http.js'
import { getClient, getHTTPOverLibp2pHandler } from './fixtures/get-libp2p.js'
import type { HTTP } from '@libp2p/http'
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
    listener = await getHTTPOverLibp2pHandler(nodeServer(createHttp(createServer())))

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

    /*
    it('should mutually authenticate with a custom port', async () => {
      const clientAuth = new ClientAuth(clientKey)
      const serverAuth = new ServerAuth(serverKey, h => h === 'foobar:12345')

      const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const req = new Request(input, init)
        const resp = await serverAuth.httpHandler(req)
        return resp
      }

      const observedServerPeerId = await clientAuth.authenticateServer('https://foobar:12345/auth', {
        fetch
      })
      expect(observedServerPeerId.equals(server)).to.be.true()
    })

    it('should time out when authenticating', async () => {
      const clientAuth = new ClientAuth(clientKey)

      const controller = new AbortController()
      controller.abort()

      await expect(clientAuth.authenticateServer('https://example.com/auth', {
        signal: controller.signal
      })).to.eventually.be.rejected
        .with.property('name', 'AbortError')
    })

    it('should sent request body to authenticated server', async () => {
      const clientAuth = new ClientAuth(clientKey)
      const serverAuth = new ServerAuth(serverKey, h => h === 'example.com')

      const echoHandler = async (req: Request): Promise<Response> => {
        return new Response(await req.text())
      }
      const httpHandler = serverAuth.withAuth(async (clientId, req) => { return echoHandler(req) })

      const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const req = new Request(input, init)
        return httpHandler(req)
      }

      const expectedBody = 'Only for authenticated servers!'
      const response = await clientAuth.authenticatedFetch('https://example.com/auth', { method: 'POST', body: expectedBody, verifyPeer: (observedId) => observedId.equals(server), fetch })

      expect((await response.text())).to.be.equal(expectedBody)
      expect(response.peer.equals(server)).to.be.true()
    })
    */
  })
}
