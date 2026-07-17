import { readFile, rename, writeFile } from "node:fs/promises";
import { parse } from "yaml";

const DOMAINS = new Set(["light", "switch", "climate", "cover", "scene", "script"]);
const ACCESS = new Set(["read", "control"]);

export function validateConfigText(text) {
  const value = parse(text);
  if (!value || value.version !== 1 || !Array.isArray(value.rooms)) {
    throw new Error("Configuration must contain version: 1 and a rooms list.");
  }

  const roomIds = new Set();
  const entityIds = new Set();
  const rooms = value.rooms.map((room, roomIndex) => {
    if (!room || typeof room !== "object") throw new Error(`Room ${roomIndex + 1} is invalid.`);
    const id = cleanId(room.id, `Room ${roomIndex + 1} id`);
    const name = cleanLabel(room.name, `Room ${roomIndex + 1} name`);
    if (roomIds.has(id)) throw new Error(`Duplicate room id: ${id}`);
    roomIds.add(id);
    if (!Array.isArray(room.entities)) throw new Error(`${name} must contain an entities list.`);

    const entities = room.entities.map((entity, entityIndex) => {
      const entityId = cleanEntityId(entity?.entity_id, `${name} entity ${entityIndex + 1}`);
      if (entityIds.has(entityId)) throw new Error(`Duplicate entity: ${entityId}`);
      entityIds.add(entityId);
      const domain = entityId.split(".")[0];
      if (!DOMAINS.has(domain) && entity?.access === "control") {
        throw new Error(`${entityId} cannot be controllable.`);
      }
      if (!ACCESS.has(entity?.access)) throw new Error(`${entityId} access must be read or control.`);
      return {
        entityId,
        name: entity.name ? cleanLabel(entity.name, `${entityId} name`) : null,
        access: entity.access,
        history: cleanHistory(entity.history, entityId),
      };
    });
    return { id, name, entities };
  });

  return { version: 1, rooms };
}

export async function loadConfig(path) {
  return validateConfigText(await readFile(path, "utf8"));
}

export async function saveConfig(path, text) {
  const config = validateConfigText(text);
  const pending = `${path}.pending`;
  await writeFile(pending, text, { mode: 0o600 });
  await rename(pending, path);
  return config;
}

export async function readOptions(path) {
  const options = JSON.parse(await readFile(path, "utf8"));
  if (typeof options.relay_secret !== "string" || options.relay_secret.length < 32) {
    throw new Error("relay_secret must contain at least 32 characters.");
  }
  return { relaySecret: options.relay_secret };
}

function cleanId(value, label) {
  if (typeof value !== "string" || !/^[a-z0-9_]{1,64}$/.test(value)) {
    throw new Error(`${label} must use lowercase letters, numbers, and underscores.`);
  }
  return value;
}

function cleanEntityId(value, label) {
  if (typeof value !== "string" || !/^[a-z0-9_]+\.[a-z0-9_]+$/.test(value)) {
    throw new Error(`${label} has an invalid entity_id.`);
  }
  return value;
}

function cleanLabel(value, label) {
  if (typeof value !== "string" || value.trim().length < 1 || value.trim().length > 80) {
    throw new Error(`${label} must be between 1 and 80 characters.`);
  }
  return value.trim();
}

function cleanHistory(value, entityId) {
  if (value === undefined) return false;
  if (typeof value !== "boolean") throw new Error(`${entityId} history must be true or false.`);
  return value;
}
