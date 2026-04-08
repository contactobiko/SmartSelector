# 🎬 Stremio Smart Selector

Addon para Stremio que **elige automáticamente el mejor stream** según tus preferencias de audio, subtítulos y calidad — sin mostrarte el picker.

No aloja ni sirve ningún torrent. Simplemente consulta los addons que ya tienes instalados (como Torrentio), puntúa todos sus resultados y devuelve el mejor.

```
Stremio → Smart Selector → [Torrentio, otros addons...] → scoring → ✅ mejor stream
```

---

## 📋 Requisitos previos

- **Node.js** versión 14 o superior
- **npm** (viene incluido con Node.js)
- Stremio instalado
- Al menos un addon de streams ya funcionando (ej: Torrentio)

---

## 🖥️ Instalación en Windows

### 1. Instalar Node.js

1. Ve a **https://nodejs.org**
2. Descarga la versión **LTS** (la de la izquierda)
3. Ejecuta el instalador `.msi` → Next → Next → Install
4. Abre el menú Inicio, busca **"Símbolo del sistema"** o **"cmd"**
5. Verifica que funciona:
   ```
   node --version
   npm --version
   ```
   Deben mostrar números de versión (ej: `v20.11.0`)

### 2. Descomprimir y preparar el addon

1. Descomprime `stremio-smart-selector.zip` en una carpeta (ej: `C:\stremio-smart-selector`)
2. Abre **cmd** y navega a esa carpeta:
   ```
   cd C:\stremio-smart-selector
   ```
3. Instala las dependencias:
   ```
   npm install
   ```
   Verás que se crea la carpeta `node_modules/` — es normal.

### 3. Arrancar el servidor

```
node index.js
```

Deberías ver:
```
╔═══════════════════════════════════════════════════════╗
║          🎬  Stremio Smart Selector  🎬               ║
║  Addon running at: http://localhost:7000              ║
╚═══════════════════════════════════════════════════════╝
```

> ⚠️ **Deja esta ventana abierta** mientras uses Stremio. El servidor debe estar corriendo.

---

## 🍎 Instalación en macOS

### 1. Instalar Node.js

**Opción A — Instalador directo (más fácil):**
1. Ve a **https://nodejs.org**
2. Descarga la versión **LTS**
3. Abre el `.pkg` y sigue el asistente

**Opción B — Homebrew (si lo tienes):**
```bash
brew install node
```

Verifica:
```bash
node --version
npm --version
```

### 2. Preparar el addon

Abre **Terminal** (CMD+Espacio → "Terminal"):
```bash
cd ~/Downloads/stremio-smart-selector   # o donde lo hayas descomprimido
npm install
```

### 3. Arrancar

```bash
node index.js
```

---

## 🐧 Instalación en Linux

```bash
# Ubuntu / Debian
sudo apt update && sudo apt install nodejs npm -y

# Fedora / RHEL
sudo dnf install nodejs npm -y

# Arch
sudo pacman -S nodejs npm

# Verificar versión (debe ser ≥ 14)
node --version

# Preparar y arrancar
cd stremio-smart-selector
npm install
node index.js
```

---

## 📡 Instalar el addon en Stremio

Con el servidor corriendo en `http://localhost:7000`:

1. Abre **Stremio**
2. Ve a ⚙️ **Settings** (ajustes) → **Addons**
3. Haz clic en **"+ Add addon"** o busca el campo de URL
4. Pega la siguiente URL:
   ```
   http://127.0.0.1:7000/manifest.json
   ```
5. Se abrirá la **pantalla de configuración**

### Pantalla de configuración

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| 🔗 URLs de addons | URLs de los addons a consultar, separadas por coma | `https://torrentio.strem.fun/sort=seeders` |
| 🔊 Audio | Idioma de audio preferido | `spa` |
| 💬 Subtítulos | Idioma de subtítulos (`none` = sin preferencia) | `none` |
| 🎬 Calidad | Calidad preferida | `1080p` |
| 🌱 Seeders mínimos | Descartar streams con menos seeders | `5` |

6. Haz clic en **"Install"**

---

## ⚙️ Configuración de URLs de addons

El addon consulta los streams de otros addons ya instalados. Solo necesitas pegar la URL base de cada addon que uses.

### Torrentio (el más popular)

La URL de Torrentio tiene opciones configurables:

```
https://torrentio.strem.fun/sort=seeders
https://torrentio.strem.fun/sort=seeders|qualityfilter=480p,scr,cam
https://torrentio.strem.fun/providers=yts,eztv|sort=seeders|limit=20
```

Para múltiples addons, separar por coma:
```
https://torrentio.strem.fun/sort=seeders,https://otro-addon.com/ruta
```

---

## 🧠 Cómo puntúa los streams

```
Score total = audio + calidad + subtítulos + seeders (desempate)

Audio exacto (ej: spa)     → +500 pts  ← PRIORIDAD MÁX.
Calidad exacta (ej: 1080p) → +300 pts
Calidad superior           → +250 pts
Subtítulos exactos         → +150 pts
Seeders (logarítmico)      → hasta +50 pts
```

**Ejemplo con preferencias: audio=spa, calidad=1080p**

| Stream | Score |
|--------|-------|
| `Pelicula.1080p.Español 320 seeders` | **990** ✅ |
| `Pelicula.4K.Español 50 seeders`     | 804 |
| `Pelicula.720p.Spanish 200 seeders`  | 786 |
| `Movie.1080p.English 500 seeders`    | 370 |

→ Se conecta directamente al primero, sin preguntar.

---

## 🔄 Arranque automático (opcional)

Para que el addon arranque solo al encender el PC:

**Windows** — crea un archivo `start.bat`:
```batch
@echo off
cd C:\stremio-smart-selector
node index.js
```
Añádelo a la carpeta de inicio: `Win+R` → `shell:startup`

**macOS / Linux** — con PM2:
```bash
npm install -g pm2
pm2 start index.js --name "smart-selector"
pm2 startup    # sigue las instrucciones que muestra
pm2 save
```

---

## 🌐 Puerto personalizado

```bash
PORT=8080 node index.js   # Linux / macOS
set PORT=8080 && node index.js   # Windows cmd
```

Luego instala en Stremio con: `http://127.0.0.1:8080/manifest.json`

---

## ❓ Problemas frecuentes

**"No streams found"**
→ Comprueba que la URL del addon en la configuración es correcta y accesible desde tu navegador.

**Stremio no encuentra el addon**
→ Asegúrate de que el servidor está corriendo (`node index.js`) y usa `127.0.0.1` en vez de `localhost`.

**"Cannot find module"**
→ Ejecuta `npm install` en la carpeta del proyecto.

**El picker sigue apareciendo**
→ Stremio muestra el picker cuando hay múltiples addons instalados que devuelven streams. Smart Selector solo devuelve 1, así que desactiva los otros addons de streams o ponlos después.
