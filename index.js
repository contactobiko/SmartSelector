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

// 1. Servir la carpeta public (nuestra web de configuración)
app.use(express.static(path.join(__dirname, 'public')));

// 2. Rutas para la página web
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/configure', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// 3. Rutas del Manifest (¡Importante añadir la versión con :config!)
app.get("/manifest.json", (req, res) => res.json(addonInterface.manifest));
app.get("/:config/manifest.json", (req, res) => res.json(addonInterface.manifest));

// 4. Rutas de los streams
app.get("/:config/stream/:type/:id.json", handleStream);
app.get("/stream/:type/:id.json",          handleStream);

async function handleStream(req, res) {
  const { type, id } = req.params;
  let config = {};
  if (req.params.config) {
    try { config = JSON.parse(Buffer.from(req.params.config, "base64").toString("utf8")); } catch {}
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
  console.log(`✅ Servidor corriendo en el puerto ${PORT}`);
});
