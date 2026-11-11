use std::io::{Read, Seek, SeekFrom};
use std::path::PathBuf;
use std::process::ExitCode;

fn usage() -> ExitCode {
    eprintln!(
        "usage: bunre formats <inspect|cpk-list> <input> | cpk-extract <input> <member> <output> | cpk-extract-all <input> <output-dir> [--suffix .a,.b] | cpk-pack <input-dir> <output.cpk> | cri-audio <input> <output.wav>"
    );
    ExitCode::from(2)
}

fn safe_member_path(entry: &aphrody_nie_formats::cpk::CpkEntry) -> Option<PathBuf> {
    let mut path = PathBuf::new();
    let directory = if entry.directory.is_empty() {
        Vec::new()
    } else {
        entry.directory.split(['/', '\\']).collect()
    };
    for component in directory.into_iter().chain([entry.filename.as_str()]) {
        if component.is_empty() || component == "." || component == ".." || component.contains(':')
        {
            return None;
        }
        path.push(component);
    }
    Some(path)
}

fn archive_name(path: &std::path::Path) -> String {
    path.file_name()
        .unwrap_or(path.as_os_str())
        .to_string_lossy()
        .into_owned()
}

fn read_range(
    path: &std::path::Path,
    offset: u64,
    size: usize,
) -> Result<Vec<u8>, aphrody_nie_formats::FormatError> {
    let mut file = std::fs::File::open(path).map_err(|e| {
        aphrody_nie_formats::FormatError::Malformed(format!("cannot open {}: {e}", path.display()))
    })?;
    file.seek(SeekFrom::Start(offset)).map_err(|e| {
        aphrody_nie_formats::FormatError::Malformed(format!("cannot seek {}: {e}", path.display()))
    })?;
    let mut bytes = vec![0; size];
    file.read_exact(&mut bytes).map_err(|e| {
        aphrody_nie_formats::FormatError::Malformed(format!("cannot read {}: {e}", path.display()))
    })?;
    Ok(bytes)
}

fn open_cpk(
    path: &std::path::Path,
) -> Result<aphrody_nie_formats::cpk::CpkReader, aphrody_nie_formats::FormatError> {
    let name = archive_name(path);
    aphrody_nie_formats::cpk::CpkReader::from_reader(&name, |offset, size| {
        read_range(path, offset, size)
    })
}

fn pack_directory(root: &std::path::Path) -> Result<Vec<u8>, String> {
    fn visit(
        root: &std::path::Path,
        current: &std::path::Path,
        entries: &mut Vec<aphrody_nie_formats::cpk_encode::CpkWriteEntry>,
    ) -> Result<(), String> {
        for item in std::fs::read_dir(current).map_err(|e| e.to_string())? {
            let item = item.map_err(|e| e.to_string())?;
            let ty = item.file_type().map_err(|e| e.to_string())?;
            if ty.is_symlink() {
                return Err(format!("refusing symlink: {}", item.path().display()));
            }
            if ty.is_dir() {
                visit(root, &item.path(), entries)?;
                continue;
            }
            if !ty.is_file() {
                continue;
            }
            let item_path = item.path();
            let rel = item_path.strip_prefix(root).map_err(|e| e.to_string())?;
            let filename = rel
                .file_name()
                .and_then(|s| s.to_str())
                .ok_or("non-UTF-8 filename")?
                .to_owned();
            let directory = rel
                .parent()
                .and_then(|p| p.to_str())
                .unwrap_or("")
                .replace('\\', "/");
            entries.push(aphrody_nie_formats::cpk_encode::CpkWriteEntry {
                filename,
                directory,
                data: std::fs::read(item_path).map_err(|e| e.to_string())?,
            });
        }
        Ok(())
    }
    let mut entries = Vec::new();
    visit(root, root, &mut entries)?;
    aphrody_nie_formats::cpk_encode::encode_cpk(&entries)
}

