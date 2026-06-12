import { Cookies } from '../src/middleware/cookies.js'
import { expect } from 'aegir/chai'

describe('@libp2p/http', () => {
  it('ignores failures when stripping set-cookie from immutable response headers', async () => {
    const cookies = new Cookies({
      logger: {
        forComponent: () => () => {}
      }
    } as any)
    const response = new Response()

    Object.defineProperty(response, 'headers', {
      value: {
        getSetCookie: () => ['sid=abc'],
        has: (name: string) => name === 'set-cookie',
        delete: () => { throw new TypeError('immutable') }
      }
    })

    await expect(cookies.processResponse(new URL('https://example.com'), {
      headers: new Headers({ origin: 'https://example.com' })
    } as any, response)).to.eventually.be.undefined()
  })
})
