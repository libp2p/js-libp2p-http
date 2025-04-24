export class ErrorEvent extends Event {
  public readonly message: string
  public readonly error: Error
  public readonly filename = ''
  public readonly lineno = 0
  public readonly colno = 0

  constructor (err: Error) {
    super('error')
    this.error = err
    this.message = err.message
  }
}

export interface CloseEventInit extends EventInit {
  code?: number
  reason?: string
  wasClean?: boolean
}

/**
 * Can remove once node.js 24 becomes LTS
 */
export class CloseEvent extends Event {
  public readonly code: number
  public readonly reason: string
  public readonly wasClean: boolean

  constructor (type: string, eventInitDict?: CloseEventInit) {
    super(type)
    this.code = eventInitDict?.code ?? 0
    this.reason = eventInitDict?.reason ?? ''
    this.wasClean = eventInitDict?.wasClean ?? true
  }
}
