// SPDX-License-Identifier: Apache-2.0
//! Process, path and hashing helpers shared by the pipeline stages.

use super::contract::Artifact;
use sha2::{Digest, Sha256};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

/// Captured process result.
#[derive(Debug, Clone)]
pub struct RunResult {
    /// Exit code (`None` when killed by timeout or signal).
    pub code: Option<i32>,
    /// Captured stdout (lossy UTF-8).
    pub stdout: String,
    /// Captured stderr (lossy UTF-8).
    pub stderr: String,
    /// True when the timeout elapsed and the process was killed.
    pub timed_out: bool,
}

impl RunResult {
    /// Exit code zero.
    #[must_use]
    pub fn ok(&self) -> bool {
        self.code == Some(0)
    }
}

/// Run a program with a hard timeout, capturing output in temporary files.
///
/// File capture prevents descendants inheriting stdout from keeping a pipe
/// reader blocked indefinitely after the primary process exits or times out.
///
/// # Errors
/// Returns the spawn error text.
pub fn run_cmd(
    program: &Path,
    args: &[String],
    cwd: Option<&Path>,
    env: &[(String, String)],
    timeout: Duration,
) -> Result<RunResult, String> {
    run_cmd_configured(
        program,
        |cmd| {
            cmd.args(args);
        },
        cwd,
        env,
        timeout,
    )
}

/// Run a Windows command with a raw shell tail after its normal arguments.
///
/// This is only for invoking `.bat`/`.cmd` entrypoints through `cmd.exe /c`; normal subprocesses
/// must use [`run_cmd`] so each argument remains independently escaped by `CreateProcess`.
#[cfg(windows)]
pub fn run_cmd_raw_tail(
    program: &Path,
    args: &[String],
    raw_tail: &str,
    cwd: Option<&Path>,
    env: &[(String, String)],
    timeout: Duration,
) -> Result<RunResult, String> {
    use std::os::windows::process::CommandExt;
    run_cmd_configured(
        program,
        |cmd| {
            cmd.args(args).raw_arg(raw_tail);
        },
        cwd,
        env,
        timeout,
    )
}

fn run_cmd_configured(
    program: &Path,
    configure: impl FnOnce(&mut Command),
    cwd: Option<&Path>,
    env: &[(String, String)],
    timeout: Duration,
) -> Result<RunResult, String> {
    let mut out = tempfile::tempfile().map_err(|e| format!("stdout capture: {e}"))?;
    let mut err = tempfile::tempfile().map_err(|e| format!("stderr capture: {e}"))?;
    let mut cmd = Command::new(program);
    configure(&mut cmd);
    cmd.stdin(Stdio::null())
        .stdout(Stdio::from(out.try_clone().map_err(|e| e.to_string())?))
        .stderr(Stdio::from(err.try_clone().map_err(|e| e.to_string())?));
    if let Some(d) = cwd {
        cmd.current_dir(d);
    }
    for (k, v) in env {
        cmd.env(k, v);
    }
    let mut wrapped: process_wrap::std::CommandWrap = cmd.into();
    #[cfg(unix)]
    wrapped.wrap(process_wrap::std::ProcessGroup::leader());
    #[cfg(windows)]
    wrapped.wrap(process_wrap::std::JobObject);
    let mut child = wrapped
        .spawn()
        .map_err(|e| format!("{}: {e}", program.display()))?;
    let start = Instant::now();
    let mut timed_out = false;
    let status = loop {
        match child.try_wait() {
            Ok(Some(st)) => break Some(st),
            Ok(None) => {
                if start.elapsed() >= timeout {
                    if child.start_kill().is_ok() {
                        let _ = child.inner_mut().wait();
                    }
                    timed_out = true;
                    break None;
                }
                std::thread::sleep(Duration::from_millis(20));
            }
            Err(e) => {
                if child.start_kill().is_ok() {
                    let _ = child.inner_mut().wait();
                }
                return Err(e.to_string());
            }
        }
    };
    // Terminate leftover descendants even when the direct child has exited.
    let _ = child.start_kill();
    let read_capture = |file: &mut std::fs::File| -> Result<String, String> {
        let captured_length = file.metadata().map_err(|e| e.to_string())?.len();
        file.seek(SeekFrom::Start(0)).map_err(|e| e.to_string())?;
        let mut bytes = Vec::new();
        file.take(captured_length)
            .read_to_end(&mut bytes)
            .map_err(|e| e.to_string())?;
        Ok(String::from_utf8_lossy(&bytes).into_owned())
    };
    let stdout = read_capture(&mut out)?;
    let stderr = read_capture(&mut err)?;
    Ok(RunResult {
        code: status.and_then(|s| s.code()),
        stdout,
        stderr,
        timed_out,
    })
}

