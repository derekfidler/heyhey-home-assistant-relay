import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRooms } from "../src/normalize.js";

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
