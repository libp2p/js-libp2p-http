import { Duplex } from 'node:stream'
import type { Connection, Logger, Stream } from '@libp2p/interface'
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

  #initStream: Promise<Stream>
  #stream?: Stream

  #log?: Logger

  constructor (initStream: Promise<{ stream: Stream, connection: Connection }>) {
    super()

    this.bytesRead = 0
    this.bytesWritten = 0
    this.allowHalfOpen = true
    this.remoteAddress = ''

    this.#initStream = initStream.then(({ stream, connection }) => {
      this.#log = stream.log.newScope('libp2p-socket')
      this.remoteAddress = connection.remoteAddr.toString()

      stream.addEventListener('message', (evt) => {
        this.push(evt.data.subarray())
      })

      stream.addEventListener('close', (evt) => {
        if (evt.error != null) {
          this.destroy(evt.error)
        } else {
          this.push(null)
        }
      })

      stream.pause()

      this.emit('connect')

      return stream
    })
      .catch(err => {
        this.emit('error', err)
        throw err
      })
  }

  getStream (cb: (stream: Stream) => void): void {
    if (this.#stream != null) {
      cb(this.#stream)
      return
    }

    this.#initStream.then(stream => {
      this.#stream = stream
      cb(stream)
    }, (err) => {
      this.emit('error', err)
    })
  }

  destroy (error?: Error): this {
    return super.destroy(error)
  }

  _write (chunk: Uint8Array, encoding: string, cb: (err?: Error) => void): void {
    this.#log?.('write %d bytes', chunk.byteLength)

    this.bytesWritten += chunk.byteLength

    this.getStream(stream => {
      if (!stream.send(chunk)) {
        stream.onDrain()
          .then(() => {
            cb()
          }, (err) => {
            cb(err)
          })
      } else {
        cb()
      }
    })
  }

  _read (size: number): void {
    this.#log?.('asked to read %d bytes', size)
    this.getStream(stream => {
      stream.resume()
    })
  }

  _destroy (err: Error, cb: (err?: Error) => void): void {
    this.#log?.('destroy with %d bytes buffered - %e', this.bufferSize, err)

    this.getStream(stream => {
      if (err != null) {
        stream.abort(err)
        cb()
      } else {
        stream.close()
          .then(() => {
            cb()
          })
          .catch(err => {
            stream.abort(err)
            cb(err)
          })
      }
    })
  }

  _final (cb: (err?: Error) => void): void {
    this.#log?.('final')

    this.getStream(stream => {
      stream.close()
        .then(() => {
          cb()
        })
        .catch(err => {
          stream.abort(err)
          cb(err)
        })
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
    this.#log?.('destroySoon with %d bytes buffered', this.bufferSize)
    this.destroy()
  }

  connect (options: SocketConnectOpts, connectionListener?: () => void): this
  connect (port: number, host: string, connectionListener?: () => void): this
  connect (port: number, connectionListener?: () => void): this
  connect (path: string, connectionListener?: () => void): this
  connect (...args: any[]): this {
    this.#log?.('connect %o', args)
    return this
  }

  setEncoding (encoding?: BufferEncoding): this {
    this.#log?.('setEncoding %s', encoding)
    return this
  }

  resetAndDestroy (): this {
    this.#log?.('resetAndDestroy')

    this.getStream(stream => {
      stream.abort(new Error('Libp2pSocket.resetAndDestroy'))
    })

    return this
  }

  setTimeout (timeout: number, callback?: () => void): this {
    this.#log?.('setTimeout %d', timeout)

    if (callback != null) {
      this.addListener('timeout', callback)
    }

    this.timeout = timeout === 0 ? MAX_TIMEOUT : timeout

    return this
  }

  setNoDelay (noDelay?: boolean): this {
    this.#log?.('setNoDelay %b', noDelay)

    return this
  }

  setKeepAlive (enable?: boolean, initialDelay?: number): this {
    this.#log?.('setKeepAlive %b %d', enable, initialDelay)

    return this
  }

  address (): AddressInfo | Record<string, any> {
    this.#log?.('address')

    return {}
  }

  unref (): this {
    this.#log?.('unref')

    return this
  }

  ref (): this {
    this.#log?.('ref')

    return this
  }

  write (buffer: Uint8Array | string, cb?: (err?: Error) => void): boolean
  write (str: Uint8Array | string, encoding?: BufferEncoding, cb?: (err?: Error) => void): boolean
  write (chunk: any, encoding?: any, cb?: any): boolean {
    return super.write(chunk, encoding, cb)
  }
}

export function streamToSocket (stream: Stream, connection: Connection): Socket {
  return new Libp2pSocket(Promise.resolve({ stream, connection }))
}