/// Locate an executable on `PATH` (tries `.exe`, `.cmd`, `.bat` on Windows).
#[must_use]
pub fn which(name: &str) -> Option<PathBuf> {
    let p = Path::new(name);
    if p.is_absolute() && p.is_file() {
        return Some(p.to_path_buf());
    }
    let path = std::env::var_os("PATH")?;
    let exts: &[&str] = if cfg!(windows) {
        &["", ".exe", ".cmd", ".bat"]
    } else {
        &[""]
    };
    for dir in std::env::split_paths(&path) {
        for e in exts {
            let cand = dir.join(format!("{name}{e}"));
            if cand.is_file() {
                return Some(cand);
            }
        }
    }
    None
}

/// Locate a Bun OS checkout containing the emulator core used by recompilation.
#[must_use]
pub fn find_root() -> Option<PathBuf> {
    if let Some(r) = std::env::var_os("BUN_OS_ROOT") {
        let p = PathBuf::from(r);
        if p.join("crates/bun-engine-core/Cargo.toml").is_file() {
            return Some(p);
        }
    }
    let mut cur = std::env::current_dir().ok()?;
    loop {
        if cur.join("crates/bun-engine-core/Cargo.toml").is_file() {
            return Some(cur);
        }
        if !cur.pop() {
            return None;
        }
    }
}

/// Locate the yolo-re workspace independently of the Bun OS emulator checkout.
#[must_use]
pub fn find_re_root() -> Option<PathBuf> {
    fn is_workspace(path: &Path) -> bool {
        path.join("crates/yolo-re-core/Cargo.toml").is_file() && path.join("Cargo.toml").is_file()
    }
    if let Some(root) = std::env::var_os("YOLO_RE_ROOT").map(PathBuf::from)
        && is_workspace(&root)
    {
        return Some(root);
    }
    if let Ok(cwd) = std::env::current_dir()
        && let Some(root) = cwd.ancestors().find(|path| is_workspace(path))
    {
        return Some(root.to_path_buf());
    }
    let manifest = Path::new(env!("CARGO_MANIFEST_DIR"));
    manifest
        .ancestors()
        .find(|path| is_workspace(path))
        .map(Path::to_path_buf)
}

