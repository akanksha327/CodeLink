import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { env } from "../config/env.ts";
import { AppError } from "../lib/errors.ts";

const supportedLanguages = [
  "javascript",
  "typescript",
  "python",
  "java",
  "cpp",
] as const;

const runCodeSchema = z.object({
  code: z.string().trim().min(1, "Code is required"),
  language: z.enum(supportedLanguages, {
    errorMap: () => ({ message: "Unsupported language" }),
  }),
  stdin: z.string().optional().default(""),
});

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  compileOutput: string;
  status: string;
  statusCode: number;
  time: string;
  memory: string;
  simulated?: boolean;
}

type SupportedLanguage = (typeof supportedLanguages)[number];

type Judge0Status = {
  id: number;
  description: string;
};

type Judge0Language = {
  id: number;
  name: string;
};

type Judge0SubmissionTokenResponse = {
  token: string;
};

type Judge0SubmissionResult = {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  status: Judge0Status;
  time: string | null;
  memory: number | null;
};

const processingStatusIds = new Set([1, 2]);
const judge0RequestTimeoutMs = 15_000;
const languageCacheTtlMs = 10 * 60 * 1000;

const fallbackLanguageIds: Record<SupportedLanguage, number> = {
  javascript: 63,
  typescript: 74,
  python: 71,
  java: 62,
  cpp: 54,
};

const languageMatchers: Record<SupportedLanguage, RegExp> = {
  javascript: /^JavaScript\b/i,
  typescript: /^TypeScript\b/i,
  python: /^Python\b/i,
  java: /^Java\b/i,
  cpp: /^C\+\+\b/i,
};

let cachedLanguages:
  | {
      expiresAt: number;
      languages: Judge0Language[];
    }
  | undefined;

function getJudge0BaseUrl() {
  return env.JUDGE0_API_URL.endsWith("/")
    ? env.JUDGE0_API_URL
    : `${env.JUDGE0_API_URL}/`;
}

function getJudge0Headers() {
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
  });

  if (env.JUDGE0_AUTH_TOKEN) {
    headers.set("X-Auth-Token", env.JUDGE0_AUTH_TOKEN);
  }

  if (env.JUDGE0_AUTH_USER) {
    headers.set("X-Auth-User", env.JUDGE0_AUTH_USER);
  }

  return headers;
}

async function fetchJudge0Json<T>(path: string, init?: RequestInit): Promise<T> {
  const url = new URL(path, getJudge0BaseUrl());
  const headers = getJudge0Headers();

  if (init?.headers) {
    const extraHeaders = new Headers(init.headers);
    extraHeaders.forEach((value, key) => {
      headers.set(key, value);
    });
  }

  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      headers,
      signal: AbortSignal.timeout(judge0RequestTimeoutMs),
    });
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");

    throw new AppError(
      timedOut
        ? "Judge0 request timed out. Please try again."
        : "Unable to reach the Judge0 execution service.",
      502,
    );
  }

  const rawBody = await response.text();
  const body = rawBody
    ? (() => {
        try {
          return JSON.parse(rawBody);
        } catch {
          return null;
        }
      })()
    : null;

  if (!response.ok) {
    const message =
      typeof body?.error === "string"
        ? body.error
        : typeof body?.message === "string"
          ? body.message
          : `Judge0 request failed with status ${response.status}.`;

    throw new AppError(message, 502);
  }

  if (body === null) {
    throw new AppError("Judge0 returned an invalid response body.", 502);
  }

  return body as T;
}

function getLanguageVersionScore(name: string) {
  const versionMatch = name.match(/(\d+(?:\.\d+)+)(?!.*\d)/);

  if (!versionMatch) {
    return 0;
  }

  return versionMatch[1]
    .split(".")
    .map((part) => Number(part) || 0)
    .reduce((score, part) => score * 1000 + part, 0);
}

async function getJudge0Languages() {
  if (cachedLanguages && cachedLanguages.expiresAt > Date.now()) {
    return cachedLanguages.languages;
  }

  const languages = await fetchJudge0Json<Judge0Language[]>("languages");

  cachedLanguages = {
    languages,
    expiresAt: Date.now() + languageCacheTtlMs,
  };

  return languages;
}

async function resolveJudge0LanguageId(language: SupportedLanguage) {
  try {
    const languages = await getJudge0Languages();
    const matcher = languageMatchers[language];
    const matchingLanguages = languages.filter(({ name }) => matcher.test(name));

    if (matchingLanguages.length > 0) {
      return matchingLanguages
        .sort((left, right) => {
          const scoreDifference =
            getLanguageVersionScore(right.name) - getLanguageVersionScore(left.name);

          if (scoreDifference !== 0) {
            return scoreDifference;
          }

          return right.id - left.id;
        })[0].id;
    }
  } catch (error) {
    console.warn("Could not fetch Judge0 language list, using fallback ids.", error);
  }

  return fallbackLanguageIds[language];
}

function formatTime(value: string | null) {
  if (!value) {
    return "N/A";
  }

  return /[a-z]/i.test(value) ? value : `${value}s`;
}

function formatMemory(value: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "N/A";
  }

  return `${value} KB`;
}

function mapJudge0Result(result: Judge0SubmissionResult): ExecutionResult {
  const statusCode = result.status?.id ?? 0;
  const status = result.status?.description ?? "Unknown";
  const timedOut =
    statusCode === 5 || /time limit/i.test(status) || /timed out/i.test(status);
  const compileOutput =
    result.compile_output ??
    (statusCode === 6 ? result.message ?? status : "");

  const stderr = timedOut
    ? result.stderr || result.message || "Execution timed out."
    : result.stderr ??
      (statusCode !== 3 && !compileOutput ? result.message ?? "" : "");

  return {
    stdout: result.stdout ?? "",
    stderr,
    compileOutput,
    status,
    statusCode,
    time: formatTime(result.time),
    memory: formatMemory(result.memory),
    simulated: false,
  };
}

function buildPollingTimeoutResult(): ExecutionResult {
  return {
    stdout: "",
    stderr: "Judge0 took too long to return a result. Please try again.",
    compileOutput: "",
    status: "Timeout",
    statusCode: 5,
    time: "N/A",
    memory: "N/A",
    simulated: false,
  };
}

async function createSubmission(
  code: string,
  languageId: number,
  stdin: string,
) {
  return fetchJudge0Json<Judge0SubmissionTokenResponse>(
    "submissions?base64_encoded=false&wait=false",
    {
      method: "POST",
      body: JSON.stringify({
        source_code: code,
        language_id: languageId,
        stdin,
      }),
    },
  );
}

async function pollSubmission(token: string) {
  for (let attempt = 0; attempt < env.JUDGE0_MAX_POLL_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await delay(env.JUDGE0_POLL_INTERVAL_MS);
    }

    const result = await fetchJudge0Json<Judge0SubmissionResult>(
      `submissions/${token}?base64_encoded=false&fields=stdout,stderr,compile_output,message,status,time,memory`,
      {
        method: "GET",
      },
    );

    if (!processingStatusIds.has(result.status?.id ?? 0)) {
      return result;
    }
  }

  return null;
}

export async function executeCode(input: unknown): Promise<ExecutionResult> {
  const { code, language, stdin } = runCodeSchema.parse(input);
  const languageId = await resolveJudge0LanguageId(language);
  const submission = await createSubmission(code, languageId, stdin);

  if (!submission.token) {
    throw new AppError("Judge0 did not return a submission token.", 502);
  }

  const result = await pollSubmission(submission.token);

  if (!result) {
    return buildPollingTimeoutResult();
  }

  return mapJudge0Result(result);
}
