import { createServer } from "node:http";
import app from "./index";
import { createNodeMiddleware, createProbot } from "probot";

console.log("[reviewbot] starting Probot server bootstrap...");

// createProbot() reads APP_ID, PRIVATE_KEY, WEBHOOK_SECRET, etc. from env
const probot = createProbot();
const middleware = createNodeMiddleware(app, { probot });

const port = Number(process.env.PORT ?? 3000);

const server = createServer((req, res) => {
  // Health check endpoint for Render
  if (req.url === "/" || req.url === "/healthz") {
    res.statusCode = 200;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("ok");
    return;
  }

  middleware(req, res, () => {
    res.statusCode = 404;
    res.end("not found");
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`[reviewbot] listening on http://0.0.0.0:${port}`);
});
