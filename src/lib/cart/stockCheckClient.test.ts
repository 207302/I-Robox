import assert from "node:assert/strict";
import test from "node:test";
import {
  STOCK_CHECK_TIMEOUT_MS,
  StockCheckError,
  fetchProductStockCheck,
} from "./stockCheckClient";

test("stock check rejects when the API never resolves", async () => {
  const hangingFetch = (() => new Promise(() => {})) as typeof fetch;
  const started = Date.now();

  await assert.rejects(
    () =>
      fetchProductStockCheck([{ productId: "00438026-11d8-4981-affb-56d53cff06c7" }], {
        timeoutMs: 150,
        fetchImpl: hangingFetch,
      }),
    (error: unknown) => {
      assert.ok(error instanceof StockCheckError);
      assert.equal(error.timedOut, true);
      assert.match(error.message, /timed out/i);
      return true;
    }
  );

  const elapsed = Date.now() - started;
  assert.ok(elapsed < 2_000, `stock check stayed pending for ${elapsed}ms`);
  assert.equal(STOCK_CHECK_TIMEOUT_MS, 10_000);
});
