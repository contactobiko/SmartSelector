const express = require("express");
const cors = require("cors");
const path = require("path");
const addon = require("./addon.js");

const app = express();
const PORT = process.env.PORT || 7000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Rutas compatibles con Stremio y Render
app.get("/manifest.json", (req, res) => res.json(addon.manifest));
app.get("/:config/manifest.json", (req, res) => res.json(addon.manifest));

app.get("/stream/:type/:id.json", handleStream);
app.get("/:config/stream/:type/:id.json", handleStream);

async function handleStream(req, res) {
  let config = {};
  if (req.params.config) {
    try {
      const decoded = Buffer.from(req.params.config, "base64").toString("utf8");
      config = JSON.parse(decoded);
    } catch (e) { console.error("Error config:", e.message); }
  }

  const result = await addon.get({ 
    resource: "stream", 
    type: req.params.type, 
    id: req.params.id, 
    config 
  });
  res.json(result);
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Servidor Smart Selector activo en puerto ${PORT}`);
});
