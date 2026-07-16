# HeyHey Home Assistant Relay

A deliberately narrow Home Assistant app that exposes selected entity states and safe everyday controls to HeyHeyPa. It is designed to sit behind Cloudflare Tunnel and Cloudflare Access.

The relay:

- Uses Home Assistant Supervisor's internal Core API token.
- Never exposes arbitrary Home Assistant paths or service names.
- Returns only allowlisted entities and UI-safe attributes.
- Separates read-only entities from controllable entities.
- Supports lights, switches, climate, covers, scenes, and scripts.

See [DOCS.md](heyhey_relay/DOCS.md) for installation and configuration.
