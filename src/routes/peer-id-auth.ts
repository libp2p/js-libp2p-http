import { publicKeyFromProtobuf, publicKeyToProtobuf } from '@libp2p/crypto/keys'
import { peerIdFromPublicKey, peerIdFromString } from '@libp2p/peer-id'
import { toString as uint8ArrayToString, fromString as uint8ArrayFromString } from 'uint8arrays'
import { encodeAuthParams, parseHeader, sign, verify } from '../auth/common.js'
import { DEFAULT_AUTH_TOKEN_TTL, WEBSOCKET_HANDLER } from '../constants.js'
import { normalizeMethod } from '../utils.js'
import { webSocketRoute } from './websocket.js'
import { initializeRoute } from './index.js'
import type { HTTPRoute, HandlerRoute } from './index.js'
import type { ComponentLogger, Logger, PeerId, PrivateKey, PublicKey } from '@libp2p/interface'

export const PeerIDAuthScheme = 'libp2p-PeerID'
export const HTTPPeerIDAuthProto = '/http-peer-id-auth/1.0.0'

interface PeerIdAuthComponents {
  privateKey: PrivateKey
  logger: ComponentLogger
}

interface OpaqueUnwrapped {
  challengeClient: string
  clientPublicKey?: string
  hostname: string
  creationTime: number
}

interface AuthenticationResult {
  status: number
  headers?: Headers
  peer?: PeerId | undefined
}

interface PeerIdAuthInit {
  tokenTTL?: number
  verifyHostname?(hostname: string): boolean | Promise<boolean>
}

export class PeerIdAuth {
  private readonly components: PeerIdAuthComponents
  public readonly log: Logger
  private readonly tokenTTL: number
  private readonly verifyHostname: (hostname: string) => boolean | Promise<boolean>

  constructor (components: PeerIdAuthComponents, init: PeerIdAuthInit) {
    this.components = components
    this.log = components.logger.forComponent('libp2p:http:server-peer-id-auth')
    this.tokenTTL = init.tokenTTL ?? DEFAULT_AUTH_TOKEN_TTL

    this.verifyHostname = init.verifyHostname ?? (() => true)
  }

  /* eslint-disable-next-line complexity */
  public async authenticateRequest (hostname: string, authHeader?: string | null): Promise<AuthenticationResult> {
    if (!(await this.verifyHostname(hostname))) {
      this.log.error('hostname verification failed')
      return { status: 400 }
    }

    if (authHeader == null || authHeader === '') {
      return this.returnChallenge(hostname, null, {})
    }

    const authFields = parseHeader(authHeader)
    if (authFields.bearer !== undefined && authFields.bearer !== '') {
      const peer = await this.unwrapBearerToken(hostname, authFields.bearer)
      return { status: 200, peer }
    }

    let opaqueState: OpaqueUnwrapped | undefined
    if (authFields.opaque !== undefined) {
      try {
        const opaque = await this.unwrapOpaque(authFields.opaque)
        if (opaque.hostname !== hostname) {
          this.log.error('invalid hostname')
          return { status: 400 }
        }
        if (Date.now() - opaque.creationTime > this.tokenTTL) {
          this.log.error('token expired')
          return { status: 400 }
        }

        opaqueState = opaque
      } catch (e) {
        this.log.error('invalid opaque')
        return { status: 400 }
      }
    }

    let clientPublicKey: PublicKey | null = null
    if (opaqueState?.clientPublicKey !== undefined) {
      clientPublicKey = publicKeyFromProtobuf(uint8ArrayFromString(opaqueState.clientPublicKey, 'base64urlpad'))
    } else if (authFields['public-key'] !== undefined) {
      clientPublicKey = publicKeyFromProtobuf(uint8ArrayFromString(authFields['public-key'], 'base64urlpad'))
    }

    const returnParams: Record<string, string> = {}
    let clientPeerId: PeerId | undefined
    if (authFields.sig !== undefined) {
      // Verify signature
      if (clientPublicKey === null) {
        this.log.error('missing public-key')
        return { status: 400 }
      }
      if (opaqueState?.challengeClient === null) {
        this.log.error('missing challenge-client')
        return { status: 400 }
      }

      const valid = await verify(clientPublicKey, PeerIDAuthScheme, [
        ['challenge-client', opaqueState?.challengeClient ?? ''],
        ['hostname', hostname],
        ['server-public-key', publicKeyToProtobuf(this.components.privateKey.publicKey)]
      ], uint8ArrayFromString(authFields.sig, 'base64urlpad'))
      if (!valid) {
        this.log.error('invalid signature')
        return { status: 400 }
      }

      // Return a bearer token
      clientPeerId = peerIdFromPublicKey(clientPublicKey)
      returnParams.bearer = this.genBearerToken(clientPeerId, hostname)
    }

    if (authFields['challenge-server'] !== undefined) {
      if (clientPublicKey === null) {
        this.log.error('missing public-key')
        return { status: 400 }
      }

      // Sign and return challenge
      const sig = await sign(this.components.privateKey, PeerIDAuthScheme, [
        ['hostname', hostname],
        ['client-public-key', publicKeyToProtobuf(clientPublicKey)],
        ['challenge-server', authFields['challenge-server']]
      ])
      returnParams['public-key'] = uint8ArrayToString(publicKeyToProtobuf(this.components.privateKey.publicKey), 'base64urlpad')
      returnParams.sig = uint8ArrayToString(sig, 'base64urlpad')
    }

    if (returnParams.bearer !== undefined) {
      return {
        status: 200,
        peer: clientPeerId,
        headers: new Headers({
          'Authentication-info': encodeAuthParams(returnParams)
        })
      }
    }

    // Not authenticated
    return this.returnChallenge(hostname, clientPublicKey, returnParams)
  }

