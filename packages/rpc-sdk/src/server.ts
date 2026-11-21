import type { Infer, Schema } from "./schema.ts";

export { s, type Infer, type Schema } from "./schema.ts";

export interface ActionDefinition<
  TCtx,
  TReq extends Schema<any> = Schema<any>,
  TRes extends Schema<any> = Schema<any>,
> {
  readonly description: string;
  readonly request: TReq;
  readonly response: TRes;
  readonly handler: (ctx: TCtx, args: Infer<TReq>) => Promise<Infer<TRes>> | Infer<TRes>;
}

export type ActionsModule<TCtx = unknown> = Record<string, ActionDefinition<TCtx, any, any>>;

export function defineAction<TCtx, TReq extends Schema<any>, TRes extends Schema<any>>(
  def: ActionDefinition<TCtx, TReq, TRes>,
): ActionDefinition<TCtx, TReq, TRes> {
  return def;
}

export class RpcError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "RpcError";
    this.status = status;
  }
}

export async function dispatchAction<TCtx, TMod extends ActionsModule<TCtx>>(
  actions: TMod,
  ctx: TCtx,
  actionName: string,
  rawArgs: unknown,
): Promise<unknown> {
  if (!Object.prototype.hasOwnProperty.call(actions, actionName)) {
    throw new RpcError(404, `Unknown action: ${actionName}`);
  }
  const def = actions[actionName];
  if (!def) {
    throw new RpcError(404, `Unknown action: ${actionName}`);
  }
  const parsedReq = def.request.parse(rawArgs ?? {});
  if (!parsedReq.success) {
    throw new RpcError(400, `Invalid arguments for "${actionName}": ${parsedReq.error}`);
  }
  const result = await def.handler(ctx, parsedReq.data);
  const parsedRes = def.response.parse(result);
  if (!parsedRes.success) {
    throw new RpcError(500, `Response schema mismatch for "${actionName}": ${parsedRes.error}`);
  }
  return parsedRes.data;
}
