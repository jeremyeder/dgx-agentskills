# DGX AgentSkills — Design Spec

**Date**: 2026-03-15
**Repo**: `jeremyeder/dgx-agentskills`
**Status**: Draft
**Author**: Jeremy Eder + Claude

## Overview

A Claude Code plugin that integrates the NVIDIA DGX Spark into Jeremy's development workflow. The plugin provides skills for setup and daily operations, commands for quick actions, a background monitoring agent, and an MCP server running on the Spark for real-time GPU/model/container queries.

### Goals

- Weave the DGX Spark into Claude Code sessions invisibly and optimally
- Use the Spark as a local model backend for Claude Code (vLLM + Ollama)
- Support hybrid local+cloud inference (Opus via Anthropic, subagents via Spark)
- Enable remote access via Tailscale VPN
- Provide VM management for running additional workloads
- Make the setup reproducible (factory reset and rebuild from skills)
- Professional quality: tests, linting, documentation

### Non-Goals

- Multi-Spark clustering (future, not v0.1)
- Fine-tuning workflows (future skill)
- GUI or web dashboard (DGX Dashboard already exists)

## Hardware Context

| Spec | Value |
|------|-------|
| Processor | GB10 Grace Blackwell Superchip |
| CPU | 20-core ARM (10x Cortex-X925 + 10x Cortex-A725) |
| GPU | Blackwell, 6144 CUDA cores |
| Memory | 128GB LPDDR5x unified (273 GB/s, shared CPU+GPU) |
| AI Performance | 1 PFLOP FP4, 1000 TOPS |
| Networking | 10GbE, Wi-Fi 7, ConnectX-7 (200Gbps) |
| OS | DGX OS (Ubuntu 24.04), CUDA 13.0 pre-installed |
| Form Factor | 150mm x 150mm x 50.5mm, 1.2 kg |
| Hostname | `jeder-spark.local` |

### Model Capacity

- Models up to ~200B parameters (with quantization)
- Interactive sweet spot: 8-20B parameters (~20 tok/s for 8B, slower above 30B due to shared bandwidth)
- Two Sparks can be linked for 256GB unified memory and models up to 405B
- NVFP4 quantization compresses models ~70% with minimal quality loss

## Repository Structure

```
dgx-agentskills/
├── .claude-plugin/
│   └── plugin.json
├── .claude/
│   └── CLAUDE.md
├── skills/
│   ├── spark-setup/SKILL.md
│   ├── spark-models/SKILL.md
│   ├── spark-vpn/SKILL.md
│   ├── spark-vms/SKILL.md
│   └── spark-hybrid/SKILL.md
├── commands/
│   ├── spark-status.md
│   ├── spark-models.md
│   └── spark-switch.md
├── agents/
│   └── spark-monitor.md
├── mcp-server/
│   ├── src/
│   │   ├── index.ts
│   │   ├── tools/
│   │   │   ├── status.ts
│   │   │   ├── models.ts
│   │   │   ├── containers.ts
│   │   │   └── network.ts
│   │   └── utils/
│   │       ├── exec.ts
│   │       └── config.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   └── Dockerfile
├── docker-compose.yml               # runs on Spark, builds mcp-server
├── deploy/
│   ├── .env.example                 # Spark-side config template
│   └── install.sh                   # one-command deploy from Mac
├── hooks/
│   └── session-start/
│       └── spark-detect.sh
├── tests/
│   ├── mcp-server/
│   └── hooks/
├── scripts/
│   ├── lint.sh
│   └── setup-dev.sh
├── .env.example                    # Mac-side config template
├── .eslintrc.json
├── .prettierrc
├── README.md
└── LICENSE
```

## Plugin Manifest

```json
{
  "name": "dgx-spark",
  "description": "NVIDIA DGX Spark integration for Claude Code — local model serving, GPU monitoring, VM management, and hybrid AI workflows",
  "version": "0.1.0",
  "author": {
    "name": "Jeremy Eder",
    "email": "jeder@redhat.com"
  },
  "homepage": "https://github.com/jeremyeder/dgx-agentskills",
  "repository": "https://github.com/jeremyeder/dgx-agentskills",
  "license": "MIT",
  "keywords": ["nvidia", "dgx-spark", "local-llm", "vllm", "ollama", "gpu", "mcp"]
}
```

