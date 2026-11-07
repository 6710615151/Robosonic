import assert from "node:assert/strict";
import { test } from "node:test";
import { conditionOrder, newJourneyId, nextCondition, stationComplete } from "../lib/hri/journey";

test("journey: each station runs both conditions, in alternating order", () => {
  for (const id of ["a", "b", "3f9c01", "zz"]) {
    const first = conditionOrder(id, 0);
    const second = conditionOrder(id, 1);
    assert.deepEqual([...first].sort(), ["default", "passport"]);
    assert.deepEqual(second, [first[1], first[0]]);
    assert.deepEqual(conditionOrder(id, 2), first);
  }
});

test("journey: across journeys both orders start the first station", () => {
  // 40 random ids all sharing one order has probability 2^-39.
  const starts = new Set(Array.from({ length: 40 }, () => conditionOrder(newJourneyId(), 0)[0]));
  assert.equal(starts.size, 2);
  // Deterministic for a given id, so a reload mid-journey keeps the order.
  assert.deepEqual(conditionOrder("abc123", 1), conditionOrder("abc123", 1));
});

test("journey: nextCondition walks the order and stops when both are rated", () => {
  const [a, b] = conditionOrder("x", 0);
  assert.deepEqual(nextCondition("x", 0, undefined), { mode: a, position: 1 });
  assert.deepEqual(nextCondition("x", 0, { [a]: 4 }), { mode: b, position: 2 });
  assert.equal(nextCondition("x", 0, { [a]: 4, [b]: 2 }), null);
  assert.equal(stationComplete({ [a]: 4, [b]: 2 }), true);
  assert.equal(stationComplete({ [a]: 4 }), false);
});

test("journey: ids are random hex, not derived from anything personal", () => {
  const id = newJourneyId(() => new Uint8Array([0, 1, 2, 254, 255, 16]));
  assert.equal(id, "000102feff10");
  assert.match(newJourneyId(), /^[0-9a-f]{12}$/);
});
