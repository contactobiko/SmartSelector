const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 7000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let addon;
try {
  addon = require("./addon.js");
} catch (err) {
  console.error("❌ Error crítico cargando addon.js:", err.message);
  process.exit(1);
}

// --- Rutas del Addon ---
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/manifest.json", (req, res) => res.json(addon.manifest));
app.get("/:config/manifest.json", (req, res) => res.json(addon.manifest));

app.get("/stream/:type/:id.json", handleStream);
app.get("/:config/stream/:type/:id.json", handleStream);

async function handleStream(req, res) {
  const { type, id } = req.params;
  let config = {};

  if (req.params.config) {
    try {
      // Soporte para base64 estándar y URL-safe
      const normalizedBase64 = req.params.config.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = Buffer.from(normalizedBase64, "base64").toString("utf8");
      config = JSON.parse(decoded);
    } catch (e) {
      console.error("⚠️ Error decodificando configuración:", e.message);
    }
  }

  try {
    const result = await addon.get({ resource: "stream", type, id, config });
    res.json(result);
  } catch (err) {
    console.error(`❌ Error en stream ${type}/${id}:`, err.message);
    res.status(500).json({ streams: [] });
  }
}

app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`
  ╔════════════════════════════════════════╗
  ║    🎬 SMART SELECTOR - LIVE 🎉         ║
  ╠════════════════════════════════════════╣
  ║ Puerto: ${PORT}                          ║
  ║ Status: Operacional                    ║
  ╚════════════════════════════════════════╝
  `);
});
