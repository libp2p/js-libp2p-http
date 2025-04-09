import { stop } from '@libp2p/interface'
import { expect } from 'aegir/chai'
import { createServer } from '../src/http/index.js'
import { peerIdAuth } from '../src/peer-id-auth.js'
import { nodeServer } from '../src/servers/node.js'
import { createHttp } from './fixtures/create-http.js'
import { getClient, getListener } from './fixtures/get-libp2p.js'
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
    listener = await getListener(nodeServer(server))

    return listener.getMultiaddrs()
  },
  stopServer: async () => {
    await stop(listener)
  }
}/*, {
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
} */]

for (const test of tests) {
  describe.skip(`peer id auth - ${test.name}`, () => {
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
      const setResponse = await client.services.http.fetch(listenerMultiaddrs.map(ma => ma.encapsulate('/http-path/set-cookies')), {
        headers: {
          host: 'test-with-auth.com'
        },
        middleware: [
          peerIdAuth()
        ]
      })
      expect(setResponse.status).to.equal(201)
      expect(setResponse.headers.get('set-cookie')).to.not.be.ok()

      const getResponse = await client.services.http.fetch(listenerMultiaddrs.map(ma => ma.encapsulate('/http-path/get-cookies')), {
        headers: {
          host: 'test-with-cookies.com'
        }
      })
      expect(getResponse.status).to.equal(200)
      await expect(getResponse.json()).to.eventually.deep.equal([
        'cookie-1=value-1',
        'cookie-2=value-2'
      ])
    })
  })
}