## Configuration

Two `.env` files: one on the Mac (plugin side), one on the Spark (MCP server side).

### Mac-side `.env`

```env
# DGX Spark MCP endpoint
SPARK_MCP_URL=http://jeder-spark.local:3100
SPARK_MCP_URL_TAILSCALE=http://jeder-spark:3100

# SSH (used by setup skill and deploy script)
SPARK_HOST=jeder-spark.local
SPARK_USER=jeder
SPARK_SSH_KEY=~/.ssh/id_ed25519

# Claude Code backend switching
SPARK_VLLM_ENDPOINT=http://jeder-spark.local:8000
SPARK_OLLAMA_ENDPOINT=http://jeder-spark.local:11434
```

### Spark-side `.env` (in `deploy/`)

```env
# MCP Server
MCP_PORT=3100

# Ollama (runs on host, accessed via host networking)
OLLAMA_HOST=localhost:11434

# vLLM defaults
VLLM_IMAGE=nvcr.io/nvidia/vllm:latest
VLLM_PORT=8000

# GPU memory management
VLLM_GPU_MEMORY_UTILIZATION=0.7
```

## Skills

### `spark-setup` — Initial Provisioning & Configuration

**Triggers**: "set up DGX Spark", "configure Spark", "provision Spark", factory reset recovery

Walks through a reproducible setup sequence for a fresh or factory-reset DGX Spark. Each step is idempotent.

**Phases**:

1. **Connectivity** — verify SSH access, configure Mac-side `.env` with hostname/user
2. **System updates** — `apt update/upgrade`, verify CUDA and driver versions
3. **Ollama** — verify pre-installed Ollama is running, configure for remote access (bind `0.0.0.0:11434`), pull a starter model
4. **vLLM** — pull NVIDIA's custom vLLM container for DGX Spark, create docker-compose config for persistent serving
5. **Tailscale** — install, authenticate, configure SSH via Tailscale, optionally configure as subnet router or exit node
6. **Docker** — verify Docker + NVIDIA container runtime, configure default GPU access, ensure user is in docker group
7. **SSH hardening** — key-only auth, disable password login, configure UFW firewall
8. **MCP server deployment** — copy `mcp-server/` and `deploy/` to Spark, `docker compose up -d --build`, verify health endpoint
9. **Validation** — pull a small model, serve via vLLM, hit the API from Mac, confirm MCP tools respond

**Output**: `spark-setup-report.md` with versions, IPs, config state, and test results.

### `spark-models` — Model Management (vLLM + Ollama)

**Triggers**: "deploy model on Spark", "pull model", "serve model", "what models are running", "switch model", model names (Qwen, Llama, DeepSeek, Gemma)

Manages the full model lifecycle across both Ollama and vLLM.

**Capabilities**:

- **Discovery** — list models on Ollama (`ollama list`) and vLLM (running containers), show memory usage vs. 128GB available
- **Pull** — `ollama pull <model>` for Ollama, or pull the right container/weights for vLLM with NVFP4 quantization when available
- **Serve** — start a vLLM container with correct flags for DGX Spark (CUDA 13, sm_121a, `--enable-auto-tool-choice`, `--tool-call-parser`), expose on configurable port
- **Stop** — gracefully stop a serving container, free GPU memory
- **Recommend** — given a use case (coding, chat, reasoning), recommend models that fit in 128GB with good interactive performance

**Model compatibility matrix** (maintained in skill): tested model+quantization combos for GB10, with token/s benchmarks and tool-calling quality ratings.

**Key constraint**: Models above ~80B need NVFP4 or similar quantization for interactive speed on single Spark.

### `spark-vpn` — Tailscale VPN Setup

**Triggers**: "Tailscale", "VPN", "remote access to Spark", "access Spark from outside"

Sets up and manages Tailscale mesh VPN on the Spark.

**Phases**:

1. **Install** — install Tailscale on Spark via SSH
2. **Authenticate** — guide through `tailscale up` and auth key flow
3. **Configure** — enable SSH via Tailscale (`tailscale set --ssh`), optionally configure as subnet router or exit node
4. **Verify** — confirm Spark reachable via Tailscale hostname, update `.env` with `SPARK_MCP_URL_TAILSCALE`
5. **Port documentation** — list ports to expose (3100 MCP, 11434 Ollama, 8000 vLLM, 8080 Open WebUI, 11000 DGX Dashboard)

