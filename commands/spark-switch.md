# /spark-switch

Toggle Claude Code's model backend between Anthropic API and DGX Spark.

## Arguments

- `local`: point this session at Spark's vLLM endpoint
- `cloud`: revert to Anthropic API
- `hybrid`: Opus for primary, Spark model for subagents
- `status`: show current backend configuration
- No arguments: show status

## Instructions

Invoke the `spark-hybrid` skill to handle the switching logic.

### local
1. Check that a model is serving on Spark via `spark_list_models`
2. If no model is running, suggest running `/spark-models serve` first
3. Display the environment variables the user needs to set:
   - `ANTHROPIC_BASE_URL`
   - `ANTHROPIC_API_KEY`
   - `ANTHROPIC_MODEL`
4. Remind the user to restart Claude Code for env vars to take effect

### cloud
1. Display instructions to unset `ANTHROPIC_BASE_URL`
2. Remind the user to restart Claude Code

### hybrid
1. Check that a model is serving on Spark
2. Display the subagent model override env vars
3. Remind the user to restart Claude Code

### status
1. Check current environment variables
2. Report which backend is active (local/cloud/hybrid)
3. If local or hybrid, verify the Spark endpoint is responding
