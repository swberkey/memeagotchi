import { createActionClient, type ApiRequest, type ApiResponse } from "@memeagotchi/rpc-sdk/client";
import type { Actions } from "@memeagotchi/server/actions";

export const api = createActionClient<typeof Actions>("/api/actions");
export type { ApiRequest, ApiResponse };
