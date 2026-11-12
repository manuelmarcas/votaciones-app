# 🗳️ Votaciones

App web para crear votaciones de fechas y compartirlas con un grupo. Es la evolución de
[votaciones](https://github.com/manuelmarcas/votaciones) (la votación de comida/cena de Navidad),
pero todo es configurable.

## Qué se puede hacer

- **Crear votaciones** con:
  1. Nombre (y descripción opcional).
  2. Tipo: **horas**, **días**, **semanas** o **meses**.
  3. Los meses en los que estará la votación (pueden ser de años distintos).
  4. Los días (o semanas) concretos que se podrán votar dentro de esos meses. El resto aparecen bloqueados.
     Hay atajos (todos, ninguno, lunes a viernes, fines de semana) y, en ordenador, Mayús + clic marca un rango.
  5. En las de **días**: de 1 a 4 opciones por día (p. ej. comida y cena), cada una con su nombre y su icono.
     El icono se ve en el calendario y el nombre en la leyenda.
  6. En las de **horas**: rango horario (desde/hasta) y duración de cada franja (30 min, 1 h, 2 h),
     que se repite en cada día elegido.
- **Votar** pulsando en el calendario, con el contador en cada casilla, el borde verde en lo más votado,
  el resumen de "opciones más votadas" y la tabla por participante, igual que en el original.
- **Mis votaciones**: cada usuario tiene su colección (las que ha creado y aquellas en las que ha entrado)
  y puede organizarla en **grupos** con el nombre que quiera (crear, renombrar, eliminar, mover votaciones).
- **Compartir** con enlace, **código QR** (también descargable en PNG), WhatsApp, Telegram, correo
  o el menú de compartir del móvil.
- Quien abre el enlace e inicia sesión **queda como participante** (aparece en la tabla aunque aún no haya votado)
  y la votación **se añade a su menú**.
- El creador puede **cerrar/reabrir** la votación (cerrada ya no admite cambios) y **eliminarla**.

## Probarla en local (modo demo, sin Firebase)

Al ser módulos ES, hay que servirla por HTTP (no vale abrir el archivo con doble clic):

```bash
python -m http.server 8000
```

y abre <http://localhost:8000/?demo>. En modo demo los datos se guardan en el `localStorage` del navegador
y te pide solo un nombre. Para simular a varias personas, abre otra pestaña y entra con otro nombre.

Sin `?demo`, usa Firebase (login con Google) con el proyecto configurado en `js/config.js`.

## Ponerla en marcha con Firebase

`js/config.js` ya apunta al mismo proyecto de Firebase que el original (`votaciones-9bc95`).

1. **Reglas de Firestore**: la app usa colecciones nuevas (`polls` y `users`), así que hay que publicar
   las reglas de [`firestore.rules`](firestore.rules) en *Firebase Console › Firestore Database › Reglas*.
   El archivo incluye también la regla de `/votes` para que la votación de Navidad original siga funcionando;
   si tus reglas actuales para `/votes` son distintas, conserva las tuyas y añade el resto.
2. **Authentication**: el proveedor de Google ya está activado. Si publicas la app en un dominio nuevo,
   añádelo en *Authentication › Configuración › Dominios autorizados* (`localhost` ya viene incluido).
3. **Publicarla**: es una web estática sin compilación. Por ejemplo, con GitHub Pages:
   sube el repositorio y activa *Settings › Pages › Deploy from a branch* (`main`, carpeta raíz).

## Estructura

```
index.html            Contenedor: login, barra superior y vista
css/styles.css        Estilos (misma paleta que el original)
js/app.js             Arranque, sesión y rutas (#/, #/nueva, #/v/<id>)
js/home.js            "Mis votaciones" con grupos
js/create.js          Asistente de nueva votación
js/poll.js            Calendario, votos, resumen y participantes
js/share.js           Diálogo de compartir y QR
js/model.js           Modelo de la votación y recuentos
js/dates.js           Utilidades de fechas (semanas ISO, rangos, formatos)
js/store.js           Datos: Firebase o modo demo (misma interfaz)
js/config.js          Configuración de Firebase
js/vendor/qrcode.js   qrcode-generator 1.4.4 (MIT, Kazuhiko Arase)
firestore.rules       Reglas de seguridad
```

## Modelo de datos (Firestore)

| Ruta | Contenido |
| --- | --- |
| `polls/{pollId}` | `title`, `description`, `type`, `months`, `slots` (días, lunes de cada semana o meses votables), `hours` y `hourStep` (solo horas), `options` (solo días), `ownerUid`, `ownerName`, `createdAt`, `closed` |
| `polls/{pollId}/votes/{uid}` | Un documento por participante: `name`, `photo`, `picks` (`"<casilla>\|<opción>"`), `seenAt`, `updatedAt` |
| `users/{uid}/polls/{pollId}` | Colección privada del usuario: `title`, `type`, `role` (`owner`/`participant`), `groupId`, `addedAt`, `openedAt` |
| `users/{uid}/groups/{groupId}` | Grupos privados del usuario: `name`, `createdAt` |

Cualquier usuario con sesión puede abrir una votación si tiene el enlace; solo el creador puede cerrarla o
borrarla; cada uno solo puede modificar su propio voto; y la colección/grupos de cada usuario es privada.
