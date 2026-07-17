const ACTIONS = {
  light: {
    toggle: { service: "toggle" },
    set_brightness: { service: "turn_on", field: "brightness_pct", min: 1, max: 100 },
  },
  switch: {
    toggle: { service: "toggle" },
  },
  input_boolean: {
    toggle: { service: "toggle" },
  },
  climate: {
    set_temperature: { service: "set_temperature", field: "temperature", min: 5, max: 35 },
  },
  cover: {
    open: { service: "open_cover" },
    close: { service: "close_cover" },
    stop: { service: "stop_cover" },
  },
  scene: {
    run: { service: "turn_on" },
  },
  script: {
    run: { service: "turn_on" },
  },
};

export function resolveAction(config, input) {
  const entityId = typeof input?.entityId === "string" ? input.entityId : "";
  const action = typeof input?.action === "string" ? input.action : "";
  const entry = config.rooms.flatMap((room) => room.entities).find((item) => item.entityId === entityId);
  if (!entry || entry.access !== "control") throw new RelayError(403, "Entity is not controllable.");

  const domain = entityId.split(".")[0];
  const mapping = ACTIONS[domain]?.[action];
  if (!mapping) throw new RelayError(400, "Action is not supported for this entity.");

  const data = { entity_id: entityId };
  if (mapping.field) {
    if (typeof input.value !== "number" || !Number.isFinite(input.value)) {
      throw new RelayError(400, "Action requires a numeric value.");
    }
    if (input.value < mapping.min || input.value > mapping.max) {
      throw new RelayError(400, `Value must be between ${mapping.min} and ${mapping.max}.`);
    }
    data[mapping.field] = input.value;
  }
  return { entityId, domain, service: mapping.service, data };
}

export function createHomeAssistantClient({ baseUrl, token, fetchImpl = fetch }) {
  async function request(path, init = {}) {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(8_000),
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...init.headers,
      },
    });
    if (!response.ok) throw new Error(`Home Assistant returned ${response.status}.`);
    return response.json();
  }
  return {
    states: () => request("/states"),
    state: (entityId) => request(`/states/${encodeURIComponent(entityId)}`),
    history: (entityIds, start, end) => {
      const query = new URLSearchParams({
        filter_entity_id: entityIds.join(","),
        end_time: end.toISOString(),
      });
      query.append("minimal_response", "");
      return request(`/history/period/${encodeURIComponent(start.toISOString())}?${query}`);
    },
    call: ({ domain, service, data }) =>
      request(`/services/${domain}/${service}`, { method: "POST", body: JSON.stringify(data) }),
  };
}

export class RelayError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
