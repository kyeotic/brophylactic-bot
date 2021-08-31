import { RouterContext } from '../deps.ts'

// deno-lint-ignore no-explicit-any
export function json(ctx: RouterContext, status: number, body: any) {
  ctx.response.status = status
  ctx.response.body = body
}
