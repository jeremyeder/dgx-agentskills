import { z } from "zod";
import { run } from "../utils/run.js";

export const sparkGetStatusSchema = z.object({});

export async function sparkGetStatus() {
  const [uptime, loadavg, meminfo, disk] = await Promise.all([
    run("cat", ["/proc/uptime"]),
    run("cat", ["/proc/loadavg"]),
    run("cat", ["/proc/meminfo"]),
    run("df", ["-h", "--output=target,size,used,avail,pcent", "/"]),
  ]);

  const uptimeSeconds = parseFloat(uptime.stdout.split(" ")[0]);
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);

  const loadParts = loadavg.stdout.split(" ");

  const memLines = meminfo.stdout.split("\n");
  const memTotal = extractMemValue(memLines, "MemTotal");
  const memAvailable = extractMemValue(memLines, "MemAvailable");
  const memUsed = memTotal - memAvailable;

  return {
    uptime: `${days}d ${hours}h`,
    uptimeSeconds,
    load: {
      avg1: parseFloat(loadParts[0]),
      avg5: parseFloat(loadParts[1]),
      avg15: parseFloat(loadParts[2]),
    },
    memory: {
      totalMB: Math.round(memTotal / 1024),
      usedMB: Math.round(memUsed / 1024),
      availableMB: Math.round(memAvailable / 1024),
      percentUsed: Math.round((memUsed / memTotal) * 100),
    },
    disk: disk.stdout,
  };
}

function extractMemValue(lines: string[], key: string): number {
  const line = lines.find((l) => l.startsWith(key + ":"));
  if (!line) return 0;
  const match = line.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export const sparkGpuUtilizationSchema = z.object({});

export async function sparkGpuUtilization() {
  const result = await run("nvidia-smi", [
    "--query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu,utilization.memory,temperature.gpu,power.draw,power.limit",
    "--format=csv,noheader,nounits",
  ]);

  if (result.exitCode !== 0) {
    throw new Error(`nvidia-smi failed: ${result.stderr}`);
  }

  const parts = result.stdout.split(", ").map((s) => s.trim());

  return {
    name: parts[0],
    memory: {
      totalMB: parseInt(parts[1], 10),
      usedMB: parseInt(parts[2], 10),
      freeMB: parseInt(parts[3], 10),
      percentUsed: Math.round((parseInt(parts[2], 10) / parseInt(parts[1], 10)) * 100),
    },
    utilization: {
      gpuPercent: parseInt(parts[4], 10),
      memoryPercent: parseInt(parts[5], 10),
    },
    temperatureC: parseInt(parts[6], 10),
    power: {
      drawW: parseFloat(parts[7]),
      limitW: parseFloat(parts[8]),
    },
  };
}
