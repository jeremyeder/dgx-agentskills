---
name: spark-vpn
description: >-
  Set up and manage Tailscale VPN on the DGX Spark for remote access.
  Use when configuring remote access, setting up Tailscale, or troubleshooting VPN connectivity.
  Triggers on: "Tailscale", "VPN", "remote access to Spark", "access Spark from outside".
---

# DGX Spark VPN Setup (Tailscale)

Set up Tailscale mesh VPN on the DGX Spark for secure remote access from anywhere.

## Why Tailscale

- Zero-config mesh VPN — no port forwarding, no firewall rules on the router
- Works behind NAT and firewalls
- SSH access via Tailscale (`tailscale set --ssh`)
- All Spark services (MCP, Ollama, vLLM) accessible via Tailscale hostname

## Installation

```bash
# Install on Spark
ssh ${SPARK_USER}@${SPARK_HOST} "curl -fsSL https://tailscale.com/install.sh | sh"

# Start and authenticate
ssh ${SPARK_USER}@${SPARK_HOST} "sudo tailscale up"
# User completes authentication in browser

# Enable Tailscale SSH
ssh ${SPARK_USER}@${SPARK_HOST} "sudo tailscale set --ssh"
```

## Configuration

After authentication:

```bash
# Get Tailscale IP and hostname
ssh ${SPARK_USER}@${SPARK_HOST} "tailscale ip -4"
ssh ${SPARK_USER}@${SPARK_HOST} "tailscale status --self"
```

Update Mac-side `.env`:
```env
SPARK_MCP_URL_TAILSCALE=http://<tailscale-hostname>:3100
```

## Optional: Subnet Router

If you want to access other devices on the Spark's LAN from remote:

```bash
ssh ${SPARK_USER}@${SPARK_HOST} "sudo tailscale set --advertise-routes=192.168.1.0/24"
```

Then approve the route in the Tailscale admin console.

## Optional: Exit Node

Use the Spark as a VPN exit node (all traffic routes through it):

```bash
ssh ${SPARK_USER}@${SPARK_HOST} "sudo tailscale set --advertise-exit-node"
```

## Ports Accessible via Tailscale

| Port | Service | URL |
|------|---------|-----|
| 3100 | MCP Server | `http://<ts-hostname>:3100` |
| 11434 | Ollama API | `http://<ts-hostname>:11434` |
| 8000 | vLLM API | `http://<ts-hostname>:8000` |
| 8080 | Open WebUI | `http://<ts-hostname>:8080` |
| 11000 | DGX Dashboard | `http://<ts-hostname>:11000` |

## Verification

```bash
# From remote machine (connected to Tailscale)
curl http://<tailscale-hostname>:3100/health

# Check VPN status via MCP
spark_vpn_status
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Can't reach Spark via Tailscale | Check `tailscale status` on both machines, ensure both are on same tailnet |
| MCP server unreachable | Verify container is running: `docker ps \| grep dgx-mcp` |
| Slow connection | Tailscale uses DERP relays if direct connection fails; check `tailscale netcheck` |
