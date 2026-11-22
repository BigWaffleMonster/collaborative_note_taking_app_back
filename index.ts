import { app } from "./src/app";
import { config } from "./src/config";

console.log(`Bun auth API listening on http://localhost:${config.port}`);

export default {
  port: config.port,
  fetch: app.fetch,
};
