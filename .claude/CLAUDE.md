# DGX AgentSkills

NVIDIA DGX Spark plugin for Claude Code.

## Structure

- `skills/` — Claude Code skills (SKILL.md files)
- `commands/` — Slash commands
- `agents/` — Background agents
- `mcp-server/` — TypeScript MCP server (runs on Spark as Docker container)
- `deploy/` — Deployment scripts and Spark-side config
- `hooks/` — Session-start hooks

## Development

- MCP server: TypeScript, Node.js 20+, vitest for tests
- Lint: `scripts/lint.sh` (eslint + prettier for TS, shellcheck for bash)
- Test: `cd mcp-server && npm test`
- The MCP server runs ON the DGX Spark, not on the Mac
- All MCP tools execute commands locally on the Spark (nvidia-smi, docker, ollama, tailscale)

## Config

- Mac-side: `.env` at repo root (MCP URL, SSH credentials, model endpoints)
- Spark-side: `deploy/.env.example` → `~/dgx-agentskills/.env` on Spark (MCP port, Ollama host, vLLM config)

## Conventions

- Skill names: `spark-*`
- MCP tool names: `spark_*`
- Command names: `/spark-*`
- All shell scripts must pass shellcheck
- All TypeScript must pass eslint + prettier
- Always use the latest stable versions of dependencies, actions, base images, and tooling. Check before pinning.
