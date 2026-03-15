import { z } from "zod";
import { run } from "../utils/run.js";

export const sparkVpnStatusSchema = z.object({});

export async function sparkVpnStatus() {
  const result = await run("tailscale", ["status", "--json"], {
    timeout: 10_000,
  });

  if (result.exitCode !== 0) {
    return {
      installed: false,
      connected: false,
      error: result.stderr || "Tailscale not available",
    };
  }

  try {
    const status = JSON.parse(result.stdout) as {
      BackendState: string;
      Self: { TailscaleIPs: string[]; HostName: string };
      Peer: Record<
        string,
        { HostName: string; TailscaleIPs: string[]; Online: boolean }
      >;
    };

    const peers = Object.values(status.Peer ?? {}).map((p) => ({
      hostname: p.HostName,
      ips: p.TailscaleIPs,
      online: p.Online,
    }));

    return {
      installed: true,
      connected: status.BackendState === "Running",
      backendState: status.BackendState,
      self: {
        hostname: status.Self?.HostName,
        ips: status.Self?.TailscaleIPs,
      },
      peers,
      peerCount: peers.length,
    };
  } catch {
    return {
      installed: true,
      connected: false,
      error: "Failed to parse Tailscale status",
      raw: result.stdout,
    };
  }
}

export const sparkHealthCheckSchema = z.object({});

export async function sparkHealthCheck() {
  const start = Date.now();
  return {
    healthy: true,
    latencyMs: Date.now() - start,
    timestamp: new Date().toISOString(),
  };
}
