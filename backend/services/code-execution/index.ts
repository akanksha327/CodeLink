import { createServer } from "node:http";
import { executeCode } from "../../src/services/code-execution.service.ts";

const PORT = 3001;

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (url.pathname === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        status: "ok",
        service: "code-execution",
        port: PORT,
        mode: "judge0",
        languages: ["javascript", "typescript", "python", "java", "cpp"],
      }),
    );
    return;
  }

  if (url.pathname === "/run" && request.method === "POST") {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk.toString();
    });

    request.on("end", () => {
      void (async () => {
        const payload = body ? JSON.parse(body) : {};
        const result = await executeCode(payload);
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify(result));
      })().catch(() => {
        response.writeHead(400, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: "Invalid request body" }));
      });
    });

    return;
  }

  response.writeHead(404, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`Code execution simulator running on http://localhost:${PORT}`);
});