  private async returnChallenge (hostname: string, clientPublicKey: PublicKey | null, returnParams: Record<string, string>): Promise<AuthenticationResult> {
    const challenge = this.generateChallenge()
    returnParams['challenge-client'] = challenge

    returnParams.opaque = this.genOpaque({
      challengeClient: challenge,
      clientPublicKey: clientPublicKey !== null ? uint8ArrayToString(publicKeyToProtobuf(clientPublicKey), 'base64urlpad') : undefined,
      hostname,
      creationTime: Date.now()
    })

    return {
      status: 401,
      headers: new Headers({
        'www-authenticate': encodeAuthParams(returnParams),
        'access-control-expose-headers': 'www-authenticate'
      })
    }
  }

  private genBearerToken (clientPeerId: PeerId, hostname: string): string {
    return this.signBox(this.components.privateKey, {
      peer: clientPeerId.toString(),
      h: hostname,
      t: Date.now()
    })
  }

  private async unwrapBearerToken (expectedHostname: string, token: string): Promise<PeerId> {
    if (token.length < PeerIDAuthScheme.length + 1) {
      throw new Error('Invalid bearer token')
    }
    const bearer = parseHeader(token).bearer
    const unwrapped = await this.verifyBox(this.components.privateKey.publicKey, bearer) as any
    if (typeof unwrapped.peer !== 'string' || typeof unwrapped.h !== 'string' || typeof unwrapped.t !== 'number') {
      throw new Error('Invalid bearer token')
    }
    if (unwrapped.h !== expectedHostname) {
      throw new Error('Invalid hostname')
    }
    if (Date.now() - unwrapped.t > this.tokenTTL) {
      throw new Error('Token expired')
    }
    return peerIdFromString(unwrapped.peer)
  }

  private genOpaque (unwrapped: OpaqueUnwrapped): string {
    return this.signBox(this.components.privateKey, unwrapped)
  }

  private async unwrapOpaque (opaque: string): Promise<OpaqueUnwrapped> {
    const unwrapped = await this.verifyBox(this.components.privateKey.publicKey, opaque) as any
    if (typeof unwrapped.challengeClient !== 'string' || typeof unwrapped.hostname !== 'string' || typeof unwrapped.creationTime !== 'number') {
      throw new Error('Invalid opaque')
    }
    return unwrapped
  }

