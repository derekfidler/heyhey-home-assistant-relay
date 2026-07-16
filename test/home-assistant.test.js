import test from "node:test";
import assert from "node:assert/strict";
import { resolveAction } from "../src/home-assistant.js";

const config = {
  rooms: [{ entities: [
    { entityId: "light.desk", access: "control" },
    { entityId: "sensor.temperature", access: "read" },
  ] }],
};

test("maps brightness to a fixed Home Assistant service", () => {
  assert.deepEqual(resolveAction(config, {
    entityId: "light.desk",
    action: "set_brightness",
    value: 55,
  }), {
    entityId: "light.desk",
    domain: "light",
    service: "turn_on",
    data: { entity_id: "light.desk", brightness_pct: 55 },
  });
});

test("rejects read-only and out-of-range actions", () => {
  assert.throws(() => resolveAction(config, {
    entityId: "sensor.temperature",
    action: "toggle",
  }), /not controllable/);
  assert.throws(() => resolveAction(config, {
    entityId: "light.desk",
    action: "set_brightness",
    value: 101,
  }), /between 1 and 100/);
});
