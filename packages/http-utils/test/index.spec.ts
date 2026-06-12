import { getHost } from '../src/index.js'
import { expect } from 'aegir/chai'

describe('@libp2p/http-utils', () => {
  it('does not append NaN for default URL ports', () => {
    expect(getHost(new URL('https://registration.libp2p.direct/v1/_acme-challenge'), new Headers())).to.equal('registration.libp2p.direct')
    expect(getHost(new URL('http://example.com/path'), new Headers())).to.equal('example.com')
  })

  it('appends explicit non-standard URL ports', () => {
    expect(getHost(new URL('https://example.com:8443/path'), new Headers())).to.equal('example.com:8443')
    expect(getHost(new URL('http://example.com:8080/path'), new Headers())).to.equal('example.com:8080')
  })
})
