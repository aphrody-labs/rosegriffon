// SPDX-License-Identifier: Apache-2.0
//! Decompile lifted function addresses with the optional Rust Ghidra port.

use super::contract::{InputKind, Stage, StageReport, StageStatus};
use super::registry::{
    AdapterInfo, AdapterKind, AdapterStatus, Ctx, Options, StageAdapter, report,
};
#[cfg(feature = "decompile")]
use super::util::artifact;

pub struct RustDecompiler;

impl StageAdapter for RustDecompiler {
    fn id(&self) -> &str {
        "ghidra-decompiler"
    }
    fn stage(&self) -> Stage {
        Stage::Decompile
    }
    fn info(&self, opts: &Options) -> AdapterInfo {
        let (status, reason) = if !cfg!(feature = "decompile") {
            (
                AdapterStatus::Unavailable,
                Some("build with --features decompile".into()),
            )
        } else if !opts.external {
            (
                AdapterStatus::Registered,
                Some("enable with --external".into()),
            )
        } else {
            (AdapterStatus::Ready, None)
        };
        AdapterInfo {
            id: self.id().into(),
            stage: self.stage(),
            kind: AdapterKind::Crate,
            owner: "ghidra-decompiler Rust port".into(),
            handles: vec!["pe".into(), "elf".into(), "macho".into()],
            status,
            reason,
        }
    }
    fn applies(&self, ctx: &Ctx) -> bool {
        ctx.effective_path().is_some()
            && ctx.effective_ident().is_some_and(|ident| {
                matches!(
                    ident.kind,
                    InputKind::Pe | InputKind::Elf | InputKind::Macho
                )
            })
    }

    fn run(&self, ctx: &mut Ctx) -> StageReport {
        #[cfg(not(feature = "decompile"))]
        {
            let _ = ctx;
            report(
                Stage::Decompile,
                self.id(),
                StageStatus::Unavailable,
                "build with --features decompile",
            )
        }
        #[cfg(feature = "decompile")]
        {
            let Some(path) = ctx.effective_path() else {
                return report(
                    Stage::Decompile,
                    self.id(),
                    StageStatus::Skipped,
                    "no input image",
                );
            };
            let entry = ctx.ir.as_ref().map(|ir| ir.entry);
            let mut addresses = std::collections::BTreeMap::new();
            if let Some(entry) = entry {
                addresses.insert(entry, None);
            }
            for function in ctx.ir.iter().flat_map(|ir| &ir.functions) {
                addresses
                    .entry(function.addr)
                    .and_modify(|name| {
                        if name.is_none() {
                            *name = function.name.clone();
                        }
                    })
                    .or_insert_with(|| function.name.clone());
            }
            let mut program = match ghidra_decompiler::program::Program::open(&path, None) {
                Ok(program) => program,
                Err(error) => {
                    return report(
                        Stage::Decompile,
                        self.id(),
                        StageStatus::Failed,
                        error.to_string(),
                    );
                }
            };
            if ctx.opts.discover_functions {
                if let Err(error) = program.discover_functions() {
                    return report(
                        Stage::Decompile,
                        self.id(),
                        StageStatus::Failed,
                        format!("function discovery failed: {error}"),
                    );
                }
            }
            let mut discovered = 0usize;
            match program.functions() {
                Ok(functions) => {
                    for function in functions {
                        if function.source == ghidra_decompiler::program::FunctionSource::Discovered
                        {
                            discovered += 1;
                        }
                        addresses
                            .entry(function.address)
                            .and_modify(|name| {
                                if name.is_none() {
                                    *name = Some(function.name.clone());
                                }
                            })
                            .or_insert(Some(function.name));
                    }
                }
                Err(error) => {
                    return report(
                        Stage::Decompile,
                        self.id(),
                        StageStatus::Failed,
                        error.to_string(),
                    );
                }
            }
            if addresses.is_empty() {
                return report(
                    Stage::Decompile,
                    self.id(),
                    StageStatus::Skipped,
                    "no lifted or symbol-backed function addresses available",
                );
            }
            let dir = ctx.dir("decompile").join("ghidra-rust");
            if let Err(error) = std::fs::create_dir_all(&dir) {
                return report(
                    Stage::Decompile,
                    self.id(),
                    StageStatus::Failed,
                    error.to_string(),
                );
            }
            let mut records = String::new();
            let mut succeeded = 0usize;
            let mut failed = 0usize;
            let mut entry_code = None;
            // Prioritize the entry point, then process each remaining discovered address once.
            let first = entry.map(|address| (address, addresses.remove(&address).flatten()));
            for (address, name) in first
                .into_iter()
                .chain(addresses.into_iter())
                .take(ctx.opts.max_functions)
            {
                let (code, error) = match program.decompile(address) {
                    Ok(code) => {
                        succeeded += 1;
                        if Some(address) == entry {
                            entry_code = Some(code.clone());
                        }
                        (Some(code), None)
                    }
                    Err(error) => {
                        failed += 1;
                        (None, Some(error.to_string()))
                    }
                };
                let record = serde_json::json!({"address": format!("0x{address:x}"), "name": name, "code": code, "error": error});
                records.push_str(&record.to_string());
                records.push('\n');
            }
            if succeeded + failed == 0 {
                return report(
                    Stage::Decompile,
                    self.id(),
                    StageStatus::Skipped,
                    "function budget is zero",
                );
            }
            let output = dir.join("functions.jsonl");
            if let Err(error) = std::fs::write(&output, records) {
                return report(
                    Stage::Decompile,
                    self.id(),
                    StageStatus::Failed,
                    error.to_string(),
                );
            }
            let mut result = report(
                Stage::Decompile,
                self.id(),
                if succeeded == 0 {
                    StageStatus::Failed
                } else {
                    StageStatus::Partial
                },
                format!(
                    "{succeeded} functions decompiled, {failed} failed; coverage limited to lifted, discovered and symbol-backed addresses"
                ),
            );
            result.artifacts.push(artifact("jsonl", &output));
            result.metrics.insert("decompiled".into(), succeeded as u64);
            result.metrics.insert("failed".into(), failed as u64);
            result
                .metrics
                .insert("discovered".into(), discovered as u64);
            if let Some(code) = entry_code {
                let output = dir.join("entry.c");
                if let Err(error) = std::fs::write(&output, code) {
                    result.status = StageStatus::Failed;
                    result.detail = format!("could not write entry C: {error}");
                } else {
                    result.artifacts.push(artifact("c", &output));
                }
            }
            result
        }
    }
}
