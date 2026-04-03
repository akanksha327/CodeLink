import { createServer } from "node:http";
import { createApp } from "./app.ts";
import { env } from "./config/env.ts";
import { db } from "./lib/db.ts";
import { ensureDatabaseSchema } from "./lib/ensure-db-schema.ts";
import { createSocketServer } from "./socket/index.ts";

const app = createApp();
const httpServer = createServer(app);
const io = createSocketServer(httpServer);

app.set("io", io);

let isShuttingDown = false;

function closeHttpServer() {
  return new Promise<void>((resolve) => {
    httpServer.close((error) => {
      if (error && (error as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING") {
        console.error("Error while closing HTTP server:", error);
      }

      resolve();
    });
  });
}

async function shutdown(reason: string, exitCode = 0) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`Shutting down CodeLink backend (${reason})...`);

  try {
    io.close();
    await closeHttpServer();
    await db.$disconnect();
  } catch (error) {
    console.error("Error during backend shutdown:", error);
    exitCode = 1;
  } finally {
    process.exit(exitCode);
  }
}

httpServer.on("error", (error) => {
  const err = error as NodeJS.ErrnoException;

  if (err.code === "EADDRINUSE") {
    console.error(`Port ${env.PORT} is already in use.`);
    process.exit(1);
  }

  console.error("Backend server error:", error);
  process.exit(1);
});

process.on("SIGINT", () => {
  void shutdown("received SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("received SIGTERM");
});

process.on("SIGBREAK", () => {
  void shutdown("received SIGBREAK");
});

process.on("disconnect", () => {
  void shutdown("watch parent disconnected");
});

async function bootstrap() {
  try {
    await db.$connect();
    await ensureDatabaseSchema();
  } catch (error) {
    console.error(
      `Could not connect to PostgreSQL using DATABASE_URL=${env.DATABASE_URL}`,
    );
    console.error("Start PostgreSQL or update backend/.env before retrying.");
    console.error(error);
    process.exit(1);
  }

  httpServer.listen(env.PORT, () => {
    console.log(`CodeLink backend running on http://localhost:${env.PORT}`);
    console.log(`Health check: http://localhost:${env.PORT}/health`);
  });
}

void bootstrap();
