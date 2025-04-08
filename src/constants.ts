export const PROTOCOL = '/http/1.1'
export const WELL_KNOWN_PROTOCOLS = '/.well-known/libp2p/protocols'
export const WEBSOCKET_HANDLER = Symbol.for('@libp2p/http/websocket-handler')
export const PEER_ID_AUTH_SCHEME = 'libp2p-PeerID'
export const HTTP_PEER_ID_AUTH_PROTO = '/http-peer-id-auth/1.0.0'
export const DEFAULT_AUTH_TOKEN_TTL = 60 * 60 * 1000 // 1 hour
export const HTTP_PATH_CODEC = 0x01e1
export const HTTP_CODEC = 0x01e0
export const DNS_CODEC = 0x35
export const DNS4_CODEC = 0x36
export const DNS6_CODEC = 0x37
export const DNSADDR_CODEC = 0x38
export const DNS_CODECS = [
  DNS_CODEC,
  DNS4_CODEC,
  DNS6_CODEC,
  DNSADDR_CODEC
]
export const DEFAULT_COOKIE_EXPIRY_CHECK_INTERVAL = 60_000
