import assert from "node:assert/strict";
import test from "node:test";
import { isOrderOwnedByCustomer } from "./orderOwnership";

test("a missing or blank session id is not treated as the order owner", () => {
  assert.equal(isOrderOwnedByCustomer("cust-1", null), false);
  assert.equal(isOrderOwnedByCustomer("cust-1", undefined), false);
  assert.equal(isOrderOwnedByCustomer("cust-1", ""), false);
  assert.equal(isOrderOwnedByCustomer("cust-1", "   "), false);
  assert.equal(isOrderOwnedByCustomer(null, null), false);
  assert.equal(isOrderOwnedByCustomer("", ""), false);
  assert.equal(isOrderOwnedByCustomer("cust-1", "someone-else"), false);
});

test("the live customer id owns the order regardless of uuid casing", () => {
  assert.equal(
    isOrderOwnedByCustomer(
      "84D30B93-3F4F-4449-8479-2E6E1E42CE9E",
      "84d30b93-3f4f-4449-8479-2e6e1e42ce9e"
    ),
    true
  );
});
