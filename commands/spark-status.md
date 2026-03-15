# /spark-status

Quick health check for the DGX Spark. Reports system status, GPU utilization, running models, and VPN connectivity.

## Instructions

1. Call the `spark_get_status` MCP tool to get system metrics
2. Call the `spark_gpu_utilization` MCP tool to get GPU metrics
3. Call the `spark_list_models` MCP tool to get running models
4. Call the `spark_vpn_status` MCP tool to get Tailscale status

Present results as a compact summary table:

```
DGX Spark Status
────────────────
System:  online | uptime 5d 3h | load 0.42
Memory:  84GB / 128GB (66%) | GPU: 45% util, 52C
Models:  2 Ollama, 1 vLLM (qwen3-coder on :8000)
VPN:     Tailscale connected | 100.64.x.x
Disk:    234GB / 500GB (47%)
```

If MCP tools are unreachable, report that the Spark appears offline.
