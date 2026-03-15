# DGX AgentSkills

A Claude Code plugin for integrating the NVIDIA DGX Spark into AI development workflows. Provides local model serving, GPU monitoring, VM management, and hybrid local+cloud inference — all accessible through skills, commands, and MCP tools within Claude Code.

## Prerequisites

- NVIDIA DGX Spark with SSH access configured
- Node.js 20+ (for development)
- Claude Code installed
- Docker on the DGX Spark (pre-installed with DGX OS)

## Quickstart

### 1. Configure

```bash
cp .env.example .env
# Edit .env with your Spark's hostname and SSH user
```

### 2. Deploy MCP Server to Spark

```bash
./deploy/install.sh
```

This rsyncs the project to your Spark, builds the MCP server Docker container, and starts it.

### 3. Install Plugin

```bash
claude plugin add jeremyeder/dgx-agentskills
```

### 4. Verify

```
/spark-status
```

### 5. Pull a Model

```
/spark-models pull qwen3.5:32b
```

### 6. Serve via vLLM (for Claude Code integration)

```
/spark-models serve Qwen/Qwen3-Coder-Next --vllm
```

### 7. Switch Claude Code to Local Backend

```
/spark-switch local
```

## Skills

| Skill | Description |
|-------|-------------|
| `spark-setup` | Reproducible provisioning from scratch or after factory reset |
| `spark-models` | Model lifecycle management across Ollama and vLLM |
| `spark-hybrid` | Configure Claude Code to use Spark as model backend |
| `spark-vpn` | Tailscale VPN setup for remote access |
| `spark-vms` | KVM/QEMU virtual machine management |

## Commands

| Command | Description |
|---------|-------------|
| `/spark-status` | Quick health check — system, GPU, models, VPN |
| `/spark-models [action] [model]` | List, pull, serve, stop, or recommend models |
| `/spark-switch [mode]` | Toggle between local, cloud, and hybrid backends |

## MCP Tools

| Tool | Description |
|------|-------------|
| `spark_get_status` | System overview: uptime, CPU, memory, disk |
| `spark_gpu_utilization` | GPU memory, compute %, temperature, power |
| `spark_list_models` | All models across Ollama and vLLM |
| `spark_pull_model` | Pull a model via Ollama |
| `spark_start_model` | Start a vLLM container with tool-calling support |
| `spark_stop_model` | Stop a model container |
| `spark_list_containers` | All Docker containers on Spark |
| `spark_container_logs` | Tail container logs |
| `spark_vpn_status` | Tailscale connection state and peers |
| `spark_health_check` | MCP server health with latency |

## Configuration

### Mac-side `.env` (repo root)

| Variable | Description | Default |
|----------|-------------|---------|
| `SPARK_MCP_URL` | MCP server URL | `http://your-spark.local:3100` |
| `SPARK_MCP_URL_TAILSCALE` | MCP URL via Tailscale | `http://your-spark:3100` |
| `SPARK_HOST` | Spark hostname for SSH | `your-spark.local` |
| `SPARK_USER` | SSH username | `jeder` |
| `SPARK_VLLM_ENDPOINT` | vLLM API endpoint | `http://your-spark.local:8000` |
| `SPARK_OLLAMA_ENDPOINT` | Ollama API endpoint | `http://your-spark.local:11434` |

### Spark-side `.env` (deployed to `~/dgx-agentskills/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `MCP_PORT` | MCP server port | `3100` |
| `OLLAMA_HOST` | Ollama API address | `localhost:11434` |
| `VLLM_IMAGE` | vLLM container image | `nvcr.io/nvidia/vllm:latest` |
| `VLLM_PORT` | vLLM serving port | `8000` |
| `VLLM_GPU_MEMORY_UTILIZATION` | GPU memory fraction for vLLM | `0.7` |

## Architecture

```
Mac (Claude Code)
  │
  ├── Plugin (skills, commands, hooks)
  │     └── .mcp.json → HTTP → DGX Spark MCP Server (:3100)
  │
  └── Claude Code session
        └── ANTHROPIC_BASE_URL → DGX Spark vLLM (:8000)

DGX Spark (your-spark.local)
  ├── MCP Server (Docker container, port 3100)
  │     ├── nvidia-smi (GPU metrics)
  │     ├── docker CLI (container management)
  │     ├── ollama CLI (model management)
  │     └── tailscale CLI (VPN status)
  ├── Ollama (host, port 11434)
  ├── vLLM (Docker container, port 8000)
  └── Tailscale (mesh VPN)
```

## Development

```bash
# Bootstrap dev environment
./scripts/setup-dev.sh

# Run tests
cd mcp-server && npm test

# Run linting
./scripts/lint.sh

# Build MCP server
cd mcp-server && npm run build
```

## License

MIT
