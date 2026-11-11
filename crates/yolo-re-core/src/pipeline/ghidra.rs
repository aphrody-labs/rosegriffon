// SPDX-License-Identifier: Apache-2.0
//! Ghidra headless adapter (`GHIDRA_INSTALL_DIR`): imports the payload, runs auto-analysis and exports
//! the function list and decompiled C through an embedded post-script. Architecture-agnostic, so it is
//! the path for ARM/MIPS/PPC/firmware inputs the built-in x86 lifter does not cover.

use super::contract::{Stage, StageReport, StageStatus};
use super::registry::{
    AdapterInfo, AdapterKind, AdapterStatus, Ctx, Options, StageAdapter, list_files, report,
};
#[cfg(not(windows))]
use super::util::run_cmd;
#[cfg(windows)]
use super::util::run_cmd_raw_tail;
use super::util::tail;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

const SCRIPT_NAME: &str = "BunReExport.java";

fn ghidra_path(path: &Path) -> PathBuf {
    #[cfg(windows)]
    {
        let value = path.as_os_str().to_string_lossy();
        if let Some(unc) = value.strip_prefix(r"\\?\UNC\") {
            return PathBuf::from(format!(r"\\{unc}"));
        }
        if let Some(path) = value.strip_prefix(r"\\?\") {
            return PathBuf::from(path);
        }
    }
    path.to_path_buf()
}

const SCRIPT: &str = r#"import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.program.model.listing.Function;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

public class BunReExport extends GhidraScript {
    private static String jsonString(String value) {
        StringBuilder escaped = new StringBuilder(value.length() + 2);
        escaped.append('"');
        for (int i = 0; i < value.length(); i++) {
            char ch = value.charAt(i);
            switch (ch) {
                case '"': escaped.append("\\\""); break;
                case '\\': escaped.append("\\\\"); break;
                case '\b': escaped.append("\\b"); break;
                case '\f': escaped.append("\\f"); break;
                case '\n': escaped.append("\\n"); break;
                case '\r': escaped.append("\\r"); break;
                case '\t': escaped.append("\\t"); break;
                default:
                    if (ch < 0x20) {
                        escaped.append(String.format("\\u%04x", (int) ch));
                    } else {
                        escaped.append(ch);
                    }
            }
        }
        return escaped.append('"').toString();
    }

    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        File out = new File(args[0]);
        if (!out.isDirectory() && !out.mkdirs()) {
            throw new IOException("Cannot create output directory: " + out);
        }
        DecompInterface di = new DecompInterface();
        if (!di.openProgram(currentProgram)) {
            throw new IOException("Cannot open program in decompiler: " + di.getLastMessage());
        }
        try {
            int total = 0;
            int succeeded = 0;
            int failed = 0;
            try (PrintWriter fn = new PrintWriter(new OutputStreamWriter(
                        new FileOutputStream(new File(out, "functions.jsonl")), StandardCharsets.UTF_8));
                 PrintWriter c = new PrintWriter(new OutputStreamWriter(
                        new FileOutputStream(new File(out, "decompiled.c")), StandardCharsets.UTF_8));
                 PrintWriter failures = new PrintWriter(new OutputStreamWriter(
                        new FileOutputStream(new File(out, "decompile-errors.jsonl")), StandardCharsets.UTF_8))) {
                for (Function f : currentProgram.getFunctionManager().getFunctions(true)) {
                    monitor.checkCancelled();
                    total++;
                    fn.println("{\"name\":" + jsonString(f.getName()) + ",\"entry\":"
                        + jsonString(f.getEntryPoint().toString()) + ",\"size\":"
                        + f.getBody().getNumAddresses() + "}");
                    DecompileResults r = di.decompileFunction(f, 60, monitor);
                    monitor.checkCancelled();
                    if (r.decompileCompleted() && r.getDecompiledFunction() != null) {
                        c.println(r.getDecompiledFunction().getC());
                        succeeded++;
                    } else {
                        failed++;
                        String error = r.getErrorMessage();
                        failures.println("{\"name\":" + jsonString(f.getName()) + ",\"entry\":"
                            + jsonString(f.getEntryPoint().toString()) + ",\"error\":"
                            + jsonString(error == null ? "Decompilation did not complete" : error) + "}");
                    }
                }
                monitor.checkCancelled();
                if (fn.checkError() || c.checkError() || failures.checkError()) {
                    throw new IOException("Failed writing Ghidra export");
                }
            }
            Files.writeString(new File(out, "summary.json").toPath(), "{\"total\":" + total
                + ",\"succeeded\":" + succeeded + ",\"failed\":" + failed + "}\n");
            monitor.checkCancelled();
            Files.writeString(new File(out, "complete.txt").toPath(), "complete\n");
        } finally {
            di.dispose();
        }
    }
}
"#;