  private signBox (key: PrivateKey, data: unknown): string {
    const dataSerialized = JSON.stringify(data)
    const dataBytes = uint8ArrayFromString(dataSerialized)
    const sig = key.sign(dataBytes)
    const jsonStr = JSON.stringify({
      val: uint8ArrayToString(dataBytes, 'base64urlpad'),
      sig: uint8ArrayToString(sig, 'base64urlpad')
    })
    return uint8ArrayToString(uint8ArrayFromString(jsonStr), 'base64urlpad')
  }

  private async verifyBox (key: PublicKey, data: string): Promise<unknown> {
    const { sig, val } = JSON.parse(uint8ArrayToString(uint8ArrayFromString(data, 'base64urlpad')))
    const valBytes = uint8ArrayFromString(val, 'base64urlpad')
    const sigValid = await key.verify(valBytes, uint8ArrayFromString(sig, 'base64urlpad'))
    if (!sigValid) {
      throw new Error('Invalid signature')
    }
    const valStr = uint8ArrayToString(valBytes)
    return JSON.parse(valStr)
  }

  private generateChallenge (): string {
    const randomBytes = new Uint8Array(32)
    crypto.getRandomValues(randomBytes)
    return uint8ArrayToString(randomBytes, 'base64urlpad')
  }
}

export interface AuthenticationOptions {
  /**
   * How long in ms an auth token for a server will be valid for, defaults to
   * one hour
   *
   * @default 360_000
   */
  tokenTTL?: number

  /**
   * An optional function that can be used to verify that the hostname of the
   * incoming request is valid and supported
   */
  verifyHostname?(hostname: string): boolean | Promise<boolean>
}

export interface OptionalAuthenticationOptions extends AuthenticationOptions {
  /**
   * If true the request will be rejected if the client does not supply an
   * `Authorization` header, pass `false` here to attempt to verify the client
   * but allow the request to proceed if it fails
   *
   * @default true
   */
  requireAuth: false
}

export interface AuthenticatedWebSocketOptions extends AuthenticationOptions {
  /**
   * If the request was not a WebSocket request, invoke this method
   */
  fallback?: AuthenticatedHTTPRequestHandler

  /**
   * The maximum message size to be sent or received over the socket in bytes
   *
   * @default 10_485_760
   */
  maxMessageSize?: number
}

export interface OptionallyAuthenticatedWebSocketOptions extends OptionalAuthenticationOptions {
  /**
   * If the request was not a WebSocket request, invoke this method
   */
  fallback?: OptionallyAuthenticatedHTTPRequestHandler

  /**
   * The maximum message size to be sent or received over the socket in bytes
   *
   * @default 10_485_760
   */
  maxMessageSize?: number
}

/**
 * An HTTP handler that accepts the PeerId of the client as an argument
 */
export interface AuthenticatedHTTPRequestHandler {
  (req: Request, peerId: PeerId): Promise<Response>
}

/**
 * An HTTP handler that accepts the PeerId of the client as an argument, if they
 * provided a valid Authorization header
 */
export interface OptionallyAuthenticatedHTTPRequestHandler {
  (req: Request, peerId?: PeerId): Promise<Response>
}

/**
 * An WebSocket handler that accepts the PeerId of the client as an argument
 */
export interface AuthenticatedWebSocketHandler {
  (socket: WebSocket, peerId: PeerId): void
}

/**
 * An WebSocket handler that accepts the PeerId of the client as an argument, if
 * they provided a valid Authorization header
 */
export interface OptionallyAuthenticatedWebSocketHandler {
  (socket: WebSocket, peerId?: PeerId): void
}

function isOptionalAuth (obj: any): obj is OptionallyAuthenticatedHandler {
  return obj.requireAuth === false
}

