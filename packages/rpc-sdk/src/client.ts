import type { InferIn, InferOut } from "./schema.ts";
import type { ActionDefinition, ActionsModule } from "./server.ts";

type ReqOf<T> = T extends ActionDefinition<any, infer TReq, any> ? InferIn<TReq> : never;
type ResOf<T> = T extends ActionDefinition<any, any, infer TRes> ? InferOut<TRes> : never;

export type ActionClient<TMod extends ActionsModule<any>> = {
  [K in keyof TMod]: (args: ReqOf<TMod[K]>) => Promise<ResOf<TMod[K]>>;
};

export type ApiRequest<TClient, K extends keyof TClient> = TClient[K] extends (args: infer A) => any ? A : never;
export type ApiResponse<TClient, K extends keyof TClient> = TClient[K] extends (...args: any[]) => Promise<infer R> ? R : never;

export interface ActionClientOptions {
  getHeaders?: () => Record<string, string>;
  credentials?: RequestCredentials;
}

export function createActionClient<TMod extends ActionsModule<any>>(
  endpoint = "/api/actions",
  options?: ActionClientOptions,
): ActionClient<TMod> {
  return new Proxy({} as ActionClient<TMod>, {
    get(_target, prop) {
      if (typeof prop !== "string") return undefined;
      return async (args: unknown) => {
        const extraHeaders = options?.getHeaders ? options.getHeaders() : {};
        const res = await fetch(endpoint, {
          method: "POST",
          credentials: options?.credentials ?? "same-origin",
          headers: {
            "content-type": "application/json",
            ...extraHeaders,
          },
          body: JSON.stringify({ action: prop, args: args ?? {} }),
        });
        const text = await res.text();
        let data: { ok?: boolean; result?: unknown; error?: string } | null = null;
        try {
          data = text ? (JSON.parse(text) as { ok?: boolean; result?: unknown; error?: string }) : null;
        } catch {
          throw new Error(`Invalid server response (${res.status})`);
        }
        if (!res.ok || !data || data.ok === false) {
          throw new Error(data?.error ?? `Action "${prop}" failed (${res.status})`);
        }
        return data.result;
      };
    },
  });
}
