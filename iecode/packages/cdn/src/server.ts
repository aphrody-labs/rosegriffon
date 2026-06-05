/**
 * Entrypoint du CDN iecode — streaming LIVE des assets menu depuis les CPK IEVR.
 * Décode g4tx -> PNG à la volée (loadIecode -> MenuPngService), aucune écriture disque.
 * Servi derrière nginx (cdn.rosegriffon.fr/g4tx/...). Port 127.0.0.1:CDN_PORT.
 */
import { serveMenuCdn } from "./serve.ts";

const gamePath = process.env.IEVR_GAME_PATH ?? "/home/ubuntu/.local/share/Steam/iecode/inazuma";
const port = Number(process.env.CDN_PORT ?? "8788");
const s = serveMenuCdn({ gamePath, port, hostname: "127.0.0.1" });
console.log(`iecode-cdn live ${s.url} (game=${gamePath})`);
process.on("SIGTERM", () => { s.stop(); process.exit(0); });
process.on("SIGINT", () => { s.stop(); process.exit(0); });
