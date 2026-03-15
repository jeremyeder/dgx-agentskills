import { z } from "zod";
import { run, runJson } from "../utils/run.js";
import { loadConfig } from "../utils/config.js";

export const sparkListModelsSchema = z.object({});

interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

interface OllamaListResponse {
  models: OllamaModel[];
}

export async function sparkListModels() {
  const config = loadConfig();

  const [ollamaResult, dockerResult] = await Promise.allSettled([
    runJson<OllamaListResponse>("curl", [
      "-s",
      `http://${config.ollamaHost}/api/tags`,
    ]),
    run("docker", [
      "ps",
      "--filter",
      "ancestor=" + config.vllmImage,
      "--format",
      '{{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}',
    ]),
  ]);

  const ollamaModels =
    ollamaResult.status === "fulfilled"
      ? ollamaResult.value.models.map((m) => ({
          name: m.name,
          backend: "ollama" as const,
          sizeMB: Math.round(m.size / 1024 / 1024),
          status: "available",
          modifiedAt: m.modified_at,
        }))
      : [];

  const vllmModels =
    dockerResult.status === "fulfilled" && dockerResult.value.stdout
      ? dockerResult.value.stdout.split("\n").map((line) => {
          const [id, name, status, ports] = line.split("\t");
          return {
            name,
            backend: "vllm" as const,
            containerId: id,
            status: status.includes("Up") ? "running" : "stopped",
            ports,
          };
        })
      : [];

  return {
    ollama: ollamaModels,
    vllm: vllmModels,
    totalModels: ollamaModels.length + vllmModels.length,
  };
}

export const sparkPullModelSchema = z.object({
  model: z.string().describe("Model name to pull, e.g. 'qwen3.5:32b'"),
});

export async function sparkPullModel(input: { model: string }) {
  const config = loadConfig();

  // Start pull in background via Ollama API
  const result = await run("curl", [
    "-s",
    "-X",
    "POST",
    `http://${config.ollamaHost}/api/pull`,
    "-d",
    JSON.stringify({ name: input.model, stream: false }),
  ]);

  if (result.exitCode !== 0) {
    throw new Error(`Failed to pull model ${input.model}: ${result.stderr}`);
  }

  return {
    model: input.model,
    status: "pull_started",
    message: `Pull initiated for ${input.model}. Use spark_list_models to check availability.`,
    response: result.stdout,
  };
}

export const sparkStartModelSchema = z.object({
  model: z
    .string()
    .describe("Model name or HuggingFace path to serve via vLLM"),
  port: z
    .number()
    .optional()
    .describe("Port to serve on (default: from config)"),
  extraArgs: z
    .array(z.string())
    .optional()
    .describe("Additional vLLM arguments"),
});

export async function sparkStartModel(input: {
  model: string;
  port?: number;
  extraArgs?: string[];
}) {
  const config = loadConfig();
  const port = input.port ?? config.vllmPort;
  const containerName = `vllm-${input.model.replace(/[^a-zA-Z0-9-]/g, "-")}`;

  const args = [
    "run",
    "-d",
    "--runtime=nvidia",
    "--name",
    containerName,
    "--network=host",
    "-e",
    `VLLM_GPU_MEMORY_UTILIZATION=${config.vllmGpuMemoryUtilization}`,
    config.vllmImage,
    "--model",
    input.model,
    "--port",
    String(port),
    "--enable-auto-tool-choice",
    "--tool-call-parser",
    "hermes",
    ...(input.extraArgs ?? []),
  ];

  const result = await run("docker", args, { timeout: 60_000 });

  if (result.exitCode !== 0) {
    throw new Error(
      `Failed to start model ${input.model}: ${result.stderr}`
    );
  }

  return {
    containerId: result.stdout.slice(0, 12),
    containerName,
    model: input.model,
    endpoint: `http://localhost:${port}`,
    status: "starting",
    message: `vLLM container ${containerName} starting. Model may take a few minutes to load.`,
  };
}

export const sparkStopModelSchema = z.object({
  containerName: z
    .string()
    .describe("Container name or ID to stop"),
});

export async function sparkStopModel(input: { containerName: string }) {
  const stopResult = await run("docker", ["stop", input.containerName], {
    timeout: 30_000,
  });
  if (stopResult.exitCode !== 0) {
    throw new Error(
      `Failed to stop ${input.containerName}: ${stopResult.stderr}`
    );
  }

  await run("docker", ["rm", input.containerName]);

  return {
    containerName: input.containerName,
    status: "stopped",
    message: `Container ${input.containerName} stopped and removed.`,
  };
}