/// Ghidra headless adapter for one stage (`Analyze` runs it, `Decompile` publishes its C export).
pub struct Ghidra {
    /// Stage served.
    pub stage: Stage,
}

// Each invocation owns a new directory, so a previous export cannot mask a failed run.
fn create_run_dir(root: &Path) -> std::io::Result<PathBuf> {
    static NEXT: AtomicU64 = AtomicU64::new(0);
    std::fs::create_dir_all(root)?;
    loop {
        let sequence = NEXT.fetch_add(1, Ordering::Relaxed);
        let dir = root.join(format!("run-{}-{sequence}", std::process::id()));
        match std::fs::create_dir(&dir) {
            Ok(()) => return Ok(ghidra_path(&dir)),
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(e),
        }
    }
}

#[derive(Debug, serde::Deserialize)]
struct ExportSummary {
    total: u64,
    succeeded: u64,
    failed: u64,
}

impl ExportSummary {
    fn status(&self) -> StageStatus {
        if self.total == 0 {
            StageStatus::Partial
        } else if self.succeeded == 0 {
            StageStatus::Failed
        } else if self.failed > 0 {
            StageStatus::Partial
        } else {
            StageStatus::Ok
        }
    }

    fn detail(&self) -> String {
        format!(
            "{} functions, {} decompiled, {} failed",
            self.total, self.succeeded, self.failed
        )
    }
}

fn completed_export(out: &Path) -> Option<ExportSummary> {
    if ![
        "complete.txt",
        "functions.jsonl",
        "decompiled.c",
        "decompile-errors.jsonl",
    ]
    .iter()
    .all(|name| out.join(name).is_file())
    {
        return None;
    }
    let summary: ExportSummary =
        serde_json::from_slice(&std::fs::read(out.join("summary.json")).ok()?).ok()?;
    (summary.succeeded.checked_add(summary.failed) == Some(summary.total)
        && summary.failed <= summary.total)
        .then_some(summary)
}

fn launcher() -> Result<PathBuf, String> {
    let dir = std::env::var_os("GHIDRA_INSTALL_DIR").ok_or("GHIDRA_INSTALL_DIR is not set")?;
    let dir = PathBuf::from(dir);
    if !dir.is_dir() {
        return Err(format!(
            "GHIDRA_INSTALL_DIR points to missing directory {}",
            dir.display()
        ));
    }
    let name = if cfg!(windows) {
        "analyzeHeadless.bat"
    } else {
        "analyzeHeadless"
    };
    let p = dir.join("support").join(name);
    if p.is_file() {
        p.canonicalize()
            .map(|path| ghidra_path(&path))
            .map_err(|e| format!("{}: {e}", p.display()))
    } else {
        Err(format!("{} not found", p.display()))
    }
}

#[cfg(windows)]
fn run_headless(
    launcher: &Path,
    args: &[String],
    cwd: &Path,
    timeout: Duration,
) -> Result<super::util::RunResult, String> {
    // Windows cannot CreateProcess a .bat file. Keep user-controlled paths and arguments out of
    // cmd.exe's command text; this shim only expands quoted, per-argument environment variables.
    let mut env = vec![(
        "YOLO_RE_GHIDRA_ARG_0".to_string(),
        launcher.display().to_string(),
    )];
    let mut command = String::from("if 1==1 (");
    command.push_str(" \"%YOLO_RE_GHIDRA_ARG_0%\"");
    for (index, arg) in args.iter().enumerate() {
        let name = format!("YOLO_RE_GHIDRA_ARG_{}", index + 1);
        env.push((name.clone(), arg.clone()));
        command.push_str(&format!(" \"%{name}%\""));
    }
    command.push_str(" )");
    let shell = std::env::var_os("ComSpec").unwrap_or_else(|| "cmd.exe".into());
    run_cmd_raw_tail(
        &PathBuf::from(shell),
        &["/d".into(), "/c".into()],
        &format!(" {command}"),
        Some(cwd),
        &env,
        timeout,
    )
}

#[cfg(not(windows))]
fn run_headless(
    launcher: &Path,
    args: &[String],
    cwd: &Path,
    timeout: Duration,
) -> Result<super::util::RunResult, String> {
    run_cmd(launcher, args, Some(cwd), &[], timeout)
}

impl StageAdapter for Ghidra {
    fn id(&self) -> &str {
        if self.stage == Stage::Analyze {
            "ghidra-headless"
        } else {
            "ghidra-headless-decompile"
        }
    }

    fn stage(&self) -> Stage {
        self.stage
    }

