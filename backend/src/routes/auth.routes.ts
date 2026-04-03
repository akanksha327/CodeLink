import { Router } from "express";
import { asyncHandler } from "../lib/async-handler.ts";
import {
  getSessionClearCookieOptions,
  getSessionCookieOptions,
  loginWithFirebase,
  login,
  logout,
  signup,
} from "../services/auth.service.ts";
import { requireAuth } from "../middleware/auth.ts";
import { env } from "../config/env.ts";

export const authRouter = Router();

authRouter.post(
  "/signup",
  asyncHandler(async (request, response) => {
    const result = await signup(request.body);
    response
      .cookie(env.SESSION_COOKIE_NAME, result.token, getSessionCookieOptions())
      .status(201)
      .json({ user: result.user });
  }),
);

authRouter.post(
  "/firebase",
  asyncHandler(async (request, response) => {
    const result = await loginWithFirebase(request.body);
    response
      .cookie(env.SESSION_COOKIE_NAME, result.token, getSessionCookieOptions())
      .json({ user: result.user });
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (request, response) => {
    const result = await login(request.body);
    response
      .cookie(env.SESSION_COOKIE_NAME, result.token, getSessionCookieOptions())
      .json({ user: result.user });
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (request, response) => {
    const sessionToken = request.cookies?.[env.SESSION_COOKIE_NAME];
    await logout(sessionToken);
    response.clearCookie(
      env.SESSION_COOKIE_NAME,
      getSessionClearCookieOptions(),
    );
    response.json({ success: true });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (request, response) => {
    response.json({ user: request.auth!.user });
  }),
);
