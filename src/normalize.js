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
    history: entry.history,
    lastChanged: state?.last_changed ?? null,
  };
}

export function normalizeHistory(entityIds, history, start, end, maxPoints = 90) {
  const requested = new Set(entityIds);
  const byId = new Map();

  for (const rawSeries of Array.isArray(history) ? history : []) {
    if (!Array.isArray(rawSeries) || rawSeries.length === 0) continue;
    const entityId = rawSeries.find((item) => typeof item?.entity_id === "string")?.entity_id;
    if (!entityId || !requested.has(entityId)) continue;
    const points = rawSeries.flatMap((item) => {
      const value = Number(item?.state);
      const timestamp = item?.last_changed ?? item?.last_updated;
      if (!Number.isFinite(value) || typeof timestamp !== "string" || !Number.isFinite(Date.parse(timestamp))) {
        return [];
      }
      return [{ timestamp, value }];
    });
    byId.set(entityId, downsample(points, maxPoints));
  }

  return {
    from: start.toISOString(),
    to: end.toISOString(),
    series: entityIds.map((entityId) => ({ entityId, points: byId.get(entityId) ?? [] })),
  };
}

function downsample(points, maxPoints) {
  if (points.length <= maxPoints) return points;
  const result = [points[0]];
  const interior = maxPoints - 2;
  for (let index = 1; index <= interior; index += 1) {
    result.push(points[Math.round((index * (points.length - 1)) / (maxPoints - 1))]);
  }
  result.push(points.at(-1));
  return result;
}

function capabilities(domain, access, attributes) {
  if (access !== "control") return [];
  switch (domain) {
    case "light":
      return attributes.supported_color_modes?.includes("brightness")
        ? ["toggle", "set_brightness"]
        : ["toggle"];
    case "switch":
    case "input_boolean":
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
