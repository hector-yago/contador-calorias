# contador-calorias

Contador de calorías sencillo tipo Yazio. Proyecto **nuevo**, contexto **personal**.

## Decisiones (origen: conversación inicial, 2026-11-07)
- PWA instalable en iPhone desde Safari (sin App Store); después Android sin Play Store con el mismo código.
- Datos solo en el dispositivo (IndexedDB vía Dexie). Copia manual exportar/importar JSON desde Perfil. Sin cuentas ni servidor.
- Alojamiento: solo código estático (GitHub Pages) porque iOS exige HTTPS para service worker y cámara. Funciona offline tras la primera carga; buscar/escanear productos nuevos necesita red (Open Food Facts).
- Sin rachas, sin notificaciones, sin recetas. Sin filtro por supermercado en la búsqueda (decisión del usuario, 2026-11-07).
- Búsqueda OFF con autocompletado (debounce 500 ms) y reintentos: el endpoint legacy devuelve 503 intermitentes sin cabeceras CORS (el navegador lo ve como error de red). `search.openfoodfacts.org` no envía Access-Control-Allow-Origin, no usable desde el navegador.
- Angular 22 (zoneless, standalone, signals), Vitest, rutas con hash (`withHashLocation`) por GitHub Pages.
- Escáner: `@zxing/browser` (Safari iOS no tiene `BarcodeDetector`).
- Código en inglés, UI y docs en castellano. Cobertura ≥ 70 %, `npm audit` sin vulnerabilidades altas.

## Cálculo (src/app/core/calc.ts)
Mifflin-St Jeor × actividad (1,375 / 1,55 / 1,725) + objetivo kg/semana × 7700 / 7. Días altos: +X % y el resto baja para conservar el total semanal. Macros objetivo: proteína 1,8 g/kg, grasa 25 % kcal, resto carbohidratos (referencia, no consejo médico).

## Comandos
`npm start` · `npx ng test --watch=false` · `npx ng build --base-href "/<repo>/"`. Probar PWA/service worker solo con build de producción servido por HTTP(S).

## Pendiente
- Probar en iPhone real (instalación, cámara, offline, export/import).
- Ampliar cobertura de OFF para supermercados con pocos datos (alta manual disponible).
