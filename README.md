# Contador de calorías

PWA sencilla para llevar el diario de calorías y macros. Datos solo en tu móvil.

## Instalar en iPhone (sin App Store)
1. Publica la app (ver abajo) y abre la URL en **Safari**.
2. Compartir → **Añadir a pantalla de inicio**.
3. Abre la app desde el icono. Funciona sin conexión; buscar o escanear productos nuevos necesita Internet.

## Publicar (GitHub Pages)
1. Crea un repositorio en GitHub y sube el código (rama `master`).
2. Ajustes → Pages → Source: **GitHub Actions**. El workflow `.github/workflows/pages.yml` compila y publica.
3. URL: `https://<usuario>.github.io/<repositorio>/`.

## Desarrollo
```
npm install
npm start                      # desarrollo (sin service worker)
npx ng test --watch=false      # tests
npx ng build --base-href "/<repo>/"
```

## Copia de seguridad
Perfil → Exportar guarda un JSON (iCloud Drive/Archivos). Importar sustituye todos los datos.
