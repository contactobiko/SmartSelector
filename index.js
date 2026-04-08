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
  console.error("Error cargando addon.js:", err.message);
  process.exit(1);
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/manifest.json", (req, res) => {
  res.json(addon.manifest);
});

app.get("/:config/manifest.json", (req, res) => {
  res.json(addon.manifest);
});

app.get("/stream/:type/:id.json", handleStream);
app.get("/:config/stream/:type/:id.json", handleStream);

async function handleStream(req, res) {
  const { type, id } = req.params;
  let config = {};

  if (req.params.config) {
    try {
      const decoded = Buffer.from(req.params.config, "base64").toString("utf8");
      config = JSON.parse(decoded);
    } catch (e) {
      console.error("Error decodificando config:", e.message);
    }
  }

  try {
    const result = await addon.get({ resource: "stream", type, id, config });
    res.json(result);
  } catch (err) {
    console.error("Error en handler:", err.message);
    res.status(500).json({ streams: [] });
  }
}

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Smart Selector corriendo en puerto ${PORT}`);
  console.log(`Configurar: http://localhost:${PORT}/`);
  console.log(`Manifest:   http://localhost:${PORT}/manifest.json`);
}).on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Puerto ${PORT} en uso`);
    process.exit(1);
  }
  console.error("Error:", err.message);
  process.exit(1);
});
