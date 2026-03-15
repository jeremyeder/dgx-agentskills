import { z } from "zod";
import { run } from "../utils/run.js";

export const sparkListContainersSchema = z.object({
  all: z
    .boolean()
    .optional()
    .describe("Include stopped containers (default: false)"),
});

export async function sparkListContainers(input: { all?: boolean }) {
  const args = [
    "ps",
    ...(input.all ? ["-a"] : []),
    "--format",
    '{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}\t{{.Size}}',
  ];

  const result = await run("docker", args);

  if (result.exitCode !== 0) {
    throw new Error(`docker ps failed: ${result.stderr}`);
  }

  if (!result.stdout) {
    return { containers: [], count: 0 };
  }

  const containers = result.stdout.split("\n").map((line) => {
    const [id, name, image, status, ports, size] = line.split("\t");
    return { id, name, image, status, ports, size };
  });

  return { containers, count: containers.length };
}

export const sparkContainerLogsSchema = z.object({
  containerName: z.string().describe("Container name or ID"),
  lines: z
    .number()
    .optional()
    .describe("Number of lines to tail (default: 50)"),
});

export async function sparkContainerLogs(input: {
  containerName: string;
  lines?: number;
}) {
  const lines = input.lines ?? 50;

  const result = await run("docker", [
    "logs",
    "--tail",
    String(lines),
    input.containerName,
  ]);

  if (result.exitCode !== 0) {
    throw new Error(
      `Failed to get logs for ${input.containerName}: ${result.stderr}`
    );
  }

  return {
    containerName: input.containerName,
    lines: lines,
    logs: result.stdout || result.stderr,
  };
}
