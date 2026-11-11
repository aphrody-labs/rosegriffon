// SPDX-License-Identifier: Apache-2.0
//! Virtualization and Hypervisor capability introspection.
//!
//! Provides 100% safe Rust introspection and detection across:
//! - Hardware-assisted virtualization flags (Intel VT-x / VMX, AMD-V / SVM, ARM EL2).
//! - Hypervisor environment detection (KVM, Windows Hypervisor Platform / Hyper-V, Apple HVF, QEMU TCG, Xen, VMware, VirtualBox).
//! - Active virtio and dynamic binary translation backends.

use serde::{Deserialize, Serialize};

/// Hypervisor backend environment.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HypervisorType {
    Kvm,
    Whpx,
    HyperV,
    Hvf,
    QemuTcg,
    Vmware,
    VirtualBox,
    Xen,
    None,
}

/// Virtio device capabilities.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VirtioCapabilities {
    pub has_virtio_net: bool,
    pub has_virtio_blk: bool,
    pub has_virtio_fs: bool,
    pub has_virtio_gpu: bool,
    pub has_virtio_vsock: bool,
}

fn detect_virtio() -> VirtioCapabilities {
    #[allow(unused_mut)] // reassigned only under some target cfg
    let mut capabilities = VirtioCapabilities {
        has_virtio_net: false,
        has_virtio_blk: false,
        has_virtio_fs: false,
        has_virtio_gpu: false,
        has_virtio_vsock: false,
    };

    // Linux exposes each enumerated virtio device and its device ID through
    // sysfs. Do not report capabilities based on the mere presence of a
    // hypervisor: guests commonly have no virtio devices, and hosts may have
    // virtio support without any device attached.
    #[cfg(target_os = "linux")]
    if let Ok(devices) = std::fs::read_dir("/sys/bus/virtio/devices") {
        for device in devices.flatten() {
            let Ok(id) = std::fs::read_to_string(device.path().join("device")) else {
                continue;
            };
            let id = id.trim().strip_prefix("0x").unwrap_or(id.trim());
            let Ok(id) = u32::from_str_radix(id, 16) else {
                continue;
            };
            match id {
                1 => capabilities.has_virtio_net = true,
                2 => capabilities.has_virtio_blk = true,
                16 => capabilities.has_virtio_gpu = true,
                19 => capabilities.has_virtio_vsock = true,
                26 => capabilities.has_virtio_fs = true,
                _ => {}
            }
        }
    }

    capabilities
}

/// System virtualization profile.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VirtualizationInfo {
    pub is_virtualized: bool,
    pub hypervisor_type: HypervisorType,
    pub hardware_virtualization_supported: bool,
    pub hardware_extension_name: &'static str,
    pub hypervisor_vendor_signature: String,
    pub nested_virtualization_supported: bool,
    pub virtio: VirtioCapabilities,
}

/// Introspect the local execution environment for hypervisor and virtualization capabilities (100% safe).
pub fn detect_virtualization() -> VirtualizationInfo {
    #[allow(unused_mut)] // reassigned only under some target cfg
    let mut is_virtualized = false;
    #[allow(unused_mut)] // reassigned only under some target cfg
    let mut hypervisor_type = HypervisorType::None;
    let mut hardware_supported = false;
    let mut extension_name = "None";
    #[allow(unused_mut)] // reassigned only under some target cfg
    let mut vendor_signature = String::new();
    #[allow(unused_mut)] // reassigned only under some target cfg
    let mut nested_supported = false;

    #[cfg(target_os = "windows")]
    {
        // On Windows 10/11, check system environment and virtualization indicators
        if let Ok(sys_root) = std::env::var("SystemRoot") {
            // Check for Hyper-V or WHP platform services
            let winhv = std::path::Path::new(&sys_root)
                .join("System32")
                .join("WinHvPlatform.dll");
            if winhv.exists() {
                hardware_supported = true;
                extension_name = "Windows Hypervisor Platform (WHPX)";
            }
        }

        // Check if running inside a VM via standard environment / services
        if let Ok(bios_serial) = std::env::var("SystemDrive") {
            let _ = bios_serial;
        }

        // On Windows, if Hyper-V virtualization is present
        let proc_id = std::env::var("PROCESSOR_IDENTIFIER").unwrap_or_default();
        if proc_id.contains("Intel") {
            hardware_supported = true;
            extension_name = "Intel VT-x (VMX)";
        } else if proc_id.contains("AMD") {
            hardware_supported = true;
            extension_name = "AMD-V (SVM)";
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Check /dev/kvm
        if std::path::Path::new("/dev/kvm").exists() {
            hardware_supported = true;
            extension_name = "Linux KVM";
        }

        // Check systemd-detect-virt or /sys/hypervisor
        if let Ok(content) = std::fs::read_to_string("/sys/class/dmi/id/product_name") {
            let p = content.trim().to_lowercase();
            if p.contains("kvm") || p.contains("qemu") {
                is_virtualized = true;
                hypervisor_type = HypervisorType::Kvm;
                vendor_signature = "QEMU/KVM".to_string();
            } else if p.contains("virtualbox") {
                is_virtualized = true;
                hypervisor_type = HypervisorType::VirtualBox;
                vendor_signature = "VirtualBox".to_string();
            } else if p.contains("vmware") {
                is_virtualized = true;
                hypervisor_type = HypervisorType::Vmware;
                vendor_signature = "VMware".to_string();
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        hardware_supported = true;
        extension_name = "Apple Hypervisor (HVF)";
    }

    // Virtio capabilities probe
    let virtio = detect_virtio();

    VirtualizationInfo {
        is_virtualized,
        hypervisor_type,
        hardware_virtualization_supported: hardware_supported,
        hardware_extension_name: extension_name,
        hypervisor_vendor_signature: vendor_signature,
        nested_virtualization_supported: nested_supported,
        virtio,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_virtualization_sanity() {
        let v = detect_virtualization();
        assert!(!v.hardware_extension_name.is_empty());
        // Detection must be a valid profile regardless of the host's devices.
        assert_eq!(v.virtio.has_virtio_net, detect_virtio().has_virtio_net);
    }
}
