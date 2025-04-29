/* eslint-disable no-console */
/* eslint-env mocha */

import { readHeaders, responseToStream, streamToRequest } from '@libp2p/http-utils'
import { defaultLogger } from '@libp2p/logger'
import { expect } from 'aegir/chai'
import drain from 'it-drain'
import { duplexPair } from 'it-pair/duplex'
import { stubInterface } from 'sinon-ts'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { fetch } from '../src/index.js'
import { cases } from './fixtures/cases.js'
import type { Stream } from '@libp2p/interface'

function serve (server: any, handler: (req: Request) => Response | Promise<Response>): void {
  const stream = stubInterface<Stream>({
    ...server,
    closeWrite: async () => {}
  })

  void Promise.resolve().then(async () => {
    const info = await readHeaders(stream)
    const res = await handler(streamToRequest(info, stream))
    await responseToStream(res, stream)
  })
}

function echo (server: any): void {
  serve(server, (req) => {
    return new Response(req.body, {
      headers: req.headers
    })
  })
}

describe('@libp2p/http-fetch', () => {
  it('should make a simple GET request', async () => {
    const [client, server] = duplexPair<any>()

    serve(server, (req) => {
      return new Response('Hello World')
    })

    const res = await fetch(stubInterface<Stream>(client), 'https://example.com', {
      logger: defaultLogger()
    })

    expect(await res.text()).to.equal('Hello World')
  })

  it('should GET with headers', async () => {
    const [client, server] = duplexPair<any>()

    echo(server)

    const res = await fetch(stubInterface<Stream>(client), 'https://example.com', {
      logger: defaultLogger(),
      headers: {
        'X-Test': 'foo'
      }
    })

    expect(res.headers.get('X-Test')).to.equal('foo')
  })

  it('should POST some data', async () => {
    const [client, server] = duplexPair<any>()

    echo(server)

    const res = await fetch(stubInterface<Stream>(client), 'https://example.com', {
      logger: defaultLogger(),
      method: 'POST',
      body: 'Hello World'
    })

    expect(await res.text()).to.equal('Hello World')
  })

  it('should handle trash', async () => {
    const [client, server] = duplexPair<any>()

    void server.sink([uint8ArrayFromString('FOOOOOOOOOOOOOOOOo')])
    void drain(server.source)

    await expect(fetch(stubInterface<Stream>(client), 'https://example.com', {
      logger: defaultLogger()
    })).to.eventually.be.rejected()
      .with.property('name', 'InvalidResponseError')
  })

  it('should handle messages that arrive in a trickle', async () => {
    for (const httpCase of cases.filter(c => c.type === 'RESPONSE' && c.mayFail !== true)) {
      const expectedStatusCode = httpCase.statusCode

      if (expectedStatusCode === undefined || expectedStatusCode === null) {
        continue
      }

      if (expectedStatusCode < 200 || expectedStatusCode >= 600) {
        // Response object doesn't parse these
        continue
      }

      if (httpCase?.httpMajor !== 1 || httpCase?.httpMinor !== 1) {
        // We don't use anything but HTTP/1.1
        continue
      }

      const [client, server] = duplexPair<any>()

      void server.sink((async function * () {
        const rawHttp = new TextEncoder().encode(httpCase.raw)
        // Trickle the response 1 byte at a time
        for (let i = 0; i < rawHttp.length; i++) {
          yield rawHttp.subarray(i, i + 1)
        }
      })())
      void drain(server.source)

      // Request doesn't matter
      const resp = await fetch(stubInterface<Stream>(client), 'https://example.com', {
        logger: defaultLogger()
      })

      expect(resp.status).to.equal(expectedStatusCode)
      const chunk = <T>(arr: T[], size: number): T[][] => arr.reduce<T[][]>((chunks, el, i) => i % size === 0 ? [...chunks, [el]] : (chunks[chunks.length - 1].push(el), chunks), [])
      for (const [key, value] of chunk<string>(httpCase.headers, 2)) {
        expect(resp.headers.get(key)).to.equal(value)
      }

      expect(await resp.text()).to.equal(httpCase.body ?? '')
    }
  })

  it('Parses all responses', async () => {
    for (const httpCase of cases.filter(c => c.type === 'RESPONSE' && c.mayFail !== true)) {
      const expectedStatusCode = httpCase.statusCode

      if (expectedStatusCode === undefined || expectedStatusCode === null) {
        continue
      }

      if (expectedStatusCode < 200 || expectedStatusCode >= 600) {
        // Response object doesn't parse these
        continue
      }

      if (httpCase?.httpMajor !== 1 || httpCase?.httpMinor !== 1) {
        // We don't use anything but HTTP/1.1
        continue
      }

      const [client, server] = duplexPair<any>()

      void server.sink([uint8ArrayFromString(httpCase.raw)])
      void drain(server.source)

      // Request doesn't matter
      const resp = await fetch(stubInterface<Stream>(client), 'https://example.com', {
        logger: defaultLogger()
      })

      expect(resp.status).to.equal(expectedStatusCode)
      const chunk = <T>(arr: T[], size: number): T[][] => arr.reduce<T[][]>((chunks, el, i) => i % size === 0 ? [...chunks, [el]] : (chunks[chunks.length - 1].push(el), chunks), [])
      for (const [key, value] of chunk<string>(httpCase.headers, 2)) {
        expect(resp.headers.get(key)).to.equal(value)
      }

      expect(await resp.text()).to.equal(httpCase.body ?? '')
    }
  })
})
