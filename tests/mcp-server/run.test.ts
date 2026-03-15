import { describe, it, expect } from "vitest";
import { run } from "../../mcp-server/src/utils/run.js";

describe("run", () => {
  it("executes a simple command", async () => {
    const result = await run("echo", ["hello"]);
    expect(result.stdout).toBe("hello");
    expect(result.exitCode).toBe(0);
  });

  it("returns exit code on failure", async () => {
    const result = await run("false");
    expect(result.exitCode).not.toBe(0);
  });

  it("handles timeout", async () => {
    await expect(
      run("sleep", ["10"], { timeout: 100 })
    ).rejects.toThrow("timed out");
  });
});
