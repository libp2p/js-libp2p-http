import { streamPair } from '@libp2p/utils'
import { expect } from 'aegir/chai'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { getHost, readHeaders, streamToRequest } from '../src/index.ts'

describe('@libp2p/http-utils', () => {
  describe('getHost', () => {
    it('should omit default ports from URLs', () => {
      expect(getHost(new URL('http://example.com'), new Headers())).to.equal('example.com')
      expect(getHost(new URL('http://example.com:80'), new Headers())).to.equal('example.com')
      expect(getHost(new URL('https://example.com'), new Headers())).to.equal('example.com')
      expect(getHost(new URL('https://example.com:443'), new Headers())).to.equal('example.com')
      expect(getHost(new URL('ws://example.com'), new Headers())).to.equal('example.com')
      expect(getHost(new URL('ws://example.com:80'), new Headers())).to.equal('example.com')
      expect(getHost(new URL('wss://example.com'), new Headers())).to.equal('example.com')
      expect(getHost(new URL('wss://example.com:443'), new Headers())).to.equal('example.com')
    })

    it('should include non-default ports from URLs', () => {
      expect(getHost(new URL('http://example.com:8080'), new Headers())).to.equal('example.com:8080')
      expect(getHost(new URL('https://example.com:444'), new Headers())).to.equal('example.com:444')
      expect(getHost(new URL('ws://example.com:8080'), new Headers())).to.equal('example.com:8080')
      expect(getHost(new URL('wss://example.com:444'), new Headers())).to.equal('example.com:444')
    })
  })

  describe('readHeaders', () => {
    it('should leave a body that arrives with the headers on the stream', async () => {
      const [outboundStream, inboundStream] = await streamPair()

      outboundStream.send(uint8ArrayFromString('POST / HTTP/1.1\r\nHost: example.com\r\nContent-Length: 11\r\n\r\nhello world'))
      await outboundStream.close()

      const info = await readHeaders(inboundStream)

      expect(await streamToRequest(info, inboundStream).text()).to.equal('hello world')
    })
  })
})
