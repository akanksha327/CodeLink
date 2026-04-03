import { Router } from "express";
import { asyncHandler } from "../lib/async-handler.ts";
import { executeCode } from "../services/code-execution.service.ts";

export const runCodeRouter = Router();

runCodeRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const result = await executeCode(request.body);
    response.json(result);
  }),
);
