/**
 * Stremio Smart Selector — Server Entry Point
 *
 * Serves the addon both as a local server (for development and self-hosting)
 * and as a publishable addon via the Stremio addon SDK.
 *
 * Usage:
 *   node index.js           → starts HTTP server on PORT (default 7000)
 *   PORT=8080 node index.js → custom port
 */

const { serveHTTP } = require("stremio-addon-sdk");
const addonInterface  = require("./addon");

const PORT = process.env.PORT || 7000;

serveHTTP(addonInterface, { port: PORT });

console.log(`
╔═══════════════════════════════════════════════════════╗
║          🎬  Stremio Smart Selector  🎬               ║
╠═══════════════════════════════════════════════════════╣
║                                                       ║
║  Addon running at:                                    ║
║  → http://localhost:${String(PORT).padEnd(5)}                         ║
║                                                       ║
║  To install in Stremio:                               ║
║  → http://localhost:${String(PORT).padEnd(5)}/manifest.json            ║
║                                                       ║
║  Configure your preferences at:                       ║
║  → http://localhost:${String(PORT).padEnd(5)}/configure               ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
`);
