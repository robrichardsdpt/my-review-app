import { createServer } from "node:http";
import app from "./index";
import { createNodeMiddleware, Probot } from "probot";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

function normalizePrivateKey(raw: string): string {
  // Render often stores PEMs with literal "\n". Convert to real newlines.
  let key = raw.replace(/\\n/g, "\n").trim();

  // Ensure PEM ends with a newline; some parsers are picky.
  if (!key.endsWith("\n")) key += "\n";

  return key;
}

console.log("[reviewbot] starting Probot server bootstrap...");

const webhookPath = "/api/github/webhooks";

const probot = new Probot({
  appId: Number(requireEnv("APP_ID")),
  privateKey: normalizePrivateKey(requireEnv("PRIVATE_KEY")),
  secret: requireEnv("WEBHOOK_SECRET"),
});

const middleware = createNodeMiddleware(app, {
  probot,
  webhooksPath: webhookPath,
});

const port = Number(process.env.PORT ?? 3000);

const server = createServer((req, res) => {
  const start = Date.now();
  const method = req.method ?? "?";
  const url = req.url ?? "?";

  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`[reviewbot] ${method} ${url} -> ${res.statusCode} (${ms}ms)`);
  });

  if (url === "/" || url === "/healthz") {
    res.statusCode = 200;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("ok");
    return;
  }

  if (url === "/debug" && method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      console.log(
        `[reviewbot] /debug payload (first 2KB): ${body.slice(0, 2048)}`
      );
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

  // Only handle the webhook path; return 404 for everything else.
  if (url?.startsWith(webhookPath)) {
    middleware(req, res, () => {
      res.statusCode = 404;
      res.end("not found");
    });
    return;
  }

  res.statusCode = 404;
  res.end("not found");
});

server.listen(port, "0.0.0.0", () => {
  console.log(
    `[reviewbot] listening on http://0.0.0.0:${port} (webhooks: ${webhookPath})`
  );
});
