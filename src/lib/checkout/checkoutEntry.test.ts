import assert from "node:assert/strict";
import test from "node:test";
import { checkoutEntryHref, postLoginPath } from "./checkoutEntry";

test("guest and expired-session checkout sends the shopper to sign in and back to the cart", () => {
  for (const userId of [null, undefined, "", "   "]) {
    assert.equal(checkoutEntryHref(userId), "/login?next=%2Fcart");
  }
  assert.equal(postLoginPath("/cart"), "/cart");
  assert.equal(postLoginPath("/login"), "/");
  assert.equal(postLoginPath("https://evil.example/cart"), "/");
});

test("signed-in checkout opens the checkout page", () => {
  assert.equal(checkoutEntryHref("user-1"), "/checkout");
});
