import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../mcp-server/src/utils/run.js", () => ({
  run: vi.fn(),
}));

import { sparkGetStatus, sparkGpuUtilization } from "../../mcp-server/src/tools/status.js";
import { run } from "../../mcp-server/src/utils/run.js";

const mockRun = vi.mocked(run);

describe("sparkGetStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns system metrics", async () => {
    mockRun
      .mockResolvedValueOnce({ stdout: "12345.67 11111.22", stderr: "", exitCode: 0 }) // uptime
      .mockResolvedValueOnce({ stdout: "0.42 0.38 0.35 1/234 5678", stderr: "", exitCode: 0 }) // loadavg
      .mockResolvedValueOnce({
        stdout: "MemTotal:       131072000 kB\nMemFree:         8000000 kB\nMemAvailable:   65536000 kB\n",
        stderr: "",
        exitCode: 0,
      }) // meminfo
      .mockResolvedValueOnce({ stdout: "/     500G  234G  266G  47%", stderr: "", exitCode: 0 }); // disk

    const result = await sparkGetStatus();

    expect(result.load.avg1).toBe(0.42);
    expect(result.memory.totalMB).toBeGreaterThan(0);
    expect(result.memory.percentUsed).toBeGreaterThan(0);
    expect(result.memory.percentUsed).toBeLessThanOrEqual(100);
    expect(result.uptime).toContain("d");
  });
});

describe("sparkGpuUtilization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns GPU metrics", async () => {
    mockRun.mockResolvedValueOnce({
      stdout: "NVIDIA GH100, 131072, 45000, 86072, 42, 35, 52, 180.50, 240.00",
      stderr: "",
      exitCode: 0,
    });

    const result = await sparkGpuUtilization();

    expect(result.name).toBe("NVIDIA GH100");
    expect(result.memory.totalMB).toBe(131072);
    expect(result.memory.usedMB).toBe(45000);
    expect(result.utilization.gpuPercent).toBe(42);
    expect(result.temperatureC).toBe(52);
    expect(result.power.drawW).toBe(180.5);
  });

  it("throws on nvidia-smi failure", async () => {
    mockRun.mockResolvedValueOnce({
      stdout: "",
      stderr: "nvidia-smi not found",
      exitCode: 1,
    });

    await expect(sparkGpuUtilization()).rejects.toThrow("nvidia-smi failed");
  });
});
