---
name: spark-vms
description: >-
  Manage KVM/QEMU virtual machines on the DGX Spark. Create, start, stop, and snapshot
  VMs on the ARM64 hypervisor. Use when running VMs, creating virtual machines,
  or managing virtualization on the Spark.
  Triggers on: "create VM on Spark", "virtual machine", "KVM", "run Windows on Spark".
---

# DGX Spark Virtual Machine Management

Manage KVM/QEMU virtual machines on the DGX Spark's ARM64 platform.

## Prerequisites

```bash
# Install virtualization packages
ssh ${SPARK_USER}@${SPARK_HOST} "sudo apt install -y qemu-kvm libvirt-daemon-system virtinst bridge-utils"

# Verify KVM support
ssh ${SPARK_USER}@${SPARK_HOST} "kvm-ok"

# Add user to libvirt group
ssh ${SPARK_USER}@${SPARK_HOST} "sudo usermod -aG libvirt \$USER"
```

## Create a VM

### Ubuntu ARM64

```bash
ssh ${SPARK_USER}@${SPARK_HOST} "virt-install \
  --name ubuntu-vm \
  --ram 8192 \
  --vcpus 4 \
  --disk size=50 \
  --os-variant ubuntu24.04 \
  --cdrom /path/to/ubuntu-24.04-live-server-arm64.iso \
  --network bridge=virbr0 \
  --graphics vnc \
  --boot uefi"
```

### Windows 11 ARM64

```bash
ssh ${SPARK_USER}@${SPARK_HOST} "virt-install \
  --name windows-vm \
  --ram 16384 \
  --vcpus 8 \
  --disk size=100 \
  --os-variant win11 \
  --cdrom /path/to/Win11_ARM64.iso \
  --disk /path/to/virtio-win.iso,device=cdrom \
  --network bridge=virbr0 \
  --graphics vnc \
  --boot uefi \
  --tpm backend.type=emulator,model=tpm-crb"
```

## VM Lifecycle

```bash
# List VMs
virsh list --all

# Start
virsh start <vm-name>

# Stop (graceful)
virsh shutdown <vm-name>

# Force stop
virsh destroy <vm-name>

# Snapshot
virsh snapshot-create-as <vm-name> <snapshot-name>

# Restore
virsh snapshot-revert <vm-name> <snapshot-name>

# Auto-start on boot
virsh autostart <vm-name>
```

## GPU Considerations

The Blackwell GPU is a shared resource between the host and VMs.

| Scenario | GPU Available To |
|----------|-----------------|
| No passthrough (default) | Host only — VMs have no GPU access |
| GPU passthrough | VM only — host loses GPU access |
| No VMs running | Host has full GPU for model serving |

**Recommendation**: Do NOT pass through the GPU unless you specifically need GPU workloads inside the VM. Model serving (Ollama, vLLM) requires the GPU on the host.

## Known Issues

### UEFI Boot Race Condition

Windows VMs may fail to auto-start after host reboot due to a known UEFI boot timing issue. Workaround:

```bash
# Add a delay before VM auto-start
ssh ${SPARK_USER}@${SPARK_HOST} "cat > /etc/systemd/system/delayed-vm-start.service << 'EOF'
[Unit]
Description=Delayed VM Start
After=libvirtd.service
Requires=libvirtd.service

[Service]
Type=oneshot
ExecStartPre=/bin/sleep 30
ExecStart=/usr/bin/virsh start windows-vm

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl enable delayed-vm-start"
```

## Resource Allocation Guidelines

| Resource | Total | Recommended for VMs | Reserve for Host |
|----------|-------|-------------------|-----------------|
| CPU cores | 20 | Up to 8 | 12 (for model serving) |
| Memory | 128GB | Up to 32GB | 96GB (for GPU/models) |
| Disk | Varies | As needed | Keep 50GB+ free |
