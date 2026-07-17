import test from "node:test";
import assert from "node:assert/strict";
import { validateConfigText } from "../src/config.js";

test("parses ordered room configuration", () => {
  const config = validateConfigText(`version: 1
rooms:
  - id: office
    name: Office
    entities:
      - entity_id: light.desk
        access: control
      - entity_id: sensor.temperature
        access: read
        history: true
`);
  assert.equal(config.rooms[0].entities[0].entityId, "light.desk");
  assert.equal(config.rooms[0].entities[0].history, false);
  assert.equal(config.rooms[0].entities[1].history, true);
});

test("rejects non-boolean history settings", () => {
  assert.throws(() => validateConfigText(`version: 1
rooms:
  - id: office
    name: Office
    entities:
      - entity_id: sensor.temperature
        access: read
        history: two_hours
`), /history must be true or false/);
});

test("rejects duplicate entities and unsafe controllable domains", () => {
  assert.throws(() => validateConfigText(`version: 1
rooms:
  - id: entry
    name: Entry
    entities:
      - entity_id: lock.front_door
        access: control
`), /cannot be controllable/);
});

test("allows reviewed input booleans as controls", () => {
  const config = validateConfigText(`version: 1
rooms:
  - id: bedroom
    name: Bedroom
    entities:
      - entity_id: input_boolean.bedroom_shutter
        access: control
`);
  assert.equal(config.rooms[0].entities[0].entityId, "input_boolean.bedroom_shutter");
});
