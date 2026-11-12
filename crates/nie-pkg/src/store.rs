use std::fs;
use std::io::{self, Read};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::model::Platform;
use crate::registry::Registry;

#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    #[error("unknown game `{0}`")]
    UnknownGame(String),
    #[error("game `{0}` has no release on `{1}`")]
    NoRelease(String, Platform),
    #[error("game `{0}` is not installed")]
    NotInstalled(String),
    #[error("source `{0}` contains no file")]
    EmptySource(PathBuf),
    #[error("io error on `{path}`: {source}")]
    Io { path: PathBuf, source: io::Error },
    #[error("corrupt install record `{0}`: {1}")]
    Record(PathBuf, toml::de::Error),
}

fn io_err(path: &Path) -> impl FnOnce(io::Error) -> StoreError + '_ {
    move |source| StoreError::Io {
        path: path.to_path_buf(),
        source,
    }
}

/// One hashed file of an installed dump.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FileRecord {
    /// Path relative to the install source, `/`-separated.
    pub path: String,
    pub size: u64,
    pub blake3: String,
}

/// Install record persisted under `<root>/installed/<id>.toml`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Installed {
    pub id: String,
    pub platform: Platform,
    pub revision: u32,
    pub source: PathBuf,
    #[serde(rename = "file")]
    pub files: Vec<FileRecord>,
}

#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct VerifyReport {
    pub ok: usize,
    pub missing: Vec<String>,
    pub changed: Vec<String>,
}

impl VerifyReport {
    pub fn is_clean(&self) -> bool {
        self.missing.is_empty() && self.changed.is_empty()
    }
}

/// Local install root.
#[derive(Debug, Clone)]
pub struct Store {
    root: PathBuf,
}

impl Store {
    pub fn new(root: impl Into<PathBuf>) -> Store {
        Store { root: root.into() }
    }

    fn records_dir(&self) -> PathBuf {
        self.root.join("installed")
    }

    fn record_path(&self, id: &str) -> PathBuf {
        self.records_dir().join(format!("{id}.toml"))
    }

    /// Register a user-owned dump (file or directory) and hash every file.
    pub fn install(
        &self,
        registry: &Registry,
        key: &str,
        platform: Platform,
        source: &Path,
    ) -> Result<Installed, StoreError> {
        let game = registry
            .get(key)
            .ok_or_else(|| StoreError::UnknownGame(key.into()))?;
        if game.release(platform).is_none() {
            return Err(StoreError::NoRelease(game.id.clone(), platform));
        }
        let files = hash_tree(source)?;
        if files.is_empty() {
            return Err(StoreError::EmptySource(source.to_path_buf()));
        }
        let rec = Installed {
            id: game.id.clone(),
            platform,
            revision: game.revision,
            source: source.to_path_buf(),
            files,
        };
        self.write(&rec)?;
        Ok(rec)
    }

    pub fn get(&self, id: &str) -> Result<Installed, StoreError> {
        let path = self.record_path(id);
        let text = match fs::read_to_string(&path) {
            Ok(t) => t,
            Err(e) if e.kind() == io::ErrorKind::NotFound => {
                return Err(StoreError::NotInstalled(id.into()));
            }
            Err(e) => return Err(io_err(&path)(e)),
        };
        toml::from_str(&text).map_err(|e| StoreError::Record(path, e))
    }

    pub fn list(&self) -> Result<Vec<Installed>, StoreError> {
        let dir = self.records_dir();
        let entries = match fs::read_dir(&dir) {
            Ok(e) => e,
            Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(e) => return Err(io_err(&dir)(e)),
        };
        let mut ids: Vec<String> = entries
            .filter_map(Result::ok)
            .filter_map(|e| {
                e.file_name()
                    .to_str()?
                    .strip_suffix(".toml")
                    .map(str::to_owned)
            })
            .collect();
        ids.sort();
        ids.iter().map(|id| self.get(id)).collect()
    }

    /// Rehash the source and compare with the recorded hashes.
    pub fn verify(&self, id: &str) -> Result<VerifyReport, StoreError> {
        let rec = self.get(id)?;
        let mut report = VerifyReport::default();
        let single = rec.source.is_file();
        for f in &rec.files {
            let path = if single {
                rec.source.clone()
            } else {
                rec.source.join(&f.path)
            };
            match hash_file(&path) {
                Ok((size, hash)) if size == f.size && hash == f.blake3 => report.ok += 1,
                Ok(_) => report.changed.push(f.path.clone()),
                Err(_) => report.missing.push(f.path.clone()),
            }
        }
        Ok(report)
    }

    /// Bring the recorded manifest revision to the registry one. Returns the
    /// new revision when it changed.
    pub fn update(&self, registry: &Registry, id: &str) -> Result<Option<u32>, StoreError> {
        let mut rec = self.get(id)?;
        let game = registry
            .get(id)
            .ok_or_else(|| StoreError::UnknownGame(id.into()))?;
        if game.revision <= rec.revision {
            return Ok(None);
        }
        rec.revision = game.revision;
        self.write(&rec)?;
        Ok(Some(rec.revision))
    }

    pub fn remove(&self, id: &str) -> Result<(), StoreError> {
        let path = self.record_path(id);
        fs::remove_file(&path).map_err(|e| match e.kind() {
            io::ErrorKind::NotFound => StoreError::NotInstalled(id.into()),
            _ => io_err(&path)(e),
        })
    }

    fn write(&self, rec: &Installed) -> Result<(), StoreError> {
        let dir = self.records_dir();
        fs::create_dir_all(&dir).map_err(io_err(&dir))?;
        let path = self.record_path(&rec.id);
        let text = toml::to_string(rec).expect("install record always serializes");
        let tmp = path.with_extension("toml.tmp");
        fs::write(&tmp, text).map_err(io_err(&tmp))?;
        fs::rename(&tmp, &path).map_err(io_err(&path))
    }
}

fn hash_file(path: &Path) -> io::Result<(u64, String)> {
    let mut file = fs::File::open(path)?;
    let mut hasher = blake3::Hasher::new();
    let mut buf = vec![0u8; 1 << 16];
    let mut size = 0u64;
    loop {
        let n = file.read(&mut buf)?;
        if n == 0 {
            break;
        }
        size += n as u64;
        hasher.update(&buf[..n]);
    }
    Ok((size, hasher.finalize().to_hex().to_string()))
}

fn hash_tree(source: &Path) -> Result<Vec<FileRecord>, StoreError> {
    let meta = fs::metadata(source).map_err(io_err(source))?;
    if meta.is_file() {
        let (size, blake3) = hash_file(source).map_err(io_err(source))?;
        let name = source
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("dump")
            .to_owned();
        return Ok(vec![FileRecord {
            path: name,
            size,
            blake3,
        }]);
    }
    let mut out = Vec::new();
    let mut stack = vec![source.to_path_buf()];
    while let Some(dir) = stack.pop() {
        for entry in fs::read_dir(&dir).map_err(io_err(&dir))? {
            let path = entry.map_err(io_err(&dir))?.path();
            if path.is_dir() {
                stack.push(path);
            } else {
                let (size, blake3) = hash_file(&path).map_err(io_err(&path))?;
                let rel = path.strip_prefix(source).unwrap_or(&path);
                let rel = rel
                    .components()
                    .map(|c| c.as_os_str().to_string_lossy())
                    .collect::<Vec<_>>();
                out.push(FileRecord {
                    path: rel.join("/"),
                    size,
                    blake3,
                });
            }
        }
    }
    out.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(out)
}
