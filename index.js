const express = require("express");
const cors    = require("cors");
const path    = require("path");

let addonInterface;
try {
  addonInterface = require("./addon.js");
} catch (err) {
  console.error("\n❌ ERROR al cargar addon.js:");
  console.error(err.message);
  process.exit(1);
}

const PORT = process.env.PORT || 7000;
const app  = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/manifest.json", (req, res) => res.json(addonInterface.manifest));

app.get("/:config/manifest.json", (req, res) => res.json(addonInterface.manifest));

app.get("/:config/stream/:type/:id.json", handleStream);
app.get("/stream/:type/:id.json",          handleStream);

async function handleStream(req, res) {
  const { type, id } = req.params;
  let config = {};
  if (req.params.config) {
    try {
      config = JSON.parse(decodeURIComponent(Buffer.from(req.params.config, "base64").toString("utf8")));
    } catch (e) {
      try {
        config = JSON.parse(Buffer.from(req.params.config, "base64").toString("utf8"));
      } catch {}
    }
  }
  try {
    const result = await addonInterface.get({ resource: "stream", type, id, config });
    res.json(result);
  } catch (err) {
    console.error("[stream] Error:", err.message);
    res.status(500).json({ streams: [] });
  }
}

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║          Smart Selector  Stremio Addon               ║
╠═══════════════════════════════════════════════════════╣
║                                                       ║
║  Configurar addon:                                    ║
║  → http://localhost:${PORT}/                          ║
║                                                       ║
║  Instalar en Stremio (usar tras configurar):         ║
║  → http://localhost:${PORT}/{config}/manifest.json   ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
`);
}).on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n❌ Puerto ${PORT} en uso. Prueba: set PORT=7001 && node index.js\n`);
  } else {
    console.error("❌ Error:", err.message);
  }
  process.exit(1);
});
