import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

config({ path: resolve(__dirname, "../../../.env") });

export interface SparkConfig {
  mcpPort: number;
  ollamaHost: string;
  vllmImage: string;
  vllmPort: number;
  vllmGpuMemoryUtilization: number;
}

export function loadConfig(): SparkConfig {
  return {
    mcpPort: parseInt(process.env.MCP_PORT ?? "3100", 10),
    ollamaHost: process.env.OLLAMA_HOST ?? "localhost:11434",
    vllmImage: process.env.VLLM_IMAGE ?? "nvcr.io/nvidia/vllm:latest",
    vllmPort: parseInt(process.env.VLLM_PORT ?? "8000", 10),
    vllmGpuMemoryUtilization: parseFloat(process.env.VLLM_GPU_MEMORY_UTILIZATION ?? "0.7"),
  };
}
