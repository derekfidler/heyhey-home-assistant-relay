import test from "node:test";
import assert from "node:assert/strict";
import { createHomeAssistantClient, resolveAction } from "../src/home-assistant.js";

const config = {
  rooms: [{ entities: [
    { entityId: "light.desk", access: "control" },
    { entityId: "input_boolean.air_conditioner", access: "control" },
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

test("maps input booleans to the fixed toggle service", () => {
  assert.deepEqual(resolveAction(config, {
    entityId: "input_boolean.air_conditioner",
    action: "toggle",
  }), {
    entityId: "input_boolean.air_conditioner",
    domain: "input_boolean",
    service: "toggle",
    data: { entity_id: "input_boolean.air_conditioner" },
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

test("requests a bounded minimal history period", async () => {
  let requestedUrl;
  const client = createHomeAssistantClient({
    baseUrl: "http://supervisor/core/api",
    token: "token",
    fetchImpl: async (url) => {
      requestedUrl = new URL(url);
      return { ok: true, json: async () => [] };
    },
  });
  await client.history(
    ["sensor.temperature", "sensor.humidity"],
    new Date("2026-07-17T08:00:00Z"),
    new Date("2026-07-17T10:00:00Z"),
  );
  assert.equal(requestedUrl.pathname, "/core/api/history/period/2026-07-17T08%3A00%3A00.000Z");
  assert.equal(requestedUrl.searchParams.get("filter_entity_id"), "sensor.temperature,sensor.humidity");
  assert.equal(requestedUrl.searchParams.get("end_time"), "2026-07-17T10:00:00.000Z");
  assert.equal(requestedUrl.searchParams.has("minimal_response"), true);
});
