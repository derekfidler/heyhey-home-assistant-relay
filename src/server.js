import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { loadConfig, readOptions, saveConfig, validateConfigText } from "./config.js";
import { createHomeAssistantClient, RelayError, resolveAction } from "./home-assistant.js";
import { normalizeEntity, normalizeRooms } from "./normalize.js";

const port = Number(process.env.PORT ?? 8787);
const configPath = process.env.CONFIG_PATH ?? "/data/entities.yaml";
const optionsPath = process.env.OPTIONS_PATH ?? "/data/options.json";
const haBaseUrl = process.env.HA_BASE_URL ?? "http://supervisor/core/api";
const supervisorToken = process.env.SUPERVISOR_TOKEN;

if (!supervisorToken) throw new Error("SUPERVISOR_TOKEN is required.");

let config = null;
let configError = null;
const options = await readOptions(optionsPath);
const ha = createHomeAssistantClient({ baseUrl: haBaseUrl, token: supervisorToken });
await reloadConfig();

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (url.pathname === "/" && req.method === "GET") return html(res, editorPage(configError));
    if (url.pathname === "/config" && req.method === "GET") {
      return text(res, 200, await readFile(configPath, "utf8").catch(() => exampleConfig()));
    }
    if (url.pathname === "/config/validate" && req.method === "POST") {
      validateConfigText(await readBody(req, 64_000));
      return json(res, 200, { ok: true });
    }
    if (url.pathname === "/config" && req.method === "POST") {
      config = await saveConfig(configPath, await readBody(req, 64_000));
      configError = null;
      return json(res, 200, { ok: true });
    }

    if (!url.pathname.startsWith("/v1/")) return json(res, 404, { error: "Not found." });
    if (!authorized(req.headers.authorization, options.relaySecret)) {
      return json(res, 401, { error: "Unauthorized." });
    }
    if (url.pathname === "/v1/health" && req.method === "GET") {
      return json(res, config ? 200 : 503, { ok: Boolean(config), configured: Boolean(config), error: configError });
    }
    if (!config) return json(res, 503, { error: "Relay configuration is unavailable." });

    if (url.pathname === "/v1/entities" && req.method === "GET") {
      return json(res, 200, normalizeRooms(config, await ha.states()));
    }
    if (url.pathname === "/v1/actions" && req.method === "POST") {
      const action = resolveAction(config, JSON.parse(await readBody(req, 16_000)));
      await ha.call(action);
      const entry = config.rooms.flatMap((room) => room.entities).find((item) => item.entityId === action.entityId);
      return json(res, 200, { entity: normalizeEntity(entry, await ha.state(action.entityId)) });
    }
    return json(res, 404, { error: "Not found." });
  } catch (error) {
    const status = error instanceof RelayError ? error.status : error instanceof SyntaxError ? 400 : 502;
    console.error(error instanceof Error ? error.message : "Unexpected relay error");
    return json(res, status, { error: status === 502 ? "Home Assistant request failed." : error.message });
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`HeyHey Relay listening on port ${port}.`);
});

async function reloadConfig() {
  try {
    config = await loadConfig(configPath);
    configError = null;
  } catch (error) {
    config = null;
    configError = error instanceof Error ? error.message : "Configuration is invalid.";
  }
}

function authorized(header, secret) {
  if (!header?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new RelayError(413, "Request body is too large.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

function text(res, status, body) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
  res.end(body);
}

function html(res, body) {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  res.end(body);
}

function exampleConfig() {
  return `version: 1
rooms:
  - id: living_room
    name: Living room
    entities:
      - entity_id: light.living_room
        name: Ceiling lights
        access: control
`;
}

function editorPage(error) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>HeyHey Relay</title><style>
body{font:15px system-ui;margin:0;background:#f5f2eb;color:#1c1b19}main{max-width:760px;margin:auto;padding:32px 20px}
textarea{box-sizing:border-box;width:100%;min-height:440px;padding:16px;border:1px solid #d8d2c5;border-radius:12px;background:#fbf9f4;font:13px ui-monospace,monospace}
button{min-height:44px;margin:12px 8px 0 0;padding:0 18px;border:0;border-radius:10px;background:#1c1b19;color:#fbf9f4;font-weight:650}
button.secondary{background:#e7e2d7;color:#1c1b19}p{color:#6f6a60}.error{color:#8f4d43}#status{min-height:24px}
</style></head><body><main><h1>HeyHey Relay</h1><p>Review, validate, and activate the room-based entity allowlist. Invalid edits never replace the last valid configuration.</p>
${error ? `<p class="error">Current configuration: ${escapeHtml(error)}</p>` : ""}
<textarea id="config" aria-label="Entity configuration"></textarea><div><button id="validate" class="secondary">Validate</button><button id="save">Save configuration</button></div><p id="status" role="status"></p>
<script>
const box=document.querySelector("#config"),status=document.querySelector("#status");
fetch("./config").then(r=>r.text()).then(t=>box.value=t);
async function send(path){status.textContent="Working…";const r=await fetch(path,{method:"POST",headers:{"content-type":"text/plain"},body:box.value});const data=await r.json();status.textContent=r.ok?(path.endsWith("validate")?"Configuration is valid.":"Configuration saved."):(data.error||"Request failed.");}
document.querySelector("#validate").onclick=()=>send("./config/validate");document.querySelector("#save").onclick=()=>send("./config");
</script></main></body></html>`;
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
