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

// Servir la interfaz web
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/configure', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Decodificador seguro para Base64-URL (Soluciona el fallo en Render)
function decodeConfig(configStr) {
  try {
    // Restaurar caracteres estándar de Base64
    let base64 = configStr.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  } catch (e) {
    console.error("Error decodificando config:", e.message);
    return {};
  }
}

// Rutas de Manifest
app.get("/manifest.json", (req, res) => res.json(addonInterface.manifest));
app.get("/:config/manifest.json", (req, res) => res.json(addonInterface.manifest));

// Rutas de Streams
app.get("/:config/stream/:type/:id.json", handleStream);
app.get("/stream/:type/:id.json",          handleStream);

async function handleStream(req, res) {
  const { type, id } = req.params;
  let config = {};
  
  if (req.params.config) {
    config = decodeConfig(req.params.config);
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
