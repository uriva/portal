import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.179.0/testing/asserts.ts";
import {
  conj,
  get,
  getOrDefault,
  has,
  remove,
  removeAllFromArray,
  set,
} from "./utils.ts";

Deno.test("set and get from Map", () => {
  const map = new Map<string, number>();
  set(map, "a", 1);
  assertEquals(get(map, "a"), 1);
});

Deno.test("get throws on missing key", () => {
  const map = new Map<string, number>();
  assertThrows(() => get(map, "missing"));
});

Deno.test("has checks key existence", () => {
  const map = new Map<string, number>();
  assertEquals(has(map, "a"), false);
  set(map, "a", 1);
  assertEquals(has(map, "a"), true);
});

Deno.test("getOrDefault returns default for missing key", () => {
  const map = new Map<string, number>();
  assertEquals(getOrDefault(42, map, "missing"), 42);
  set(map, "a", 1);
  assertEquals(getOrDefault(42, map, "a"), 1);
});

Deno.test("remove deletes key from the actual Map", () => {
  const map = new Map<string, number>();
  set(map, "a", 1);
  set(map, "b", 2);
  assertEquals(has(map, "a"), true);
  remove(map, "a");
  assertEquals(has(map, "a"), false);
  assertEquals(has(map, "b"), true);
});

Deno.test("remove on nonexistent key is a no-op", () => {
  const map = new Map<string, number>();
  set(map, "a", 1);
  remove(map, "nonexistent");
  assertEquals(has(map, "a"), true);
});

Deno.test("conj appends to array", () => {
  assertEquals(conj([1, 2], 3), [1, 2, 3]);
  assertEquals(conj([], "a"), ["a"]);
});

Deno.test("removeAllFromArray removes all occurrences", () => {
  assertEquals(removeAllFromArray([1, 2, 3, 2, 1], 2), [1, 3, 1]);
  assertEquals(removeAllFromArray([1, 1, 1], 1), []);
  assertEquals(removeAllFromArray([1, 2, 3], 4), [1, 2, 3]);
});
