---
name: spark-setup
description: >-
  Set up and provision an NVIDIA DGX Spark from scratch or after factory reset.
  Use when configuring a new Spark, recovering from reset, or verifying system state.
  Triggers on: "set up DGX Spark", "configure Spark", "provision Spark", "factory reset".
---

# DGX Spark Setup

Reproducible provisioning for the NVIDIA DGX Spark. Each phase is idempotent — safe to re-run.

## Prerequisites

- DGX Spark powered on and accessible via SSH
- SSH key configured for passwordless access
- Mac-side `.env` configured with `SPARK_HOST` and `SPARK_USER`

## Phases

Execute in order. Skip phases that are already complete.

### Phase 1: Connectivity

```bash
# Verify SSH access
ssh -o ConnectTimeout=5 ${SPARK_USER}@${SPARK_HOST} "echo 'SSH OK' && uname -a"
```

If SSH fails, guide the user through NVIDIA Sync setup or manual SSH key configuration.

### Phase 2: System Updates

```bash
ssh ${SPARK_USER}@${SPARK_HOST} "sudo apt update && sudo apt upgrade -y"
ssh ${SPARK_USER}@${SPARK_HOST} "nvidia-smi && nvcc --version"
```

Record CUDA version, driver version, and DGX OS version.

### Phase 3: Ollama

Ollama comes pre-installed on DGX Spark via snap.

```bash
# Verify Ollama is running
ssh ${SPARK_USER}@${SPARK_HOST} "ollama --version && systemctl status snap.ollama.daemon"

# Configure for remote access (bind to all interfaces)
ssh ${SPARK_USER}@${SPARK_HOST} "sudo snap set ollama bind=0.0.0.0:11434"

# Pull a starter model
ssh ${SPARK_USER}@${SPARK_HOST} "ollama pull llama3.1:8b"
```

### Phase 4: vLLM

Pull NVIDIA's custom vLLM container optimized for DGX Spark (Blackwell architecture, sm_121a).

```bash
# Log in to NVIDIA container registry
ssh ${SPARK_USER}@${SPARK_HOST} "docker login nvcr.io"

# Pull the vLLM image
ssh ${SPARK_USER}@${SPARK_HOST} "docker pull nvcr.io/nvidia/vllm:latest"
```

Do NOT use the standard `vllm/vllm-openai` image — it produces erroneous OOM errors on DGX Spark.

### Phase 5: Tailscale

```bash
ssh ${SPARK_USER}@${SPARK_HOST} "curl -fsSL https://tailscale.com/install.sh | sh"
ssh ${SPARK_USER}@${SPARK_HOST} "sudo tailscale up"
# User completes auth in browser
ssh ${SPARK_USER}@${SPARK_HOST} "sudo tailscale set --ssh"
```

After auth, update Mac-side `.env` with `SPARK_MCP_URL_TAILSCALE`.

### Phase 6: Docker

Docker and NVIDIA Container Runtime are pre-installed on DGX Spark.

```bash
# Verify
ssh ${SPARK_USER}@${SPARK_HOST} "docker info | grep -i runtime"

# Ensure user is in docker group (no sudo required)
ssh ${SPARK_USER}@${SPARK_HOST} "groups | grep -q docker || sudo usermod -aG docker \$USER"
```

### Phase 7: SSH Hardening

```bash
# Disable password auth
ssh ${SPARK_USER}@${SPARK_HOST} "sudo sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config && sudo systemctl restart ssh"

# Enable UFW with SSH + MCP + Ollama + vLLM
ssh ${SPARK_USER}@${SPARK_HOST} "sudo ufw allow ssh && sudo ufw allow 3100/tcp && sudo ufw allow 11434/tcp && sudo ufw allow 8000/tcp && sudo ufw --force enable"
```

### Phase 8: MCP Server Deployment

Run the deploy script from the Mac:

```bash
./deploy/install.sh
```

This rsyncs the project to the Spark, builds the Docker container, and starts the MCP server.

### Phase 9: Validation

```bash
# Health check
curl http://${SPARK_HOST}:3100/health

# GPU status via MCP
# Use /spark-status command

# Test Ollama
curl http://${SPARK_HOST}:11434/api/tags

# Test vLLM (if a model is running)
curl http://${SPARK_HOST}:8000/v1/models
```

## Output

After all phases, generate `spark-setup-report.md` with:
- DGX OS version, CUDA version, driver version
- Ollama version and installed models
- vLLM container image tag
- Tailscale IP and hostname
- MCP server status
- Network ports and firewall rules
