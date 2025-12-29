import { createServer } from "node:http";
import app from "./index";
import { createNodeMiddleware, createProbot } from "probot";

console.log("[reviewbot] starting Probot server bootstrap...");

// createProbot() reads APP_ID, PRIVATE_KEY, WEBHOOK_SECRET, etc. from env
const probot = createProbot();
const middleware = createNodeMiddleware(app, { probot });

const port = Number(process.env.PORT ?? 3000);

const server = createServer((req, res) => {
  const start = Date.now();
  const method = req.method ?? "?";
  const url = req.url ?? "?";

  // Log every request (helps debug "nothing happens" situations)
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`[reviewbot] ${method} ${url} -> ${res.statusCode} (${ms}ms)`);
  });

  // Health check endpoint for Render
  if (url === "/" || url === "/healthz") {
    res.statusCode = 200;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("ok");
    return;
  }

  // Debug endpoint: lets you verify POST traffic reaches the service.
  // This avoids GitHub signature requirements.
  if (url === "/debug" && method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      console.log(`[reviewbot] /debug payload (first 2KB): ${body.slice(0, 2048)}`);
      res.statusCode = 200;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  if (url === "/debug" && method === "GET") {
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
