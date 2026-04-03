import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { env } from "./config/env.ts";
import { authRouter } from "./routes/auth.routes.ts";
import { sessionRouter } from "./routes/session.routes.ts";
import { userRouter } from "./routes/user.routes.ts";
import { runCodeRouter } from "./routes/run-code.routes.ts";
import { errorHandler } from "./middleware/error-handler.ts";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);

  app.use((_request, response, next) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    response.setHeader("Cross-Origin-Resource-Policy", "same-site");
    next();
  });

  app.use(
    cors({
      origin: env.allowedCorsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/health", (_request, response) => {
    response.json({
      status: "ok",
      service: "codelink-backend",
      port: env.PORT,
    });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/session", sessionRouter);
  app.use("/api/users", userRouter);
  app.use("/api/run-code", runCodeRouter);

  app.use((_request, response) => {
    response.status(404).json({ error: "Not found" });
  });

  app.use(errorHandler);

  return app;
}
