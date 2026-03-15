# /spark-models

Manage AI models on the DGX Spark.

## Arguments

- No arguments: list all running and available models
- `pull <model>`: pull a model via Ollama (e.g., `/spark-models pull qwen3.5:32b`)
- `serve <model> [--vllm]`: start serving a model via vLLM (e.g., `/spark-models serve Qwen/Qwen3-Coder-Next --vllm`)
- `stop <name>`: stop a running model container (e.g., `/spark-models stop vllm-qwen3-coder`)
- `recommend <use-case>`: get model recommendation (e.g., `/spark-models recommend coding`)

## Instructions

### List (no args)
Call `spark_list_models` MCP tool and present results showing:
- Ollama models with sizes
- vLLM containers with status and ports
- Total GPU memory usage

### Pull
Call `spark_pull_model` MCP tool with the model name. Inform the user that pulls are async and they can check progress with `/spark-models`.

### Serve
Call `spark_start_model` MCP tool. Remind the user that the model may take a few minutes to load.

### Stop
Call `spark_stop_model` MCP tool with the container name.

### Recommend
Invoke the `spark-models` skill and use the model compatibility matrix to recommend models for the given use case (coding, chat, reasoning). Consider GPU memory constraints.