async function authenticate (req: Request, authResult: AuthenticationResult, handlerMethods: string[], next: AuthenticatedHandler): Promise<Response>
async function authenticate (req: Request, authResult: AuthenticationResult, handlerMethods: string[], next: OptionallyAuthenticatedHandler): Promise<Response>
async function authenticate (req: Request, authResult: AuthenticationResult, handlerMethods: string[], next: AuthenticatedHandler | OptionallyAuthenticatedHandler): Promise<Response> {
  const authIsOptional = isOptionalAuth(next)

  if (!authIsOptional && authResult.peer == null) {
    return new Response(undefined, {
      status: authResult.status,
      headers: authResult.headers
    })
  }

  if (!handlerMethods.includes(req.method)) {
    // handle auth requests
    let res: Response

    if (req.method === 'OPTIONS') {
      // support OPTIONS if the handler doesn't
      res = new Response(undefined, {
        status: 204,
        headers: authResult.headers
      })
    } else {
      // unsupported method
      res = new Response(undefined, {
        status: 405
      })
    }

    // add auth headers to response
    if (authResult.headers !== undefined) {
      for (const [key, value] of authResult.headers) {
        res.headers.set(key, value)
      }
    }

    return res
  }

  // @ts-expect-error cannot derive handler type
  return next.handler(req, authResult.peer)
}

type OptionallyAuthenticatedHandler = HandlerRoute<OptionallyAuthenticatedHTTPRequestHandler> & OptionalAuthenticationOptions
type AuthenticatedHandler = HandlerRoute<AuthenticatedHTTPRequestHandler> & AuthenticationOptions

type OptionallyAuthenticatedEndpoint = HTTPRoute<OptionallyAuthenticatedHTTPRequestHandler> & OptionalAuthenticationOptions
type AuthenticatedEndpoint = HTTPRoute<AuthenticatedHTTPRequestHandler> & AuthenticationOptions

/**
 * Attempt to authenticate the client before request processing to discover
 * their PeerID.
 *
 * @see https://github.com/libp2p/specs/blob/master/http/peer-id-auth.md
 */
export function authenticatedRoute (handler: OptionallyAuthenticatedEndpoint): HTTPRoute
export function authenticatedRoute (handler: AuthenticatedEndpoint): HTTPRoute
export function authenticatedRoute (handler: OptionallyAuthenticatedEndpoint | AuthenticatedEndpoint): HTTPRoute {
  const handlerMethods: string[] = normalizeMethod(handler.method)

  return {
    path: handler.path,
    method: ['OPTIONS', ...handlerMethods],
    cors: handler.cors,
    init: (components: PeerIdAuthComponents) => {
      const auth = new PeerIdAuth(components, handler)
      const next = initializeRoute<AuthenticatedHTTPRequestHandler | OptionallyAuthenticatedHTTPRequestHandler>(handler, components)

      return async (req: Request): Promise<Response> => {
        const authResult = await auth.authenticateRequest(readHostname(req), req.headers.get('Authorization'))

        return authenticate(req, authResult, handlerMethods, next)
      }
    }
  }
}

type OptionallyAuthenticatedWebSocketEndpoint = HTTPRoute<OptionallyAuthenticatedWebSocketHandler> & OptionallyAuthenticatedWebSocketOptions
type AuthenticatedWebSocketEndpoint = HTTPRoute<AuthenticatedWebSocketHandler> & AuthenticatedWebSocketOptions

/**
 * Attempt to authenticate the client before request processing to discover
 * their PeerID.
 *
 * The authorization token should be passed as a protocol prefixed with
 * `authorization=`.
 *
 * To allow use of actual protocol field, multiple values should be
 * comma-delimited, e.g. `authorization=foo,actual,useful,protocols`
 *
 * @see https://github.com/libp2p/specs/blob/master/http/peer-id-auth.md
 */
