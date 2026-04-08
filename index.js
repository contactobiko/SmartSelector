const express = require("express");
const cors = require("cors");
const path = require("path");
const addon = require("./addon.js");

const app = express();
const PORT = process.env.PORT || 10000; // Puerto por defecto en Render

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Rutas de Stremio
app.get("/manifest.json", (req, res) => res.json(addon.manifest));
app.get("/:config/manifest.json", (req, res) => res.json(addon.manifest));

app.get("/stream/:type/:id.json", handleStream);
app.get("/:config/stream/:type/:id.json", handleStream);

async function handleStream(req, res) {
  const { type, id, config: configRaw } = req.params;
  let config = {};

  if (configRaw) {
    try {
      const decoded = Buffer.from(configRaw, "base64").toString("utf8");
      config = JSON.parse(decoded);
    } catch (e) {
      console.error("❌ Error decodificando config:", e.message);
    }
  }

  const result = await addon.get({ resource: "stream", type, id, config });
  res.json(result);
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Smart Selector corriendo en puerto ${PORT}`);
});
