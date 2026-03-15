import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { loadConfig } from "./utils/config.js";
import {
  sparkGetStatus,
  sparkGetStatusSchema,
  sparkGpuUtilization,
  sparkGpuUtilizationSchema,
} from "./tools/status.js";
import {
  sparkListModels,
  sparkListModelsSchema,
  sparkPullModel,
  sparkPullModelSchema,
  sparkStartModel,
  sparkStartModelSchema,
  sparkStopModel,
  sparkStopModelSchema,
} from "./tools/models.js";
import {
  sparkListContainers,
  sparkListContainersSchema,
  sparkContainerLogs,
  sparkContainerLogsSchema,
} from "./tools/containers.js";
import {
  sparkVpnStatus,
  sparkVpnStatusSchema,
  sparkHealthCheck,
  sparkHealthCheckSchema,
} from "./tools/network.js";

const config = loadConfig();

const server = new McpServer({
  name: "dgx-spark",
  version: "0.1.0",
});

// Status tools
server.tool(
  "spark_get_status",
  "System overview: uptime, CPU load, memory usage, disk space",
  sparkGetStatusSchema.shape,
  async () => ({
    content: [{ type: "text", text: JSON.stringify(await sparkGetStatus(), null, 2) }],
  })
);

server.tool(
  "spark_gpu_utilization",
  "GPU metrics: memory, compute utilization, temperature, power draw",
  sparkGpuUtilizationSchema.shape,
  async () => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await sparkGpuUtilization(), null, 2),
      },
    ],
  })
);

// Model tools
server.tool(
  "spark_list_models",
  "List all models: Ollama library and running vLLM containers",
  sparkListModelsSchema.shape,
  async () => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await sparkListModels(), null, 2),
      },
    ],
  })
);

server.tool(
  "spark_pull_model",
  "Pull a model via Ollama (async: returns immediately, poll spark_list_models for completion)",
  sparkPullModelSchema.shape,
  async (input) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await sparkPullModel(input as { model: string }), null, 2),
      },
    ],
  })
);

server.tool(
  "spark_start_model",
  "Start a vLLM container serving a specified model with tool-calling support",
  sparkStartModelSchema.shape,
  async (input) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          await sparkStartModel(
            input as {
              model: string;
              port?: number;
              extraArgs?: string[];
            }
          ),
          null,
          2
        ),
      },
    ],
  })
);

server.tool(
  "spark_stop_model",
  "Stop a running model container and free GPU memory",
  sparkStopModelSchema.shape,
  async (input) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await sparkStopModel(input as { containerName: string }), null, 2),
      },
    ],
  })
);

// Container tools
server.tool(
  "spark_list_containers",
  "List all Docker containers on the Spark",
  sparkListContainersSchema.shape,
  async (input) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await sparkListContainers(input as { all?: boolean }), null, 2),
      },
    ],
  })
);

server.tool(
  "spark_container_logs",
  "Tail logs from a Docker container",
  sparkContainerLogsSchema.shape,
  async (input) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          await sparkContainerLogs(input as { containerName: string; lines?: number }),
          null,
          2
        ),
      },
    ],
  })
);

// Network tools
server.tool(
  "spark_vpn_status",
  "Tailscale VPN connection state, IP addresses, and connected peers",
  sparkVpnStatusSchema.shape,
  async () => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await sparkVpnStatus(), null, 2),
      },
    ],
  })
);

server.tool(
  "spark_health_check",
  "Verify MCP server is responding with latency measurement",
  sparkHealthCheckSchema.shape,
  async () => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(await sparkHealthCheck(), null, 2),
      },
    ],
  })
);

// HTTP server
const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

app.post("/mcp", async (req, res) => {
  await transport.handleRequest(req, res, req.body);
});

app.get("/mcp", async (req, res) => {
  await transport.handleRequest(req, res);
});

app.delete("/mcp", async (req, res) => {
  await transport.handleRequest(req, res);
});

await server.connect(transport);

const port = config.mcpPort;
app.listen(port, () => {
  console.log(`DGX Spark MCP server listening on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`MCP endpoint: http://localhost:${port}/mcp`);
});