pub fn main(mut args: impl Iterator<Item = std::ffi::OsString>) -> ExitCode {
    let Some(command) = args.next().and_then(|arg| arg.into_string().ok()) else {
        return usage();
    };
    let Some(input) = args.next().map(PathBuf::from) else {
        return usage();
    };
    match command.as_str() {
        "inspect" => {
            let bytes = match std::fs::read(&input) {
                Ok(bytes) => bytes,
                Err(error) => {
                    eprintln!("bunre formats: cannot read {}: {error}", input.display());
                    return ExitCode::FAILURE;
                }
            };
            match aphrody_nie_formats::decode::decode(&bytes) {
                Some(decoded) => {
                    println!(
                        "{{\"format\":{},\"data\":{}}}",
                        serde_json::to_string(decoded.format).unwrap_or_else(|_| "null".into()),
                        String::from_utf8_lossy(&decoded.json)
                    );
                    ExitCode::SUCCESS
                }
                None => {
                    eprintln!("bunre formats: unsupported or malformed format");
                    ExitCode::from(1)
                }
            }
        }
        "cpk-list" => match open_cpk(&input) {
            Ok(archive) => {
                let report = serde_json::json!({ "encrypted": archive.is_encrypted, "file_key": archive.file_key, "entries": archive.entries });
                match serde_json::to_string_pretty(&report) {
                    Ok(json) => {
                        println!("{json}");
                        ExitCode::SUCCESS
                    }
                    Err(error) => {
                        eprintln!("bunre formats: {error}");
                        ExitCode::FAILURE
                    }
                }
            }
            Err(error) => {
                eprintln!("bunre formats: invalid CPK: {error}");
                ExitCode::from(1)
            }
        },
        "cpk-extract" => {
            let Some(member) = args.next().and_then(|arg| arg.into_string().ok()) else {
                return usage();
            };
            let Some(output) = args.next().map(PathBuf::from) else {
                return usage();
            };
            if args.next().is_some() {
                return usage();
            }
            let archive = match open_cpk(&input) {
                Ok(archive) => archive,
                Err(error) => {
                    eprintln!("bunre formats: invalid CPK: {error}");
                    return ExitCode::from(1);
                }
            };
            let Some(entry) = archive.find_file(&member) else {
                eprintln!("bunre formats: CPK member not found: {member}");
                return ExitCode::from(1);
            };
            match archive
                .extract_from_reader(entry, |offset, size| read_range(&input, offset, size))
                .and_then(|data| {
                    std::fs::write(&output, data).map_err(|_| {
                        aphrody_nie_formats::FormatError::Corrupt("cannot write extraction output")
                    })
                }) {
                Ok(()) => {
                    println!("{}", output.display());
                    ExitCode::SUCCESS
                }
                Err(error) => {
                    eprintln!("bunre formats: extraction failed: {error}");
                    ExitCode::FAILURE
                }
            }
        }
        "cpk-extract-all" => {
            let Some(output_dir) = args.next().map(PathBuf::from) else {
                return usage();
            };
            let suffixes: Option<Vec<String>> = match args.next().and_then(|a| a.into_string().ok())
            {
                None => None,
                Some(flag) if flag == "--suffix" => {
                    match args.next().and_then(|a| a.into_string().ok()) {
                        Some(list) => Some(
                            list.split(',')
                                .filter(|s| !s.is_empty())
                                .map(|s| s.to_ascii_lowercase())
                                .collect(),
                        ),
                        None => return usage(),
                    }
                }
                Some(_) => return usage(),
            };
            if args.next().is_some() {
                return usage();
            }
            let archive = match open_cpk(&input) {
                Ok(archive) => archive,
                Err(error) => {
                    eprintln!("bunre formats: invalid CPK: {error}");
                    return ExitCode::from(1);
                }
            };
            if let Err(error) = std::fs::create_dir_all(&output_dir) {
                eprintln!("bunre formats: cannot create extraction directory: {error}");
                return ExitCode::FAILURE;
            }
            let canonical_root = match std::fs::canonicalize(&output_dir) {
                Ok(path) => path,
                Err(error) => {
                    eprintln!("bunre formats: cannot resolve extraction directory: {error}");
                    return ExitCode::FAILURE;
                }
            };
            let mut written = 0usize;
            for entry in &archive.entries {
                if let Some(suffixes) = &suffixes {
                    let name = entry.filename.to_ascii_lowercase();
                    if !suffixes.iter().any(|s| name.ends_with(s.as_str())) {
                        continue;
                    }
                }
                let Some(relative) = safe_member_path(entry) else {
                    eprintln!(
                        "bunre formats: unsafe CPK member path: {}/{}",
                        entry.directory, entry.filename
                    );
                    return ExitCode::from(1);
                };
                let destination = canonical_root.join(&relative);
                let mut checked_path = canonical_root.clone();
                let components: Vec<_> = relative.components().collect();
                for component in components.iter().take(components.len().saturating_sub(1)) {
                    checked_path.push(component);
                    if std::fs::symlink_metadata(&checked_path)
                        .is_ok_and(|metadata| metadata.file_type().is_symlink())
                    {
                        eprintln!(
                            "bunre formats: refusing symlink in extraction path: {}",
                            checked_path.display()
                        );
                        return ExitCode::FAILURE;
                    }
                }
                let data = match archive
                    .extract_from_reader(entry, |offset, size| read_range(&input, offset, size))
                {
                    Ok(data) => data,
                    Err(error) => {
                        eprintln!("bunre formats: extraction failed: {error}");
                        return ExitCode::FAILURE;
                    }
                };
                if let Some(parent) = destination.parent()
                    && let Err(error) = std::fs::create_dir_all(parent)
                {
                    eprintln!("bunre formats: {error}");
                    return ExitCode::FAILURE;
                }
                if std::fs::symlink_metadata(&destination)
                    .is_ok_and(|metadata| metadata.file_type().is_symlink())
                {
                    eprintln!(
                        "bunre formats: refusing symlink destination: {}",
                        destination.display()
                    );
                    return ExitCode::FAILURE;
                }
                if destination
                    .parent()
                    .and_then(|parent| std::fs::canonicalize(parent).ok())
                    .is_some_and(|parent| !parent.starts_with(&canonical_root))
                {
                    eprintln!("bunre formats: extraction path escapes output directory");
                    return ExitCode::FAILURE;
                }
                if let Err(error) = std::fs::write(&destination, data) {
                    eprintln!("bunre formats: {error}");
                    return ExitCode::FAILURE;
                }
                written += 1;
            }
            eprintln!("bunre formats: extracted {written} members");
            println!("{}", output_dir.display());
            ExitCode::SUCCESS
        }
        "cpk-pack" => {
            let Some(output) = args.next().map(PathBuf::from) else {
                return usage();
            };
            if args.next().is_some() || !input.is_dir() {
                return usage();
            }
            match pack_directory(&input)
                .and_then(|data| std::fs::write(&output, data).map_err(|e| e.to_string()))
            {
                Ok(()) => {
                    println!("{}", output.display());
                    ExitCode::SUCCESS
                }
                Err(error) => {
                    eprintln!("bunre formats: pack failed: {error}");
                    ExitCode::FAILURE
                }
            }
        }
        "cri-audio" => {
            let Some(output) = args.next().map(PathBuf::from) else {
                return usage();
            };
            if args.next().is_some() {
                return usage();
            }
            let bytes = match std::fs::read(&input) {
                Ok(bytes) => bytes,
                Err(error) => {
                    eprintln!("bunre formats: cannot read {}: {error}", input.display());
                    return ExitCode::FAILURE;
                }
            };
            match aphrody_nie_formats::cri_audio::decode_to_wav(&bytes)
                .and_then(|wav| std::fs::write(&output, wav).map_err(|e| e.to_string()))
            {
                Ok(()) => {
                    println!("{}", output.display());
                    ExitCode::SUCCESS
                }
                Err(error) => {
                    eprintln!("bunre formats: CRI audio decode failed: {error}");
                    ExitCode::FAILURE
                }
            }
        }
        _ => usage(),
    }
}
