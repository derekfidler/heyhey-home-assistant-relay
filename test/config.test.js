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
`);
  assert.equal(config.rooms[0].entities[0].entityId, "light.desk");
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
