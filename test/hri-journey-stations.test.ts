import { test } from "node:test";
import assert from "node:assert/strict";
import { pickStations } from "../lib/hri/journey-stations";

const robot = (id: string, canonicalName: string, robotType: string) => ({ id, canonicalName, robotType });

test("named robots win their station, in journey order", () => {
  const stations = pickStations([
    robot("n", "Ninja Robot", "medical_telepresence"),
    robot("p", "Pinto Robot", "medical_delivery"),
    robot("s", "Mr SAM outpatient service robot", "hospital_administrative_service"),
    robot("x", "Some Delivery Bot", "delivery")
  ]);
  assert.deepEqual(stations.map((s) => [s.task, s.robot.id]), [["reception", "s"], ["delivery", "p"], ["telepresence", "n"]]);
});

test("falls back to a fitting type, never reuses a robot, and drops stations nobody can play", () => {
  const stations = pickStations([robot("a", "Alpha", "outpatient_service"), robot("b", "Beta", "delivery")]);
  assert.deepEqual(stations.map((s) => [s.task, s.robot.id]), [["reception", "a"], ["delivery", "b"]]);
  assert.equal(pickStations([]).length, 0);
});
