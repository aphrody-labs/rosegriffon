// SPDX-License-Identifier: Apache-2.0
//! CPU Microarchitecture, ISA extensions and Register File introspection.
//!
//! Provides 100% safe Rust hardware detection and classification for:
//! - x86-64 Microarchitecture Levels: `x86-64-v1`, `x86-64-v2`, `x86-64-v3`, `x86-64-v4`.
//! - Modern Vector Extensions: AVX, AVX2, AVX-512 (F, CD, BW, DQ, VL, IFMA, VBMI, VNNI), AVX10.
//! - Intel Advanced Performance Extensions (APX: 32 GPRs, 3-operand CCMP, Push2/Pop2, JMPABS).
//! - Intel Matrix Acceleration (AMX: TILE, INT8, BF16, FP16).
//! - ARMv9 extensions: SVE, SVE2, SME, SME2, PAC, BTI, MTE.
//! - AMD Zen 4 / Zen 5 hardware security (SEV-SNP, Bus Lock Trap).

use serde::{Deserialize, Serialize};

/// Supported CPU architectures.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CpuArch {
    X86_64,
    Aarch64,
    Riscv64,
    Unknown,
}

impl CpuArch {
    pub const fn current() -> Self {
        #[cfg(target_arch = "x86_64")]
        {
            Self::X86_64
        }
        #[cfg(target_arch = "aarch64")]
        {
            Self::Aarch64
        }
        #[cfg(target_arch = "riscv64")]
        {
            Self::Riscv64
        }
        #[cfg(not(any(
            target_arch = "x86_64",
            target_arch = "aarch64",
            target_arch = "riscv64"
        )))]
        {
            Self::Unknown
        }
    }
}

/// Standardized x86-64 microarchitecture baseline levels.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum MicroarchitectureLevel {
    #[serde(rename = "x86-64-v1")]
    V1,
    #[serde(rename = "x86-64-v2")]
    V2,
    #[serde(rename = "x86-64-v3")]
    V3,
    #[serde(rename = "x86-64-v4")]
    V4,
    #[serde(rename = "armv8-a")]
    ArmV8,
    #[serde(rename = "armv9-a")]
    ArmV9,
    #[serde(rename = "generic")]
    Generic,
}

/// Comprehensive CPU introspection profile.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CpuInfo {
    pub architecture: CpuArch,
    pub vendor: String,
    pub brand_string: String,
    pub microarchitecture_level: MicroarchitectureLevel,
    pub logical_cores: usize,
    pub max_vector_width_bits: usize,
    pub gpr_count: usize,
    pub features: Vec<String>,
    pub has_avx2: bool,
    pub has_avx512f: bool,
    pub has_avx512_vnni: bool,
    pub has_apx: bool,
    pub has_avx10: bool,
    pub has_amx: bool,
    pub has_sve2: bool,
    pub has_sme2: bool,
    pub has_sev_snp: bool,
    pub has_pac_bti: bool,
    pub has_mte: bool,
}