**Output**: Updates `.env` with Tailscale hostname, verifies connectivity.

### `spark-vms` — KVM/QEMU Virtual Machine Management

**Triggers**: "create VM on Spark", "virtual machine", "KVM", "run Windows on Spark"

Manages VMs on the DGX Spark's ARM64 KVM hypervisor.

**Capabilities**:

- **Setup** — install KVM/QEMU/libvirt if not present, verify virtualization support
- **Create** — create VMs from ISO (Ubuntu ARM64, Windows 11 ARM64), configurable CPU/memory/disk
- **GPU passthrough** — guidance on sharing Blackwell GPU with VMs (trade-offs: GPU passthrough means host loses GPU access)
- **Lifecycle** — start, stop, snapshot, restore via `virsh`
- **Auto-start** — configure VMs to start on boot (with workaround for known UEFI boot race condition)

**Key constraint**: GPU is a shared resource. Skill warns when VM config would conflict with model serving.

### `spark-hybrid` — Claude Code + Spark Backend Switching

**Triggers**: "use local model", "switch to Spark", "switch to Anthropic", "hybrid mode", "point Claude Code at Spark"

Configures Claude Code sessions to use the Spark as a model backend.

**Modes**:

1. **Full local** — set `ANTHROPIC_BASE_URL` to Spark's vLLM endpoint. All inference runs locally. Best for proprietary code, offline, cost savings.
2. **Hybrid** — primary session uses Anthropic API (Opus), subagents use Spark-hosted models. Configure via `ANTHROPIC_DEFAULT_SONNET_MODEL` pointing at Spark-served model.
3. **Failover** — if Spark unreachable (detected by session-start hook), fall back to Anthropic API automatically.

**What it configures**:

- Environment variables: `ANTHROPIC_BASE_URL`, `ANTHROPIC_API_KEY`, model name overrides
- Tested model recommendations for Claude Code harness (requires tool-calling support)
- Verification that selected model works with Claude Code's tool-calling protocol

**Model compatibility for Claude Code**: Not all models work well in the harness. Skill maintains a compatibility matrix of tested models with tool-calling quality ratings. As of March 2026, strong candidates include Qwen3-Coder-Next, Qwen3.5, and GLM-4.7-Flash.

**Implementation note**: The exact Claude Code environment variables for model overrides (`ANTHROPIC_BASE_URL`, `ANTHROPIC_DEFAULT_SONNET_MODEL`, etc.) must be verified against current Claude Code documentation during implementation. The vLLM integration docs at https://docs.vllm.ai/en/stable/serving/integrations/claude_code/ are the primary reference.

## Commands

### `/spark-status`

Quick health check. No arguments.

Reports: online/offline, GPU utilization and memory, running models (Ollama + vLLM), Tailscale connectivity, uptime, CPU load, disk usage.

Calls MCP tools `spark_get_status` and `spark_gpu_utilization`.

### `/spark-models [action] [model]`

Model management shortcut.

| Invocation | Action |
|------------|--------|
| `/spark-models` | List all running and available models |
| `/spark-models pull qwen3.5:32b` | Pull model via Ollama |
| `/spark-models serve qwen3-coder --vllm` | Start vLLM container |
| `/spark-models stop qwen3-coder` | Stop a running model |
| `/spark-models recommend coding` | Get recommendation for use case |

Delegates to `spark-models` skill and MCP tools.

### `/spark-switch [mode]`

Toggle Claude Code's model backend.

| Invocation | Action |
|------------|--------|
| `/spark-switch local` | Point session at Spark vLLM endpoint |
| `/spark-switch cloud` | Revert to Anthropic API |
| `/spark-switch hybrid` | Opus primary, Spark for subagents |
| `/spark-switch status` | Show current backend config |

Delegates to `spark-hybrid` skill. Prints confirmation and verifies endpoint.

## Agents

### `spark-monitor`

Background health monitoring agent. Periodically checks Spark status via MCP tools (default: every 5 minutes). Only surfaces alerts when state changes:

- Model serving went down
- GPU memory pressure (>90%)
- Spark went unreachable
- Tailscale disconnected