    fn info(&self, opts: &Options) -> AdapterInfo {
        let (status, reason) = match launcher() {
            Err(r) => (AdapterStatus::Unavailable, Some(r)),
            Ok(_) if opts.external => (AdapterStatus::Ready, None),
            Ok(_) => (
                AdapterStatus::Registered,
                Some("installed; enable with --external".to_string()),
            ),
        };
        AdapterInfo {
            id: self.id().to_string(),
            stage: self.stage,
            kind: AdapterKind::Env,
            owner: "GHIDRA_INSTALL_DIR".to_string(),
            handles: vec!["*".to_string()],
            status,
            reason,
        }
    }

    fn applies(&self, _ctx: &Ctx) -> bool {
        true
    }

    fn run(&self, ctx: &mut Ctx) -> StageReport {
        let id = self.id();
        if self.stage == Stage::Decompile {
            return match ctx
                .ghidra_out
                .as_ref()
                .and_then(|d| completed_export(d).map(|s| (d, s)))
            {
                Some((d, summary)) => {
                    let mut r = report(self.stage, id, summary.status(), summary.detail());
                    r.artifacts = list_files(d, "c");
                    r
                }
                _ => report(
                    self.stage,
                    id,
                    StageStatus::Skipped,
                    "Ghidra analysis produced no export",
                ),
            };
        }
        ctx.ghidra_out = None;
        let launcher = match launcher() {
            Ok(l) => l,
            Err(e) => return report(self.stage, id, StageStatus::Unavailable, e),
        };
        let Some(input) = ctx.effective_path() else {
            return report(self.stage, id, StageStatus::Skipped, "no input available");
        };
        let input = match input.canonicalize() {
            Ok(path) => ghidra_path(&path),
            Err(e) => {
                return report(
                    self.stage,
                    id,
                    StageStatus::Failed,
                    format!("{}: {e}", input.display()),
                );
            }
        };
        let work = match create_run_dir(&ctx.dir("analyze").join("ghidra")) {
            Ok(path) => path,
            Err(e) => return report(self.stage, id, StageStatus::Failed, e.to_string()),
        };
        let scripts = work.join("scripts");
        let out = work.join("export");
        let proj = work.join("project");
        for d in [&scripts, &out, &proj] {
            if let Err(e) = std::fs::create_dir_all(d) {
                return report(self.stage, id, StageStatus::Failed, e.to_string());
            }
        }
        if let Err(e) = std::fs::write(scripts.join(SCRIPT_NAME), SCRIPT) {
            return report(self.stage, id, StageStatus::Failed, e.to_string());
        }
        let args: Vec<String> = [
            proj.display().to_string(),
            "bunre".into(),
            "-import".into(),
            input.display().to_string(),
            "-overwrite".into(),
            "-analysisTimeoutPerFile".into(),
            "600".into(),
            "-scriptPath".into(),
            scripts.display().to_string(),
            "-postScript".into(),
            SCRIPT_NAME.into(),
            out.display().to_string(),
            "-deleteProject".into(),
        ]
        .into();
        match run_headless(
            &launcher,
            &args,
            &work,
            Duration::from_secs(ctx.opts.timeout_secs),
        ) {
            Err(e) => report(self.stage, id, StageStatus::Failed, e),
            Ok(r) => {
                let exported = completed_export(&out);
                let status = exported
                    .as_ref()
                    .filter(|_| r.ok())
                    .map_or(StageStatus::Failed, ExportSummary::status);
                if r.ok() && exported.is_some() {
                    ctx.ghidra_out = Some(out.clone());
                }
                let mut rep = report(
                    self.stage,
                    id,
                    status,
                    if r.timed_out {
                        "timed out".to_string()
                    } else if r.ok() && exported.is_none() {
                        format!(
                            "Ghidra exited without a complete export: {} {}",
                            tail(&r.stdout, 2000),
                            tail(&r.stderr, 300)
                        )
                    } else if r.ok() {
                        exported.as_ref().expect("validated export").detail()
                    } else {
                        format!(
                            "exit {:?}: {} {}",
                            r.code,
                            tail(&r.stdout, 2000),
                            tail(&r.stderr, 300)
                        )
                    },
                );
                rep.artifacts = list_files(&out, "export");
                rep
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(windows)]
    #[test]
    fn strips_extended_windows_prefix_for_java_and_cmd_paths() {
        assert_eq!(
            ghidra_path(Path::new(r"\\?\C:\ghidra\support\analyzeHeadless.bat")),
            PathBuf::from(r"C:\ghidra\support\analyzeHeadless.bat")
        );
        assert_eq!(
            ghidra_path(Path::new(r"\\?\UNC\server\share\input.exe")),
            PathBuf::from(r"\\server\share\input.exe")
        );
    }

    #[cfg(windows)]
    #[test]
    fn batch_launcher_preserves_quoted_arguments_and_percent_literals() {
        let temp = tempfile::Builder::new()
            .prefix("ghidra launcher %TEMP% ")
            .tempdir()
            .unwrap();
        let launcher = temp.path().join("fixture with spaces %TEMP%.cmd");
        std::fs::write(&launcher, "@echo off\r\necho [%~1] [%~2]\r\n").unwrap();
        let result = run_headless(
            &launcher,
            &["one two".into(), "100%TEMP%".into()],
            temp.path(),
            Duration::from_secs(10),
        )
        .unwrap();
        assert!(result.ok(), "{result:?}");
        assert!(
            result.stdout.contains("[one two] [100%TEMP%]"),
            "{result:?}"
        );
    }

    #[test]
    fn runs_are_isolated_and_require_complete_exports() {
        let temp = tempfile::Builder::new()
            .prefix("yolo-ghidra-")
            .tempdir()
            .unwrap();
        let first = create_run_dir(temp.path()).unwrap();
        let second = create_run_dir(temp.path()).unwrap();
        assert_ne!(first, second);
        std::fs::write(first.join("decompiled.c"), "old output").unwrap();
        std::fs::write(first.join("functions.jsonl"), "").unwrap();
        std::fs::write(first.join("decompile-errors.jsonl"), "").unwrap();
        std::fs::write(
            first.join("summary.json"),
            r#"{"total":1,"succeeded":1,"failed":0}"#,
        )
        .unwrap();
        std::fs::write(first.join("complete.txt"), "complete\n").unwrap();
        assert_eq!(completed_export(&first).unwrap().status(), StageStatus::Ok);
        assert!(completed_export(&second).is_none());
        std::fs::write(second.join("decompiled.c"), "partial").unwrap();
        std::fs::write(second.join("functions.jsonl"), "").unwrap();
        assert!(completed_export(&second).is_none());
        std::fs::write(
            first.join("summary.json"),
            r#"{"total":3,"succeeded":2,"failed":1}"#,
        )
        .unwrap();
        assert_eq!(
            completed_export(&first).unwrap().status(),
            StageStatus::Partial
        );
        assert!(SCRIPT.contains("StandardCharsets.UTF_8"));
        let opts = Options::new("", super::super::contract::TargetKind::Os, temp.path());
        let mut ctx = Ctx::new(opts);
        ctx.ghidra_out = Some(first.clone());
        let report = Ghidra {
            stage: Stage::Decompile,
        }
        .run(&mut ctx);
        assert_eq!(report.status, StageStatus::Partial);
        assert!(report.detail.contains("2 decompiled, 1 failed"));
        std::fs::write(
            first.join("summary.json"),
            r#"{"total":3,"succeeded":0,"failed":3}"#,
        )
        .unwrap();
        assert_eq!(
            completed_export(&first).unwrap().status(),
            StageStatus::Failed
        );
        std::fs::write(
            first.join("summary.json"),
            r#"{"total":3,"succeeded":3,"failed":1}"#,
        )
        .unwrap();
        assert!(completed_export(&first).is_none());
        std::fs::write(
            first.join("summary.json"),
            r#"{"total":0,"succeeded":0,"failed":0}"#,
        )
        .unwrap();
        assert_eq!(
            completed_export(&first).unwrap().status(),
            StageStatus::Partial
        );
    }

    #[test]
    #[ignore = "requires GHIDRA_INSTALL_DIR and YOLO_GHIDRA_TEST_INPUT"]
    fn real_headless_export() {
        let input = PathBuf::from(std::env::var_os("YOLO_GHIDRA_TEST_INPUT").unwrap());
        let temp = tempfile::Builder::new()
            .prefix("yolo ghidra ")
            .tempdir()
            .unwrap();
        let mut opts = Options::new("", super::super::contract::TargetKind::Os, temp.path());
        opts.timeout_secs = 300;
        let mut ctx = Ctx::new(opts);
        ctx.payload = Some(input);
        let report = Ghidra {
            stage: Stage::Analyze,
        }
        .run(&mut ctx);
        assert_eq!(report.status, StageStatus::Ok, "{report:?}");
        let export = ctx.ghidra_out.as_ref().unwrap();
        assert!(completed_export(export).is_some());
        assert!(
            !std::fs::read_to_string(export.join("functions.jsonl"))
                .unwrap()
                .is_empty()
        );
        let decompile = Ghidra {
            stage: Stage::Decompile,
        }
        .run(&mut ctx);
        assert_eq!(decompile.status, StageStatus::Ok, "{decompile:?}");
    }
}