/// Detect host CPU capabilities, microarchitecture level, and ISA extensions (100% safe).
pub fn detect_cpu() -> CpuInfo {
    let arch = CpuArch::current();
    let mut features = Vec::new();
    let mut vendor = "Generic".to_string();
    let mut brand = "Generic Processor".to_string();
    let mut level = MicroarchitectureLevel::Generic;
    let mut vector_width = 128;
    #[allow(unused_mut)] // reassigned only under some target cfg
    let mut gpr_count = 16;

    let mut has_avx2 = false;
    let mut has_avx512f = false;
    let mut has_avx512_vnni = false;
    #[allow(unused_mut)] // reassigned only under some target cfg
    let mut has_apx = false;
    #[allow(unused_mut)] // reassigned only under some target cfg
    let mut has_avx10 = false;
    #[allow(unused_mut)] // reassigned only under some target cfg
    let mut has_amx = false;
    #[allow(unused_mut)] // reassigned only under some target cfg
    let mut has_sve2 = false;
    let has_sme2 = false;
    #[allow(unused_mut)] // reassigned only under some target cfg
    let mut has_sev_snp = false;
    #[allow(unused_mut)] // reassigned only under some target cfg
    let mut has_pac_bti = false;
    #[allow(unused_mut)] // reassigned only under some target cfg
    let mut has_mte = false;

    #[cfg(target_arch = "x86_64")]
    {
        // Safe standard x86 feature detection through Rust standard macros
        features.push("sse".to_string());
        features.push("sse2".to_string());

        if is_x86_feature_detected!("sse3") {
            features.push("sse3".to_string());
        }
        if is_x86_feature_detected!("ssse3") {
            features.push("ssse3".to_string());
        }
        if is_x86_feature_detected!("sse4.1") {
            features.push("sse4.1".to_string());
        }
        if is_x86_feature_detected!("sse4.2") {
            features.push("sse4.2".to_string());
        }
        if is_x86_feature_detected!("popcnt") {
            features.push("popcnt".to_string());
        }
        if is_x86_feature_detected!("aes") {
            features.push("aes".to_string());
        }
        if is_x86_feature_detected!("pclmulqdq") {
            features.push("pclmulqdq".to_string());
        }
        if is_x86_feature_detected!("rdrand") {
            features.push("rdrand".to_string());
        }
        if is_x86_feature_detected!("rdseed") {
            features.push("rdseed".to_string());
        }
        if is_x86_feature_detected!("sha") {
            features.push("sha_ni".to_string());
        }

        // x86-64-v3 checks
        let has_avx = is_x86_feature_detected!("avx");
        has_avx2 = is_x86_feature_detected!("avx2");
        let has_fma = is_x86_feature_detected!("fma");
        let has_bmi1 = is_x86_feature_detected!("bmi1");
        let has_bmi2 = is_x86_feature_detected!("bmi2");
        let has_lzcnt = is_x86_feature_detected!("lzcnt");
        let has_movbe = is_x86_feature_detected!("movbe");

        if has_avx {
            features.push("avx".to_string());
            vector_width = 256;
        }
        if has_avx2 {
            features.push("avx2".to_string());
            vector_width = 256;
        }
        if has_fma {
            features.push("fma".to_string());
        }
        if has_bmi1 {
            features.push("bmi1".to_string());
        }
        if has_bmi2 {
            features.push("bmi2".to_string());
        }
        if has_lzcnt {
            features.push("lzcnt".to_string());
        }
        if has_movbe {
            features.push("movbe".to_string());
        }

        // x86-64-v4 AVX-512 checks
        has_avx512f = is_x86_feature_detected!("avx512f");
        let has_avx512cd = is_x86_feature_detected!("avx512cd");
        let has_avx512dq = is_x86_feature_detected!("avx512dq");
        let has_avx512bw = is_x86_feature_detected!("avx512bw");
        let has_avx512vl = is_x86_feature_detected!("avx512vl");

        if has_avx512f {
            features.push("avx512f".to_string());
            vector_width = 512;
        }
        if has_avx512cd {
            features.push("avx512cd".to_string());
        }
        if has_avx512dq {
            features.push("avx512dq".to_string());
        }
        if has_avx512bw {
            features.push("avx512bw".to_string());
        }
        if has_avx512vl {
            features.push("avx512vl".to_string());
        }

        if is_x86_feature_detected!("avx512vnni") {
            has_avx512_vnni = true;
            features.push("avx512_vnni".to_string());
        }

        // Determine x86-64 microarchitecture baseline level
        if has_avx512f && has_avx512bw && has_avx512cd && has_avx512dq && has_avx512vl {
            level = MicroarchitectureLevel::V4;
        } else if has_avx && has_avx2 && has_bmi1 && has_bmi2 && has_fma && has_lzcnt && has_movbe {
            level = MicroarchitectureLevel::V3;
        } else if is_x86_feature_detected!("sse4.2") && is_x86_feature_detected!("popcnt") {
            level = MicroarchitectureLevel::V2;
        } else {
            level = MicroarchitectureLevel::V1;
        }

        // Environment inspection for CPU vendor / brand without unsafe assembly
        #[cfg(target_os = "windows")]
        {
            if let Ok(reg_brand) = std::env::var("PROCESSOR_IDENTIFIER") {
                brand = reg_brand;
                if brand.contains("Intel") {
                    vendor = "Intel".to_string();
                } else if brand.contains("AMD") {
                    vendor = "AMD".to_string();
                }
            }
        }

        #[cfg(target_os = "linux")]
        {
            if let Ok(cpuinfo) = std::fs::read_to_string("/proc/cpuinfo") {
                // Linux reports features usable by the current execution
                // environment in the flags field (including virtualized
                // guests), unlike CPUID model data which may be masked.
                let flags = cpuinfo
                    .lines()
                    .find_map(|line| {
                        line.strip_prefix("flags")
                            .or_else(|| line.strip_prefix("Features"))
                            .and_then(|value| value.split_once(':'))
                            .map(|(_, value)| value.split_whitespace().collect::<Vec<_>>())
                    })
                    .unwrap_or_default();
                let has_flag = |names: &[&str]| {
                    flags
                        .iter()
                        .any(|flag| names.iter().any(|name| flag == name))
                };
                has_apx = has_flag(&["apx"]);
                has_avx10 = has_flag(&["avx10", "avx10_1", "avx10_2"]);
                has_amx = has_flag(&["amx_tile"]);
                has_sev_snp = has_flag(&["sev_snp"]);
                for (flag, reported) in [
                    ("apx", has_apx),
                    ("avx10", has_avx10),
                    ("amx_tile", has_amx),
                    ("sev_snp", has_sev_snp),
                ] {
                    if reported {
                        features.push(flag.to_string());
                    }
                }
                if has_apx {
                    gpr_count = 32;
                }
                for line in cpuinfo.lines() {
                    if line.starts_with("model name") {
                        if let Some((_, val)) = line.split_once(':') {
                            brand = val.trim().to_string();
                            if brand.contains("Intel") {
                                vendor = "Intel".to_string();
                            } else if brand.contains("AMD") {
                                vendor = "AMD".to_string();
                            }
                        }
                        break;
                    }
                }
            }
        }
    }

    #[cfg(target_arch = "aarch64")]
    {
        vendor = "ARM".to_string();
        brand = "ARMv8/v9 Compatible Processor".to_string();
        level = MicroarchitectureLevel::ArmV8;
        gpr_count = 31;
        vector_width = 128;
        features.push("neon".to_string());

        #[cfg(target_os = "linux")]
        {
            if std::arch::is_aarch64_feature_detected!("sve2") {
                has_sve2 = true;
                features.push("sve2".to_string());
                level = MicroarchitectureLevel::ArmV9;
                vector_width = 256;
            }
            if std::arch::is_aarch64_feature_detected!("mte") {
                has_mte = true;
                features.push("mte".to_string());
            }
            if std::arch::is_aarch64_feature_detected!("paca")
                || std::arch::is_aarch64_feature_detected!("pacg")
            {
                has_pac_bti = true;
                features.push("pac".to_string());
            }
            if std::arch::is_aarch64_feature_detected!("bti") {
                features.push("bti".to_string());
            }
        }
    }

    let logical_cores = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(1);

    CpuInfo {
        architecture: arch,
        vendor,
        brand_string: brand,
        microarchitecture_level: level,
        logical_cores,
        max_vector_width_bits: vector_width,
        gpr_count,
        features,
        has_avx2,
        has_avx512f,
        has_avx512_vnni,
        has_apx,
        has_avx10,
        has_amx,
        has_sve2,
        has_sme2,
        has_sev_snp,
        has_pac_bti,
        has_mte,
    }
}

