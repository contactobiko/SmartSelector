const express = require("express");
const cors    = require("cors");
const path    = require("path");

let addonInterface;
try {
  // Cargamos tu lógica original
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

// 1. Servir la web de configuración
app.use(express.static(path.join(__dirname, 'public')));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// 2. Rutas del Manifest (MUY IMPORTANTE: Stremio necesita ambas)
app.get("/manifest.json", (req, res) => res.json(addonInterface.manifest));
app.get("/:config/manifest.json", (req, res) => res.json(addonInterface.manifest));

// 3. Rutas de los Streams
app.get("/stream/:type/:id.json", handleStream);
app.get("/:config/stream/:type/:id.json", handleStream);

async function handleStream(req, res) {
  const { type, id, config: configParam } = req.params;
  let config = {};

  if (configParam) {
    try {
      // Decodificación segura (reparamos lo que el navegador cambió para la URL)
      const base64 = configParam.replace(/-/g, '+').replace(/_/g, '/');
      config = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
    } catch (e) {
      console.error("❌ Error decodificando config:", e.message);
    }
  }

  try {
    // Llamamos a tu función get original de addon.js
    const result = await addonInterface.get({ resource: "stream", type, id, config });
    res.json(result);
  } catch (err) {
    console.error("❌ [stream] Error:", err.message);
    res.status(500).json({ streams: [] });
  }
}

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Smart Selector online en puerto ${PORT}`);
});
