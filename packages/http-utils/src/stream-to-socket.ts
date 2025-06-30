import { Duplex } from 'node:stream'
import { byteStream } from 'it-byte-stream'
import type { Connection, Stream } from '@libp2p/interface'
import type { ByteStream } from 'it-byte-stream'
import type { Socket, SocketConnectOpts, AddressInfo, SocketReadyState } from 'node:net'

const MAX_TIMEOUT = 2_147_483_647

export class Libp2pSocket extends Duplex {
  public readonly autoSelectFamilyAttemptedAddresses = []
  public readonly connecting = false
  public readonly pending = false
  public remoteAddress: string
  public bytesRead: number
  public bytesWritten: number
  public timeout = MAX_TIMEOUT
  public allowHalfOpen: boolean

  #stream?: Stream
  #bytes?: ByteStream<Stream>

  constructor () {
    super()

    this.bytesRead = 0
    this.bytesWritten = 0
    this.allowHalfOpen = true
    this.remoteAddress = ''
  }

  setStream (stream: Stream, connection: Connection): void {
    this.#bytes = byteStream(stream)
    this.#stream = stream
    this.remoteAddress = connection.remoteAddr.toString()
  }

  _write (chunk: Uint8Array, encoding: string, cb: (err?: Error) => void): void {
    this.#stream?.log('write %d bytes', chunk.byteLength)

    this.bytesWritten += chunk.byteLength
    this.#bytes?.write(chunk)
      .then(() => {
        cb()
      }, err => {
        cb(err)
      })
  }

  _read (size: number): void {
    this.#stream?.log('asked to read %d bytes', size)

    void Promise.resolve().then(async () => {
      try {
        while (true) {
          const chunk = await this.#bytes?.read({
            signal: AbortSignal.timeout(this.timeout)
          })

          if (chunk == null) {
            this.#stream?.log('socket readable end closed')
            this.push(null)
            return
          }

          this.bytesRead += chunk.byteLength

          this.#stream?.log('socket read %d bytes', chunk.byteLength)
          const more = this.push(chunk.subarray())

          if (!more) {
            break
          }
        }
      } catch (err: any) {
        this.destroy(err)
      }
    })
  }

  _destroy (err: Error, cb: (err?: Error) => void): void {
    this.#stream?.log('destroy with %d bytes buffered - %e', this.bufferSize, err)

    if (err != null) {
      this.#bytes?.unwrap().abort(err)
      cb()
    } else {
      this.#bytes?.unwrap().close()
        .then(() => {
          cb()
        })
        .catch(err => {
          this.#stream?.abort(err)
          cb(err)
        })
    }
  }

  _final (cb: (err?: Error) => void): void {
    this.#stream?.log('final')

    this.#bytes?.unwrap().closeWrite()
      .then(() => {
        cb()
      })
      .catch(err => {
        this.#bytes?.unwrap().abort(err)
        cb(err)
      })
  }

  public get readyState (): SocketReadyState {
    if (this.#stream?.status === 'closed') {
      return 'closed'
    }

    if (this.#stream?.writeStatus === 'closed' || this.#stream?.writeStatus === 'closing') {
      return 'readOnly'
    }

    if (this.#stream?.readStatus === 'closed' || this.#stream?.readStatus === 'closing') {
      return 'writeOnly'
    }

    return 'open'
  }

  public get bufferSize (): number {
    return this.writableLength
  }

  destroySoon (): void {
    this.#stream?.log('destroySoon with %d bytes buffered', this.bufferSize)
    this.destroy()
  }

  connect (options: SocketConnectOpts, connectionListener?: () => void): this
  connect (port: number, host: string, connectionListener?: () => void): this
  connect (port: number, connectionListener?: () => void): this
  connect (path: string, connectionListener?: () => void): this
  connect (...args: any[]): this {
    this.#stream?.log('connect %o', args)
    return this
  }

  setEncoding (encoding?: BufferEncoding): this {
    this.#stream?.log('setEncoding %s', encoding)
    return this
  }

  resetAndDestroy (): this {
    this.#stream?.log('resetAndDestroy')
    this.#stream?.abort(new Error('Libp2pSocket.resetAndDestroy'))

    return this
  }

  setTimeout (timeout: number, callback?: () => void): this {
    this.#stream?.log('setTimeout %d', timeout)

    if (callback != null) {
      this.addListener('timeout', callback)
    }

    this.timeout = timeout === 0 ? MAX_TIMEOUT : timeout

    return this
  }

  setNoDelay (noDelay?: boolean): this {
    this.#stream?.log('setNoDelay %b', noDelay)

    return this
  }

  setKeepAlive (enable?: boolean, initialDelay?: number): this {
    this.#stream?.log('setKeepAlive %b %d', enable, initialDelay)

    return this
  }

  address (): AddressInfo | Record<string, any> {
    this.#stream?.log('address')

    return {}
  }

  unref (): this {
    this.#stream?.log('unref')

    return this
  }

  ref (): this {
    this.#stream?.log('ref')

    return this
  }

  write (buffer: Uint8Array | string, cb?: (err?: Error) => void): boolean
  write (str: Uint8Array | string, encoding?: BufferEncoding, cb?: (err?: Error) => void): boolean
  write (chunk: any, encoding?: any, cb?: any): boolean {
    return super.write(chunk, encoding, cb)
  }
}

export function streamToSocket (stream: Stream, connection: Connection): Socket {
  const socket = new Libp2pSocket()
  socket.setStream(stream, connection)

  return socket
}