/// SHA-256 hex digest.
#[must_use]
pub fn sha256_hex(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

/// Describe a written file as an artifact.
#[must_use]
pub fn artifact(kind: &str, path: &Path) -> Artifact {
    let bytes = std::fs::metadata(path).map_or(0, |m| m.len());
    Artifact {
        kind: kind.to_string(),
        path: path.display().to_string(),
        bytes,
    }
}

/// Last `n` characters of `s` on a char boundary, for log excerpts.
#[must_use]
pub fn tail(s: &str, n: usize) -> String {
    let t = s.trim();
    if t.len() <= n {
        return t.to_string();
    }
    let mut i = t.len() - n;
    while !t.is_char_boundary(i) {
        i += 1;
    }
    format!("...{}", &t[i..])
}

/// Environment needed by a C compiler targeting the MSVC ABI when the process was not started from a
/// developer prompt: runs `vcvars64.bat` once and returns the variables it sets. Empty elsewhere or
/// when `INCLUDE` is already present.
#[must_use]
pub fn toolchain_env() -> Vec<(String, String)> {
    if !cfg!(windows) || std::env::var_os("INCLUDE").is_some() {
        return Vec::new();
    }
    let mut roots = Vec::new();
    for var in ["ProgramFiles(x86)", "ProgramFiles"] {
        if let Some(p) = std::env::var_os(var) {
            roots.push(PathBuf::from(p).join("Microsoft Visual Studio"));
        }
    }
    for root in roots {
        let Ok(years) = std::fs::read_dir(&root) else {
            continue;
        };
        for year in years.flatten() {
            let Ok(eds) = std::fs::read_dir(year.path()) else {
                continue;
            };
            for ed in eds.flatten() {
                let bat = ed
                    .path()
                    .join("VC")
                    .join("Auxiliary")
                    .join("Build")
                    .join("vcvars64.bat");
                if !bat.is_file() {
                    continue;
                }
                let wrapper =
                    std::env::temp_dir().join(format!("bunre-vcvars-{}.cmd", std::process::id()));
                let body = format!(
                    "@echo off
call \"{}\" >nul
set
",
                    bat.display()
                );
                if std::fs::write(&wrapper, body).is_err() {
                    continue;
                }
                let res = run_cmd(
                    Path::new("cmd.exe"),
                    &["/c".into(), wrapper.display().to_string()],
                    None,
                    &[],
                    Duration::from_secs(60),
                );
                let _ = std::fs::remove_file(&wrapper);
                let Ok(r) = res else { continue };
                if !r.ok() {
                    continue;
                }
                let vars: Vec<(String, String)> = r
                    .stdout
                    .lines()
                    .filter_map(|l| {
                        l.split_once('=')
                            .map(|(k, v)| (k.to_string(), v.trim_end().to_string()))
                    })
                    .filter(|(k, _)| {
                        ["INCLUDE", "LIB", "LIBPATH", "PATH", "Path"].contains(&k.as_str())
                    })
                    .collect();
                if !vars.is_empty() {
                    return vars;
                }
            }
        }
    }
    Vec::new()
}

#[cfg(test)]
mod process_tests {
    use super::*;

    #[test]
    #[ignore = "subprocess fixture"]
    fn descendant_fixture() {
        std::thread::sleep(Duration::from_secs(2));
        std::fs::write(std::env::var_os("YOLO_RE_TEST_MARKER").unwrap(), "escaped").unwrap();
    }

    #[test]
    #[ignore = "subprocess fixture"]
    fn parent_fixture() {
        let mut child = Command::new(std::env::current_exe().unwrap())
            .args([
                "--exact",
                "pipeline::util::process_tests::descendant_fixture",
                "--ignored",
                "--nocapture",
            ])
            .spawn()
            .unwrap();
        println!("descendant started");
        if std::env::var_os("YOLO_RE_TEST_PARENT_EXITS").is_none() {
            let _ = child.wait();
        }
    }

    #[test]
    fn timeout_terminates_descendant_and_captures_output() {
        let temp = tempfile::tempdir().unwrap();
        let marker = temp.path().join("escaped");
        let env = vec![("YOLO_RE_TEST_MARKER".into(), marker.display().to_string())];
        let args = vec![
            "--exact".into(),
            "pipeline::util::process_tests::parent_fixture".into(),
            "--ignored".into(),
            "--nocapture".into(),
        ];
        let start = Instant::now();
        let result = run_cmd(
            &std::env::current_exe().unwrap(),
            &args,
            None,
            &env,
            Duration::from_millis(800),
        )
        .unwrap();
        assert!(result.timed_out, "{result:?}");
        assert!(result.stdout.contains("descendant started"), "{result:?}");
        assert!(start.elapsed() < Duration::from_secs(2));
        std::thread::sleep(Duration::from_millis(2200));
        assert!(!marker.exists(), "descendant survived timeout");
    }

    #[test]
    fn exited_parent_does_not_wait_for_inherited_output_handles() {
        let temp = tempfile::tempdir().unwrap();
        let marker = temp.path().join("escaped");
        let env = vec![
            ("YOLO_RE_TEST_MARKER".into(), marker.display().to_string()),
            ("YOLO_RE_TEST_PARENT_EXITS".into(), "1".into()),
        ];
        let args = vec![
            "--exact".into(),
            "pipeline::util::process_tests::parent_fixture".into(),
            "--ignored".into(),
            "--nocapture".into(),
        ];
        let start = Instant::now();
        let result = run_cmd(
            &std::env::current_exe().unwrap(),
            &args,
            None,
            &env,
            Duration::from_secs(5),
        )
        .unwrap();
        assert!(result.ok(), "{result:?}");
        assert!(result.stdout.contains("descendant started"), "{result:?}");
        assert!(start.elapsed() < Duration::from_secs(2));
        std::thread::sleep(Duration::from_millis(2200));
        assert!(!marker.exists(), "descendant survived parent exit");
    }
}
