const DB_URL = "https://byan-iotweb06-default-rtdb.firebaseio.com";

const RELES = {
  cocina:  { name: "Luz Cocina",   key: "cocina" },
  cuarto1: { name: "Luz Cuarto 1", key: "cuarto1" },
  cuarto2: { name: "Luz Cuarto 2", key: "cuarto2" },
  patio:   { name: "Luz Patio",    key: "patio" }
};

export default async function handler(req, res) {
  if (req.query.redirect_uri) {
    return res.redirect(`${req.query.redirect_uri}?code=cod_casa&state=${req.query.state}`);
  }
  if (req.body && req.body.grant_type) {
    return res.status(200).json({
      token_type: "bearer",
      access_token: "tok_casa",
      refresh_token: "ref_casa",
      expires_in: 86400
    });
  }

  if (req.method !== "POST" || !req.body || !req.body.inputs) {
    return res.status(200).send("Puente Smart Casa Conectado a Firebase");
  }

  const { requestId, inputs } = req.body;
  const input = inputs[0];

  if (input.intent === "action.devices.SYNC") {
    const devices = Object.keys(RELES).map((id) => ({
      id,
      type: "action.devices.types.LIGHT",
      traits: ["action.devices.traits.OnOff"],
      name: { defaultNames: [RELES[id].name], name: RELES[id].name, nicknames: [RELES[id].name] },
      willReportState: false
    }));
    return res.status(200).json({ requestId, payload: { agentUserId: "byan_iot", devices } });
  }

  if (input.intent === "action.devices.QUERY") {
    const r = await fetch(`${DB_URL}/casa.json`);
    const data = (await r.json()) || {};
    const devices = {};
    for (const d of input.payload.devices) {
      const val = data[RELES[d.id].key];
      devices[d.id] = { online: true, status: "SUCCESS", on: val === 1 || val === "1" || val === true };
    }
    return res.status(200).json({ requestId, payload: { devices } });
  }

  if (input.intent === "action.devices.EXECUTE") {
    const results = [];
    const updates = {};
    for (const cmd of input.payload.commands) {
      const on = cmd.execution[0].params.on;
      for (const d of cmd.devices) {
        updates[RELES[d.id].key] = on ? 1 : 0;
        results.push({ ids: [d.id], status: "SUCCESS", states: { on, online: true } });
      }
    }
    await fetch(`${DB_URL}/casa.json`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    });
    return res.status(200).json({ requestId, payload: { commands: results } });
  }
}
