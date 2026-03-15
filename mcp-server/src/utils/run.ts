import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface RunOptions {
  timeout?: number;
  env?: Record<string, string>;
}

const DEFAULT_TIMEOUT = 30_000;

export async function run(
  command: string,
  args: string[] = [],
  options: RunOptions = {}
): Promise<RunResult> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;

  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout,
      env: { ...process.env, ...options.env },
      maxBuffer: 10 * 1024 * 1024,
    });
    return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 };
  } catch (error: unknown) {
    const err = error as {
      stdout?: string;
      stderr?: string;
      code?: number | string;
      killed?: boolean;
    };

    if (err.killed || err.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
      throw new Error(`Command timed out after ${timeout}ms: ${command} ${args.join(" ")}`);
    }

    return {
      stdout: (err.stdout ?? "").trim(),
      stderr: (err.stderr ?? "").trim(),
      exitCode: typeof err.code === "number" ? err.code : 1,
    };
  }
}

export async function runJson<T>(
  command: string,
  args: string[] = [],
  options: RunOptions = {}
): Promise<T> {
  const result = await run(command, args, options);
  if (result.exitCode !== 0) {
    throw new Error(
      `Command failed (exit ${result.exitCode}): ${command} ${args.join(" ")}\n${result.stderr}`
    );
  }
  return JSON.parse(result.stdout) as T;
}
