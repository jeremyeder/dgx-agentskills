---
name: spark-hybrid
description: >-
  Configure Claude Code to use the DGX Spark as a model backend — full local, hybrid
  (Opus primary + Spark for subagents), or failover mode. Use when switching between
  local and cloud inference, pointing Claude Code at Spark, or setting up hybrid workflows.
  Triggers on: "use local model", "switch to Spark", "switch to Anthropic", "hybrid mode",
  "point Claude Code at Spark", "use Spark for subagents".
---

# Claude Code + DGX Spark Backend Switching

Configure Claude Code sessions to use the Spark as a model backend, either fully or in hybrid mode.

## Modes

### 1. Full Local

All inference runs on the Spark. Best for proprietary code, offline work, or cost savings.

```bash
export ANTHROPIC_BASE_URL=http://jeder-spark.local:8000/v1
export ANTHROPIC_API_KEY=sk-dummy-key
export ANTHROPIC_MODEL=Qwen/Qwen3-Coder-Next
```

**Prerequisites**:
- A model must be running via vLLM on the Spark (`/spark-models serve`)
- The model must support tool calling
- Add `"hasCompletedOnboarding": true` to `~/.claude.json` if Claude Code still asks to sign in

### 2. Hybrid

Primary session uses Anthropic API (Opus), subagents and drafting use Spark-hosted models.

```bash
# Keep ANTHROPIC_BASE_URL pointing at Anthropic (default)
# Override the subagent model to point at Spark
export ANTHROPIC_DEFAULT_SONNET_MODEL=Qwen/Qwen3-Coder-Next
export ANTHROPIC_SONNET_BASE_URL=http://jeder-spark.local:8000/v1
```

**Note**: The exact environment variables for subagent model overrides must be verified against current Claude Code documentation. The vLLM integration docs are the primary reference: https://docs.vllm.ai/en/stable/serving/integrations/claude_code/

### 3. Failover

If the Spark is unreachable (detected by session-start hook), automatically fall back to Anthropic API. No special configuration — this is the default behavior when `ANTHROPIC_BASE_URL` is not set.

## Switching

### To Local

1. Verify a model is serving: `/spark-status`
2. Set environment variables for full local mode
3. Restart Claude Code session (env vars are read at startup)
4. Verify: Claude Code should show the local model name

### To Cloud

1. Unset `ANTHROPIC_BASE_URL`
2. Restart Claude Code session
3. Verify: Claude Code should show Claude model name

### To Hybrid

1. Verify a model is serving on Spark
2. Set subagent model override env vars
3. Restart Claude Code session
4. Primary responses use Opus, subagents use Spark model

## Verification

After switching, verify the backend is working:

```bash
# Check what model Claude Code is using
# The model name appears in the Claude Code status bar

# For vLLM endpoint, verify it responds
curl http://jeder-spark.local:8000/v1/models

# For Ollama endpoint
curl http://jeder-spark.local:11434/api/tags
```

## Model Requirements for Claude Code

Not all models work in the Claude Code harness. Requirements:

- **Tool calling support** — the model must handle tool-use messages
- **Anthropic Messages API compatibility** — vLLM implements this natively
- **Sufficient context window** — 32K+ recommended for coding tasks
- **Instruction following** — must reliably follow structured output formats

See the full model compatibility matrix in the `spark-models` skill, which includes token/s benchmarks and quantization details.

Models with `/` in HuggingFace names may need aliasing — Claude Code has issues with slashes in model names.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Claude Code asks to sign in | Add `"hasCompletedOnboarding": true` and `"primaryApiKey": "sk-dummy-key"` to `~/.claude.json` |
| Tool calls not working | Verify `--enable-auto-tool-choice` and correct `--tool-call-parser` flag on vLLM |
| Model name with `/` rejected | Use a model alias or check vLLM `--served-model-name` flag |
| Slow responses | Check GPU memory pressure with `/spark-status`, consider smaller model |
| OOM errors | Use NVIDIA's vLLM container, not `vllm/vllm-openai` |