Runs via `run_in_background`. Not a noisy poller — only interrupts when actionable.

## MCP Server

TypeScript, built with `mcp-builder` conventions. Runs on the DGX Spark as a Docker container, exposed via Streamable HTTP on port 3100.

### Architecture

```
Mac (Claude Code) → HTTP → DGX Spark (MCP Server container, port 3100)
                               ├── nvidia-smi (local)
                               ├── ollama CLI (local/host)
                               ├── docker CLI (via socket)
                               └── tailscale CLI (local/host)
```

No SSH per tool call. All commands execute locally on the Spark. Reachable from LAN (`jeder-spark.local:3100`) and remotely via Tailscale (`jeder-spark:3100`).

### Tools

| Tool | Description | Returns |
|------|-------------|---------|
| `spark_get_status` | System overview: uptime, CPU, memory, disk, network | JSON with system metrics |
| `spark_gpu_utilization` | GPU memory, compute %, temperature, power draw | JSON from `nvidia-smi --query-gpu` |
| `spark_list_models` | All models: Ollama library + running vLLM containers | Array of model objects with status, size, port |
| `spark_pull_model` | Pull a model via Ollama (async: returns immediately with pull ID, poll via `spark_list_models` for completion) | Pull ID + initial status |
| `spark_start_model` | Start a vLLM container serving a model | Container ID, endpoint URL |
| `spark_stop_model` | Stop a running model container | Confirmation |
| `spark_list_containers` | All Docker containers on Spark | Container list with status, ports, images |
| `spark_container_logs` | Tail logs from a container | Log output (last N lines) |
| `spark_vpn_status` | Tailscale connection state, IP, peers | JSON with connectivity info |
| `spark_health_check` | Verify MCP server is responding | Boolean + latency |

### Containerization

**Dockerfile**: Multi-stage Node.js 20 build for ARM64 (aarch64).

**Docker Compose** (`docker-compose.yml` at repo root):

```yaml
services:
  dgx-mcp:
    build:
      context: ./mcp-server
      dockerfile: Dockerfile
    container_name: dgx-mcp-server
    restart: unless-stopped
    network_mode: host
    runtime: nvidia
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    env_file:
      - .env
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3100/health"]
      interval: 30s
      timeout: 3s
      retries: 3
```

**Key container decisions**:

- `runtime: nvidia` — uses NVIDIA Container Runtime (pre-installed on DGX Spark), gives the container access to `nvidia-smi` and GPU libraries without manual bind mounts
- `network_mode: host` — container shares the host network stack, so it can reach Ollama on `localhost:11434` and Tailscale directly. Eliminates `host.docker.internal` issues on Linux.
- Docker socket mounted read-write — required by `spark_start_model` and `spark_stop_model` tools which create/destroy containers. Read access alone would only allow listing.

Deployable as a custom app through NVIDIA Sync.

### Deployment

**One-command deploy** (`deploy/install.sh`):

```bash
#!/bin/bash
# Deploy DGX MCP Server to Spark
# Run from repo root: ./deploy/install.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

source "$REPO_ROOT/.env"

echo "Deploying dgx-mcp-server to ${SPARK_HOST}..."

# Sync entire project to Spark (preserves directory structure)
rsync -avz --exclude node_modules --exclude .git \
  "$REPO_ROOT/" \
  "${SPARK_USER}@${SPARK_HOST}:~/dgx-agentskills/"

# Copy Spark-side .env if not already present
ssh "${SPARK_USER}@${SPARK_HOST}" \
  "cd ~/dgx-agentskills && [ -f .env ] || cp deploy/.env.example .env"

# Build and start
ssh "${SPARK_USER}@${SPARK_HOST}" \
  "cd ~/dgx-agentskills && docker compose up -d --build"

# Verify
sleep 3
curl -s --connect-timeout 5 "http://${SPARK_HOST}:${MCP_PORT:-3100}/health" \
  && echo "MCP server deployed and healthy" \
  || echo "MCP server not responding — check: ssh ${SPARK_USER}@${SPARK_HOST} docker logs dgx-mcp-server"
```

The `docker-compose.yml` lives at the repo root on the Spark (`~/dgx-agentskills/docker-compose.yml`) with `context: ./mcp-server` pointing to the adjacent directory. The `deploy/` directory contains the Spark-side `.env.example` and the install script.

