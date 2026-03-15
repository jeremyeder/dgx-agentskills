---
name: spark-models
description: >-
  Manage AI models on the DGX Spark — list, pull, serve, stop, and recommend models
  across Ollama and vLLM backends. Use when deploying models, checking what's running,
  pulling new models, or getting recommendations for a use case.
  Triggers on: model names (Qwen, Llama, DeepSeek, Gemma), "serve model", "pull model",
  "what models are running", "deploy model on Spark".
---

# DGX Spark Model Management

Manage AI models across Ollama (quick interactive use) and vLLM (production serving with tool-calling support for Claude Code).

## When to Use Each Backend

| Backend | Best For | Performance | Tool Calling |
|---------|----------|-------------|-------------|
| Ollama | Quick experiments, trying models, chat | Good for < 30B | Limited |
| vLLM | Claude Code integration, production serving, batched inference | Optimized with NVFP4 | Full support |

## Discovery

Always check what's running before deploying:

```bash
# Use MCP tool
spark_list_models

# Or directly
ollama list
docker ps --filter "ancestor=nvcr.io/nvidia/vllm:latest"
```

## Pull Models (Ollama)

```bash
# Use MCP tool
spark_pull_model { "model": "qwen3.5:32b" }

# Models are async — check progress with spark_list_models
```

## Serve Models (vLLM)

```bash
# Use MCP tool
spark_start_model {
  "model": "Qwen/Qwen3-Coder-Next",
  "port": 8000,
  "extraArgs": ["--max-model-len", "32768"]
}
```

**Required flags for Claude Code compatibility**:
- `--enable-auto-tool-choice` — enables tool calling
- `--tool-call-parser hermes` — use Hermes format (verify per model)

These are added automatically by the MCP tool.

## Stop Models

```bash
spark_stop_model { "containerName": "vllm-qwen3-coder" }
```

## Model Compatibility Matrix (DGX Spark GB10)

### Recommended for Claude Code (tool-calling verified)

| Model | Size | Quantization | tok/s (approx) | Notes |
|-------|------|-------------|----------------|-------|
| Qwen3-Coder-Next | ~32B | NVFP4 | ~15 | Purpose-built for agentic coding |
| Qwen3.5 | 32B | NVFP4 | ~15 | Strong general + coding |
| GLM-4.7-Flash | 35B MoE | NVFP4 | ~18 | Fast MoE architecture |
| Llama 3.1 8B | 8B | FP16 | ~20 | Fast baseline, limited reasoning |

### Recommended for Ollama (interactive chat)

| Model | Size | tok/s (approx) | Notes |
|-------|------|----------------|-------|
| llama3.1:8b | 8B | ~20 | Good starter model |
| qwen3.5:32b | 32B | ~10 | Strong all-rounder |
| deepseek-r1:14b | 14B | ~15 | Reasoning focus |

### Memory Guidelines

- 128GB unified memory shared between CPU and GPU
- Models > 80B need aggressive quantization (NVFP4) for interactive speed
- Leave ~20GB headroom for system + other containers
- Single interactive model: allocate 70% GPU memory (`VLLM_GPU_MEMORY_UTILIZATION=0.7`)

## Key Constraints

- Use NVIDIA's custom vLLM container (`nvcr.io/nvidia/vllm`), NOT `vllm/vllm-openai`
- DGX Spark is ARM64 (aarch64) — not all container images have ARM builds
- Models above ~30B get noticeably slower for interactive use due to 273 GB/s shared bandwidth
- NVFP4 quantization (Blackwell-specific) compresses models ~70% with minimal quality loss
