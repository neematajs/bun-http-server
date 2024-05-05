import {
  type Serve as BunServe,
  type Server as BunServer,
  Glob,
  type WebSocketHandler,
} from 'bun'

type HttpBaseHandler = { path: string; handler: HttpHandler; glob: Glob }
type Async<T> = T | Promise<T>

export type HttpHandler = (req: Request, server: BunServer) => Async<Response>

export type ServerOptions = {
  cors?: {
    origin: string | ((req: Request) => true) | Glob
    methods?: string[]
    headers?: string[]
    credentials?: string
  }
}

export class Server<T = any> {
  private readonly httpHandlers = new Map<string, HttpBaseHandler[]>()
  private server: BunServer | null = null
  private wsHandlers?: WebSocketHandler<T>

  constructor(
    private serveOptions: Omit<BunServe<any>, 'serve' | 'websocket'>,
    private readonly options: ServerOptions = {},
  ) {}

  request(methods: string[], path: string, handler: HttpHandler) {
    for (const method of methods) {
      const methodHandlers = this.httpHandlers.get(method) ?? []
      methodHandlers.push({ path, handler, glob: new Glob(path) })
      this.httpHandlers.set(method, methodHandlers)
    }
    return this
  }

  get(path: string, handler: HttpHandler) {
    return this.request(['GET'], path, handler)
  }

  post(path: string, handler: HttpHandler) {
    return this.request(['POST'], path, handler)
  }

  put(path: string, handler: HttpHandler) {
    return this.request(['PUT'], path, handler)
  }

  delete(path: string, handler: HttpHandler) {
    return this.request(['DELETE'], path, handler)
  }

  upgrade(
    path: string,
    handler: (
      req: Request,
      server: BunServer,
    ) => Async<{
      headers?: Bun.HeadersInit
      data?: T
    }>,
  ) {
    return this.request(['UPGRADE'], path, async (req, server) => {
      const options = await handler(req, server)
      server.upgrade(req, options)
      return void undefined as unknown as any
    })
  }

  ws(options: WebSocketHandler<T>) {
    this.wsHandlers = options
    return this
  }

  listen() {
    this.server = Bun.serve<T>({
      ...this.serveOptions,
      websocket: this.wsHandlers,
      fetch: async (req, server) => {
        const { url } = req
        const pathname = new URL(url).pathname
        const upgrading =
          req.headers.get('connection')?.toLowerCase() === 'upgrade' &&
          req.headers.get('upgrade')?.toLowerCase() === 'websocket'
        const handlers = this.httpHandlers.get(
          upgrading ? 'UPGRADE' : req.method,
        )
        const headers = new Headers()
        // @ts-expect-error
        this.applyCors(req, headers)

        if (handlers) {
          for (const { glob, handler } of handlers) {
            if (glob.match(pathname)) {
              if (req.method === 'OPTIONS')
                return new Response(null, { status: 204, headers })

              const response = await handler(req, server)

              if (upgrading && response === undefined)
                return void undefined as unknown as any

              for (const [key, value] of response.headers)
                headers.set(key, value)

              return new Response(response.body, {
                headers,
                status: response.status,
                statusText: response.statusText,
              })
            }
          }
        }
        return new Response(undefined, { status: 404, headers })
      },
    })
  }

  close() {
    this.server?.stop()
  }

  private applyCors(req: Request, headers: Headers) {
    const origin = req.headers.get('origin')

    if (this.options.cors && origin) {
      const { cors } = this.options
      let allowed = false
      if (typeof cors.origin === 'string')
        allowed = cors.origin === req.headers.get('origin')
      else if (cors.origin instanceof Bun.Glob) {
        allowed = cors.origin.match(origin)
      } else {
        allowed = cors.origin(req)
      }

      if (allowed) {
        headers.set('access-control-allow-origin', origin)
        for (const type of ['methods', 'headers', 'credentials'] as const) {
          if (cors[type]) {
            headers.set(`Access-Control-Allow-${type}`, `${cors[type]}`)
          }
        }
      }
    }
  }
}