### MCP Registration

The plugin registers the remote MCP server:

```json
{
  "mcpServers": {
    "dgx-spark": {
      "type": "http",
      "url": "http://jeder-spark.local:3100"
    }
  }
}
```

## Session-Start Hook

`hooks/session-start/spark-detect.sh` runs on every Claude Code session start (< 2 second timeout).

1. Loads `SPARK_MCP_URL` from `.env`
2. Hits `$SPARK_MCP_URL/health` via curl
3. If reachable: prints status line
4. If unreachable: tries `SPARK_MCP_URL_TAILSCALE` as fallback
5. If both fail: prints warning

Informational only — does not block session start.

## Testing

### MCP Server (vitest)

- Unit tests for each tool: mock subprocess execution, verify JSON output shape and error handling
- `exec.ts` wrapper tests: mock child_process, test timeout handling, error normalization
- Config tests: `.env` loading, defaults, validation of required fields
- Health endpoint test: verify `/health` returns 200

### Hook Tests

- `spark-detect.sh`: test with mock curl (success/failure/timeout), verify output format

### CI (GitHub Actions)

```yaml
on: [push, pull_request]
jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: mcp-server
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - name: Lint shell scripts
        working-directory: .
        run: shellcheck hooks/**/*.sh scripts/*.sh deploy/*.sh
```

### Linting

- **TypeScript**: eslint + prettier
- **Shell**: shellcheck
- **Unified**: `scripts/lint.sh` runs both

## README Structure

1. **What this is** — one paragraph overview
2. **Prerequisites** — DGX Spark with SSH access, Node.js 20+ (for dev), Claude Code
3. **Quickstart**
   - Copy `.env.example` to `.env`, set hostname/user
   - Run `./deploy/install.sh` to deploy MCP server to Spark
   - Add marketplace: `claude plugin marketplace add jeremyeder/dgx-agentskills`
   - Install plugin: `claude plugin install dgx-spark@dgx-agentskills --scope user`
   - Run `/spark-status` to verify
   - Pull a model: `/spark-models pull qwen3.5:32b`
   - Switch to local: `/spark-switch local`
4. **Skills reference** — table with triggers and descriptions
5. **Commands reference** — table with usage examples
6. **MCP tools reference** — table with tool names and descriptions
7. **Configuration** — `.env` file documentation
8. **Development** — how to run tests, lint, contribute
9. **Architecture** — diagram showing Mac ↔ MCP Server ↔ Spark services

## Implementation Order

1. Repo scaffolding: structure, plugin.json, CLAUDE.md, LICENSE, .env.example
2. MCP server: TypeScript project, tools, Dockerfile, docker-compose, deploy script
3. Session-start hook: spark-detect.sh
4. Skills: spark-setup, spark-models, spark-hybrid, spark-vpn, spark-vms (in priority order)
5. Commands: spark-status, spark-models, spark-switch
6. Agent: spark-monitor
7. Tests and CI
8. README with quickstart

## References

- [NVIDIA DGX Spark Product Page](https://www.nvidia.com/en-us/products/workstations/dgx-spark/)
- [DGX Spark User Guide](https://docs.nvidia.com/dgx/dgx-spark/)
- [NVIDIA DGX Spark Playbooks](https://github.com/NVIDIA/dgx-spark-playbooks)
- [vLLM on DGX Spark](https://build.nvidia.com/spark/vllm)
- [NIM on DGX Spark](https://build.nvidia.com/spark/nim-llm)
- [Ollama + DGX Spark](https://ollama.com/blog/nvidia-spark)
- [Claude Code + vLLM Integration](https://docs.vllm.ai/en/stable/serving/integrations/claude_code/)
- [NVIDIA Sync](https://docs.nvidia.com/dgx/dgx-spark/nvidia-sync.html)
- [mcp-builder Skill](https://github.com/anthropics/skills/tree/main/skills/mcp-builder)
- [Community vLLM Multi-Node](https://github.com/mark-ramsey-ri/vllm-dgx-spark)
- [DGX Spark Software Updates (CES 2026)](https://developer.nvidia.com/blog/new-software-and-model-optimizations-supercharge-nvidia-dgx-spark/)
