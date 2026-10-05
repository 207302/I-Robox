import assert from "node:assert/strict";
import test from "node:test";
import { getCurrentScope, loadCartForSessionScope, mergeCartItems } from "../cartStorage";
import type { CartItem } from "@/redux/features/cart-slice";

function line(id: string, quantity: number): CartItem {
  return { id, productId: id, name: "Car", price: 10, quantity };
}

function installStorage() {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: () => null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
  return store;
}

test("guest lines are merged into the account cart", () => {
  const merged = mergeCartItems(
    [line("account-only", 1), line("shared", 2)],
    [line("shared", 1), line("guest-only", 3)]
  );
  const byId = new Map(merged.map((item) => [String(item.id), item.quantity]));
  assert.equal(byId.get("account-only"), 1);
  assert.equal(byId.get("shared"), 3);
  assert.equal(byId.get("guest-only"), 3);
});

test("an expired session keeps the cart, and signing back in does not double it", () => {
  installStorage();
  localStorage.setItem("irobox_storage_scope", "user-1");
  localStorage.setItem("irobox-cart:user-1", JSON.stringify([line("p1", 1), line("p2", 2)]));

  const preserved = loadCartForSessionScope("guest");
  assert.equal(getCurrentScope(), "guest");
  assert.equal(preserved.length, 2);
  assert.equal(localStorage.getItem("irobox-cart:user-1"), null);

  const afterLogin = loadCartForSessionScope("user-1");
  const byId = new Map(afterLogin.map((item) => [String(item.id), item.quantity]));
  assert.equal(byId.get("p1"), 1);
  assert.equal(byId.get("p2"), 2);
  assert.equal(localStorage.getItem("irobox-cart:guest"), null);
});
