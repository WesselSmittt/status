// Statuspagina: controleert elke 5 minuten de sites (cron) en bewaart de
// uitkomst in KV. De pagina zelf staat in public/ en haalt /api/status op.

const MONITORS = [
  { id: "portfolio", name: "Portfolio", url: "https://wesselsmit.com/" },
  { id: "school", name: "School", url: "https://school.wesselsmit.com/" },
  { id: "filedrop", name: "Filedrop", url: "https://files.wesselsmit.com/" },
];

const STATE_KEY = "state";
const HISTORY_DAYS = 90;
const RECENT_CHECKS = 48; // 4 uur bij een meting per 5 minuten
const TIMEOUT_MS = 10000;
const SLOW_MS = 3000;

async function check(monitor) {
  const started = Date.now();
  try {
    const res = await fetch(monitor.url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": "status.wesselsmit.com" },
      cf: { cacheTtl: 0 },
    });
    await res.body?.cancel();
    const ms = Date.now() - started;
    const ok = res.status >= 200 && res.status < 400;
    return { ok, code: res.status, ms, slow: ok && ms > SLOW_MS };
  } catch (err) {
    return { ok: false, code: 0, ms: Date.now() - started, error: err.name };
  }
}

async function runChecks(env) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const state = (await env.STATUS.get(STATE_KEY, "json")) || { monitors: {} };

  const results = await Promise.all(MONITORS.map(check));

  MONITORS.forEach((monitor, i) => {
    const result = { t: now.toISOString(), ...results[i] };
    const entry = state.monitors[monitor.id] || { days: {}, recent: [] };

    const day = entry.days[today] || { up: 0, total: 0 };
    day.total += 1;
    if (result.ok) day.up += 1;
    entry.days[today] = day;

    // Oude dagen opruimen
    const cutoff = new Date(now.getTime() - HISTORY_DAYS * 86400000).toISOString().slice(0, 10);
    for (const d of Object.keys(entry.days)) {
      if (d < cutoff) delete entry.days[d];
    }

    entry.recent = [...entry.recent, { t: result.t, ok: result.ok, ms: result.ms }].slice(-RECENT_CHECKS);
    entry.last = result;
    state.monitors[monitor.id] = entry;
  });

  state.updated = now.toISOString();
  await env.STATUS.put(STATE_KEY, JSON.stringify(state));
  return state;
}

async function statusResponse(env) {
  const state = (await env.STATUS.get(STATE_KEY, "json")) || { monitors: {} };
  const body = {
    updated: state.updated || null,
    days: HISTORY_DAYS,
    monitors: MONITORS.map(({ id, name, url }) => ({ id, name, url, ...(state.monitors[id] || {}) })),
  };
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/status") return statusResponse(env);
    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runChecks(env));
  },
};
