import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../mcp-server/src/utils/run.js", () => ({
  run: vi.fn(),
  runJson: vi.fn(),
}));

vi.mock("../../mcp-server/src/utils/config.js", () => ({
  loadConfig: () => ({
    mcpPort: 3100,
    ollamaHost: "localhost:11434",
    vllmImage: "nvcr.io/nvidia/vllm:latest",
    vllmPort: 8000,
    vllmGpuMemoryUtilization: 0.7,
  }),
}));

import { sparkListModels, sparkStopModel } from "../../mcp-server/src/tools/models.js";
import { run, runJson } from "../../mcp-server/src/utils/run.js";

const mockRun = vi.mocked(run);
const mockRunJson = vi.mocked(runJson);

describe("sparkListModels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns models from both backends", async () => {
    mockRunJson.mockResolvedValueOnce({
      models: [
        { name: "llama3.1:8b", size: 4700000000, modified_at: "2026-03-01T00:00:00Z" },
      ],
    });

    mockRun.mockResolvedValueOnce({
      stdout: "abc123\tvllm-qwen3\tUp 2 hours\t0.0.0.0:8000->8000/tcp",
      stderr: "",
      exitCode: 0,
    });

    const result = await sparkListModels();

    expect(result.ollama).toHaveLength(1);
    expect(result.ollama[0].name).toBe("llama3.1:8b");
    expect(result.ollama[0].backend).toBe("ollama");

    expect(result.vllm).toHaveLength(1);
    expect(result.vllm[0].name).toBe("vllm-qwen3");
    expect(result.vllm[0].status).toBe("running");

    expect(result.totalModels).toBe(2);
  });

  it("handles Ollama being unavailable", async () => {
    mockRunJson.mockRejectedValueOnce(new Error("Connection refused"));

    mockRun.mockResolvedValueOnce({
      stdout: "",
      stderr: "",
      exitCode: 0,
    });

    const result = await sparkListModels();

    expect(result.ollama).toHaveLength(0);
    expect(result.vllm).toHaveLength(0);
  });
});

describe("sparkStopModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stops and removes container", async () => {
    mockRun
      .mockResolvedValueOnce({ stdout: "vllm-qwen3", stderr: "", exitCode: 0 }) // stop
      .mockResolvedValueOnce({ stdout: "vllm-qwen3", stderr: "", exitCode: 0 }); // rm

    const result = await sparkStopModel({ containerName: "vllm-qwen3" });

    expect(result.status).toBe("stopped");
    expect(mockRun).toHaveBeenCalledTimes(2);
  });

  it("throws on stop failure", async () => {
    mockRun.mockResolvedValueOnce({
      stdout: "",
      stderr: "No such container",
      exitCode: 1,
    });

    await expect(sparkStopModel({ containerName: "nonexistent" })).rejects.toThrow(
      "Failed to stop"
    );
  });
});