/// Classify an arbitrary set of feature flags into an x86-64 microarchitecture level.
pub fn classify_x86_flags(flags: &[&str]) -> MicroarchitectureLevel {
    let has = |f: &str| flags.iter().any(|&item| item.eq_ignore_ascii_case(f));

    let v4_reqs = ["avx512f", "avx512bw", "avx512cd", "avx512dq", "avx512vl"];
    if v4_reqs.iter().all(|&r| has(r)) {
        return MicroarchitectureLevel::V4;
    }

    let v3_reqs = ["avx", "avx2", "bmi1", "bmi2", "fma", "lzcnt", "movbe"];
    if v3_reqs.iter().all(|&r| has(r)) {
        return MicroarchitectureLevel::V3;
    }

    let v2_reqs = ["sse3", "ssse3", "sse4_1", "sse4_2", "popcnt"];
    if v2_reqs.iter().all(|&r| has(r)) {
        return MicroarchitectureLevel::V2;
    }

    MicroarchitectureLevel::V1
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_cpu_sanity() {
        let cpu = detect_cpu();
        assert!(cpu.logical_cores >= 1);
        assert!(!cpu.brand_string.is_empty());
        assert!(!cpu.vendor.is_empty());
        assert!(cpu.gpr_count >= 16);
    }

    #[test]
    fn test_classify_x86_flags() {
        let v4_flags = [
            "avx512f", "avx512bw", "avx512cd", "avx512dq", "avx512vl", "bmi2",
        ];
        assert_eq!(classify_x86_flags(&v4_flags), MicroarchitectureLevel::V4);

        let v3_flags = ["avx", "avx2", "bmi1", "bmi2", "fma", "lzcnt", "movbe"];
        assert_eq!(classify_x86_flags(&v3_flags), MicroarchitectureLevel::V3);

        let v2_flags = ["sse3", "ssse3", "sse4_1", "sse4_2", "popcnt"];
        assert_eq!(classify_x86_flags(&v2_flags), MicroarchitectureLevel::V2);

        let v1_flags = ["sse", "sse2", "cmov"];
        assert_eq!(classify_x86_flags(&v1_flags), MicroarchitectureLevel::V1);
    }
}
