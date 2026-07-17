import test from "node:test";
import assert from "node:assert/strict";
import { normalizeHistory, normalizeRooms } from "../src/normalize.js";

test("filters sensitive attributes and preserves room order", () => {
  const result = normalizeRooms({
    rooms: [{ id: "office", name: "Office", entities: [{ entityId: "light.desk", access: "control", name: null }] }],
  }, [{
    entity_id: "light.desk",
    state: "on",
    last_changed: "2026-01-01T00:00:00Z",
    attributes: { friendly_name: "Desk", brightness: 120, access_token: "secret", supported_color_modes: ["brightness"] },
  }], new Date("2026-01-01T00:00:01Z"));
  assert.equal(result.rooms[0].entities[0].name, "Desk");
  assert.deepEqual(result.rooms[0].entities[0].attributes, { brightness: 120 });
  assert.deepEqual(result.rooms[0].entities[0].capabilities, ["toggle", "set_brightness"]);
});

test("normalizes numeric history and removes unavailable states", () => {
  const start = new Date("2026-07-17T08:00:00Z");
  const end = new Date("2026-07-17T10:00:00Z");
  const result = normalizeHistory(["sensor.temperature"], [[
    { entity_id: "sensor.temperature", state: "21.2", last_changed: "2026-07-17T08:00:00Z" },
    { state: "unknown", last_changed: "2026-07-17T09:00:00Z" },
    { state: "22.1", last_changed: "2026-07-17T10:00:00Z" },
  ]], start, end);
  assert.deepEqual(result.series[0].points, [
    { timestamp: "2026-07-17T08:00:00Z", value: 21.2 },
    { timestamp: "2026-07-17T10:00:00Z", value: 22.1 },
  ]);
});
