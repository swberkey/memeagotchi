import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defineAction, dispatchAction, RpcError, s } from "./server.ts";

describe("@memeagotchi/rpc-sdk", () => {
  it("validates primitives, defaults, optionals, nullables, refinements, unions, and object extension", () => {
    const base = s.object({
      name: s.string().min(2).max(10),
      count: s.number().int().min(0).max(5).default(1),
      mode: s.union([s.literal(1), s.literal(60)] as const).optional(),
      path: s.string().refine((v) => v.startsWith("/uploads/"), "bad path").nullable().default(null),
    });

    const extended = base.extend({ ok: s.boolean() });

    const good = extended.parse({ name: "Mochi", ok: true });
    assert.equal(good.success, true);
    if (good.success) {
      assert.equal(good.data.count, 1);
      assert.equal(good.data.path, null);
    }

    assert.equal(extended.parse({ name: "A", ok: true }).success, false);
    assert.equal(extended.parse({ name: "Mochi", count: 1.5, ok: true }).success, false);
    assert.equal(extended.parse({ name: "Mochi", path: "/etc/passwd", ok: true }).success, false);
    assert.equal(extended.parse({ name: "Mochi", mode: 30, ok: true }).success, false);
  });

  it("dispatches typed actions and throws RpcError on unknown action or bad args", async () => {
    const actions = {
      ping: defineAction({
        description: "echo",
        request: s.object({ msg: s.string().min(1) }),
        response: s.object({ reply: s.string() }),
        handler(_ctx: { prefix: string }, args) {
          return { reply: `${_ctx.prefix}:${args.msg}` };
        },
      }),
    };

    const res = await dispatchAction(actions, { prefix: "hi" }, "ping", { msg: "world" });
    assert.deepEqual(res, { reply: "hi:world" });

    await assert.rejects(() => dispatchAction(actions, { prefix: "hi" }, "missing", {}), (err: unknown) => {
      return err instanceof RpcError && err.status === 404;
    });

    await assert.rejects(() => dispatchAction(actions, { prefix: "hi" }, "ping", { msg: "" }), (err: unknown) => {
      return err instanceof RpcError && err.status === 400;
    });
  });
});