export function authenticatedWebSocketRoute (handler: OptionallyAuthenticatedWebSocketEndpoint): HTTPRoute
export function authenticatedWebSocketRoute (handler: AuthenticatedWebSocketEndpoint): HTTPRoute
export function authenticatedWebSocketRoute (handler: OptionallyAuthenticatedWebSocketEndpoint | AuthenticatedWebSocketEndpoint): HTTPRoute {
  const handlerMethods: string[] = normalizeMethod(handler.method)

  const output: HTTPRoute = {
    path: handler.path,
    method: ['OPTIONS', ...handlerMethods],
    cors: handler.cors,
    init: (components: PeerIdAuthComponents) => {
      const auth = new PeerIdAuth(components, handler)
      const next: any = initializeRoute<any>(handler, components)

      // allow invoking the handler with a pre-upgraded socket
      output[WEBSOCKET_HANDLER] = (ws) => {
        // need to read the authorization header from the websocket protocol

        // TODO: we should have a way of doing this before the websocket upgrade
        // has been negotiated
        auth.authenticateRequest(readHostname(ws), readProtocol(ws))
          .then(authResult => {
            next.handler(ws, authResult.peer)
          })
          .catch(() => {
            ws.close()
          })
      }

      return async (req: Request): Promise<Response> => {
        const authResult = await auth.authenticateRequest(readHostname(req), readAuthorization(req) ?? readSecWebSocketProtocol(req))

        return authenticate(req, authResult, handlerMethods, {
          ...next,
          handler: async (req, peerId) => {
            const wsRoute = initializeRoute(webSocketRoute({
              ...next,
              handler: (ws) => {
                next.handler(ws, peerId)
              },
              fallback: next.fallback == null
                ? undefined
                : async (req: Request): Promise<Response> => {
                  return authenticate(req, authResult, handlerMethods, {
                    ...next,
                    handler: async (res, peerId) => {
                      if (next.fallback == null) {
                        // should not get here because we have already
                        // null-guarded on `handler.fallback`
                        return new Response(undefined, {
                          status: 500
                        })
                      }

                      return next.fallback(res, peerId)
                    }
                  })
                }
            }), components)

            return wsRoute.handler(req)
          }
        })
      }
    }
  }

  return output
}

function readHostname (req: { url: string }): string {
  const url = new URL(req.url)
  let hostname = url.hostname

  if (url.port === '' || url.port === undefined) {
    return hostname
  }

  if (url.protocol === 'http:' && url.port !== '80') {
    hostname += ':' + url.port
  }

  if (url.protocol === 'https:' && url.port !== '443') {
    hostname += ':' + url.port
  }

  if (hostname === '') {
    throw new Error('No hostname')
  }

  return hostname
}

function readAuthorization (req: Request): string | undefined {
  const authorization = req.headers.get('Authorization')

  if (authorization == null) {
    return
  }

  return authorization
}

export const SEC_WEBSOCKET_PROTOCOL_PREFIX = 'authorization='

function readSecWebSocketProtocol (req: Request): string | undefined {
  const protocol = req.headers.get('Sec-WebSocket-Protocol')

  if (protocol == null) {
    return
  }

  const protos = protocol.split(',')

  const authorization = protos
    .filter(p => p.startsWith(SEC_WEBSOCKET_PROTOCOL_PREFIX))
    .pop()

  // remove authorization field from protocol if present
  if (authorization != null) {
    req.headers.set('Sec-WebSocket-Protocol', protos
      .filter(p => !p.startsWith(SEC_WEBSOCKET_PROTOCOL_PREFIX))
      .join(','))
  }

  if (authorization == null) {
    return
  }

  return atob(authorization.substring(SEC_WEBSOCKET_PROTOCOL_PREFIX.length))
}

function readProtocol (ws: { protocol?: string }): string | undefined {
  const protocol = ws.protocol

  if (protocol == null) {
    return
  }

  const protos = protocol.split(',')

  const authorization = protos
    .filter(p => p.startsWith(SEC_WEBSOCKET_PROTOCOL_PREFIX))
    .pop()

  // remove authorization field from protocol if present
  if (authorization != null) {
    ws.protocol = protos
      .filter(p => !p.startsWith(SEC_WEBSOCKET_PROTOCOL_PREFIX))
      .join(',')
  }

  if (authorization == null) {
    return
  }

  return atob(authorization.substring(SEC_WEBSOCKET_PROTOCOL_PREFIX.length))
}
