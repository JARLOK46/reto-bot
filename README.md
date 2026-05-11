# Telegram Resta Bot MVP

Bot de Telegram hecho con Node.js + Telegraf para practicar restas en sesiones efimeras por chat.

## Alcance del MVP

- Comando `/start` para iniciar o reiniciar una sesion.
- Una sola sesion activa por chat, almacenada solo en memoria.
- Cada turno dura `15` segundos por defecto. Si se vence el tiempo, termina toda la sesion.
- El usuario puede responder tocando un boton o escribiendo el numero correcto manualmente.
- Cada acierto suma `+1` por defecto y genera una nueva resta.
- Cualquier respuesta incorrecta termina la sesion y muestra el puntaje final.
- Progresion fija de dificultad:
  - Nivel 1: operandos de `0` a `9`.
  - Nivel 2: operandos de `10` a `99`.
  - El nivel sube automaticamente al llegar a `20` puntos.

## Limitaciones

- El estado vive en memoria (`Map` por `chat.id`). Si el proceso reinicia, todas las sesiones se pierden.
- El bot NO depende de borrar el historial del chat para cerrar partidas.

## Variables de entorno

- `BOT_TOKEN` (obligatoria): token del bot de Telegram.
- `SCORE_INCREMENT` (opcional, default `1`): puntos otorgados por cada acierto.
- `TURN_TIMEOUT_SECONDS` (opcional, default `15`): duracion maxima de cada turno.
- `DASHBOARD_PORT` (opcional, default `3000`): puerto local del dashboard HTML read-only.

## Setup local

1. Copia el ejemplo de entorno:
   - Windows PowerShell: `Copy-Item .env.example .env`
2. Completa `BOT_TOKEN` en `.env`.
3. Instala dependencias:
   - `npm install`
4. Ejecuta el bot:
    - Desarrollo: `npm run dev`
    - Produccion local: `npm start`
5. Abre el dashboard local en `http://127.0.0.1:<DASHBOARD_PORT>/dashboard`.

## Dashboard HTML operativo

- URL HTML: `GET /dashboard`
- Snapshot JSON: `GET /api/snapshot`
- Health local: `GET /api/health`

### Verdad del MVP

- El dashboard es COMPLEMENTARIO al bot y corre en el mismo proceso para leer el `Map` vivo en memoria.
- La vista es read-only: no hay controles de escritura ni administracion desde web.
- NO existe historico persistente. Si el proceso reinicia, las sesiones previas desaparecen del dashboard.
- El tablero muestra solo el snapshot disponible al momento de la consulta.

## Pruebas

- Ejecuta `npm test`.

## Validacion explicita del MVP

- Este MVP usa CommonJS puro y no tiene etapa de build ni type-check porque no hay TypeScript ni bundling en el alcance definido.
- Para dejar una compuerta adicional mas alla de los tests, ejecuta `npm run validate`.
- `npm run validate` primero verifica sintaxis real de `src/` y `test/` con `node --check` y despues corre `npm test`.
