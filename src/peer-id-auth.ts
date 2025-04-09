import { publicKeyFromProtobuf, publicKeyToProtobuf } from '@libp2p/crypto/keys'
import { InvalidParametersError } from '@libp2p/interface'
import { peerIdFromPublicKey } from '@libp2p/peer-id'
import { toString as uint8ArrayToString, fromString as uint8ArrayFromString } from 'uint8arrays'
import { parseHeader, sign, verify } from './auth/common.js'
import { InvalidPeerError, InvalidSignatureError, MissingAuthHeaderError } from './auth/errors.js'
import { DEFAULT_AUTH_TOKEN_TTL, PEER_ID_AUTH_SCHEME } from './constants.js'
import { getCacheKey, getHost } from './utils.js'
import type { HTTP, RequestMiddleware, RequestOptions } from './index.js'
import type { AbortOptions, ComponentLogger, Logger, PeerId, PrivateKey } from '@libp2p/interface'
import type { Multiaddr } from '@multiformats/multiaddr'

interface AuthToken {
  peer: PeerId
  expires: number
  bearer: string
}

interface PeerIdAuthComponents {
  privateKey: PrivateKey
  logger: ComponentLogger
  http: HTTP
}

interface PeerIdAuthInit {
  verifyPeer?(peerId: PeerId): boolean | Promise<boolean>
  ttl?: number
}

class PeerIdAuth implements RequestMiddleware {
  private readonly components: PeerIdAuthComponents
  private readonly log: Logger
  private readonly tokens: Map<string, AuthToken>
  private readonly tokenTTL: number
  private readonly verifyPeer: (peerId: PeerId, options?: AbortOptions) => boolean | Promise<boolean>

  constructor (components: PeerIdAuthComponents, init: PeerIdAuthInit = {}) {
    this.components = components
    this.log = components.logger.forComponent('libp2p:http:peer-id-auth')
    this.tokens = new Map()
    this.tokenTTL = init.ttl ?? DEFAULT_AUTH_TOKEN_TTL
    this.verifyPeer = init.verifyPeer ?? (() => true)
  }

  async prepareRequest (resource: URL | Multiaddr[], opts: RequestOptions): Promise<void> {
    const existingAuthHeader = opts.headers.get('authorization')

    if (existingAuthHeader != null) {
      if (existingAuthHeader.includes('challenge-server')) {
        // we are already authenticating this request
        return
      }

      throw new InvalidParametersError('Will not overwrite existing Authorization header')
    }

    const token = await this.getOrCreateAuthToken(resource, opts)
    opts.headers.set('Authorization', token.bearer)
  }

  async getOrCreateAuthToken (resource: URL | Multiaddr[], opts: RequestOptions): Promise<AuthToken> {
    const key = getCacheKey(resource, opts.headers)
    let token = this.tokens.get(key)

    // check token expiry
    if (token?.expires != null && token?.expires < Date.now()) {
      this.tokens.delete(key)
      token = undefined
    }

    // create new token
    if (token == null) {
      token = await this.createAuthToken(resource, opts)
    }

    return token
  }

  async createAuthToken (resource: URL | Multiaddr[], opts: RequestOptions): Promise<AuthToken> {
    const hostname = getHost(resource, opts.headers)

    // Client initiated handshake (server initiated is not implemented yet)
    const marshalledClientPubKey = publicKeyToProtobuf(this.components.privateKey.publicKey)
    const publicKeyStr = uint8ArrayToString(marshalledClientPubKey, 'base64urlpad')
    const challengeServer = generateChallenge()

    // copy existing headers
    const challengeHeaders = new Headers(opts.headers)
    challengeHeaders.set('authorization', encodeAuthParams({
      'challenge-server': challengeServer,
      'public-key': publicKeyStr
    }))

    const resp = await this.components.http.fetch(resource, {
      method: 'OPTIONS',
      headers: challengeHeaders,
      signal: opts.signal,
      middleware: opts.middleware.map(m => () => m)
    })

    // verify the server's challenge
    const authHeader = resp.headers.get('www-authenticate')

    if (authHeader == null) {
      throw new MissingAuthHeaderError('No auth header')
    }

    const authFields = parseHeader(authHeader)
    const serverPubKeyBytes = uint8ArrayFromString(authFields['public-key'], 'base64urlpad')
    const serverPubKey = publicKeyFromProtobuf(serverPubKeyBytes)

    const valid = await verify(serverPubKey, PEER_ID_AUTH_SCHEME, [
      ['hostname', hostname],
      ['client-public-key', marshalledClientPubKey],
      ['challenge-server', challengeServer]], uint8ArrayFromString(authFields.sig, 'base64urlpad'))

    if (!valid) {
      throw new InvalidSignatureError('Invalid signature')
    }

    const serverPublicKey = publicKeyFromProtobuf(serverPubKeyBytes)
    const serverID = peerIdFromPublicKey(serverPublicKey)

    if (!await this.verifyPeer(serverID, { signal: opts.signal })) {
      throw new InvalidPeerError('Id check failed')
    }

    const sig = await sign(this.components.privateKey, PEER_ID_AUTH_SCHEME, [
      ['hostname', hostname],
      ['server-public-key', serverPubKeyBytes],
      ['challenge-client', authFields['challenge-client']]])

    const authenticateSelfHeaders = encodeAuthParams({
      opaque: authFields.opaque,
      sig: uint8ArrayToString(sig, 'base64urlpad')
    })

    const authToken = {
      peer: serverID,
      expires: Date.now() + this.tokenTTL,
      bearer: authenticateSelfHeaders
    }

    const key = getCacheKey(resource, opts.headers)
    this.tokens.set(key, authToken)

    return authToken
  }

  processResponse (resource: URL | Multiaddr[], opts: RequestOptions, response: Response): void {
    const serverAuthHeader = response.headers.get('authentication-info')

    if (serverAuthHeader != null) {
      const key = getCacheKey(resource, opts.headers)
      const token = this.tokens.get(key)

      if (token != null) {
        const serverAuthFields = parseHeader(serverAuthHeader)
        token.bearer = serverAuthFields.bearer
      }
    }
  }
}

export function peerIdAuth (init: PeerIdAuthInit = {}): (components: PeerIdAuthComponents) => RequestMiddleware {
  return (components) => {
    return new PeerIdAuth(components, init)
  }
}

function generateChallenge (): string {
  const randomBytes = new Uint8Array(32)
  crypto.getRandomValues(randomBytes)
  return uint8ArrayToString(randomBytes, 'base64urlpad')
}

function encodeAuthParams (params: Record<string, string>): string {
  const encodedParams = Object.entries(params)
    .map(([key, value]) => `${key}="${value}"`)
    .join(', ')

  return `${PEER_ID_AUTH_SCHEME} ${encodedParams}`
}
