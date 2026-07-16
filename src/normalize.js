const SAFE_ATTRIBUTES = new Set([
  "brightness",
  "current_temperature",
  "temperature",
  "unit_of_measurement",
  "device_class",
  "position",
  "current_position",
  "hvac_action",
]);

export function normalizeRooms(config, states, now = new Date()) {
  const byId = new Map(states.map((state) => [state.entity_id, state]));
  return {
    updatedAt: now.toISOString(),
    rooms: config.rooms.map((room) => ({
      id: room.id,
      name: room.name,
      entities: room.entities.map((entry) => normalizeEntity(entry, byId.get(entry.entityId))),
    })),
  };
}

export function normalizeEntity(entry, state) {
  const domain = entry.entityId.split(".")[0];
  const attributes = {};
  for (const [key, value] of Object.entries(state?.attributes ?? {})) {
    if (SAFE_ATTRIBUTES.has(key) && ["string", "number", "boolean"].includes(typeof value)) {
      attributes[key] = value;
    }
  }

  return {
    entityId: entry.entityId,
    name: entry.name ?? state?.attributes?.friendly_name ?? entry.entityId,
    domain,
    access: entry.access,
    state: state?.state ?? "unavailable",
    available: Boolean(state) && !["unavailable", "unknown"].includes(state.state),
    attributes,
    capabilities: capabilities(domain, entry.access, state?.attributes ?? {}),
    lastChanged: state?.last_changed ?? null,
  };
}

function capabilities(domain, access, attributes) {
  if (access !== "control") return [];
  switch (domain) {
    case "light":
      return attributes.supported_color_modes?.includes("brightness")
        ? ["toggle", "set_brightness"]
        : ["toggle"];
    case "switch":
      return ["toggle"];
    case "climate":
      return ["set_temperature"];
    case "cover":
      return ["open", "close", "stop"];
    case "scene":
    case "script":
      return ["run"];
    default:
      return [];
  }
}
