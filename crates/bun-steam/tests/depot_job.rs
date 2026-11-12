// SPDX-License-Identifier: Apache-2.0
//! Offline end-to-end checks of the depot pipeline used by `bun-steam-depot update|verify`:
//! manifest -> chunk plan -> parallel fetch through our `CachedFetcher` -> files on disk, then
//! resume (valid files skipped, no network) and verify (a corrupted file is re-fetched alone).
#![cfg(feature = "depot")]

use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

use bun_steam::depot::transfer::{CachedFetcher, TransferStats};
use bytes::Bytes;
use steamroom::depot::manifest::{DepotManifest, ManifestChunk, ManifestFile};
use steamroom::depot::{ChunkId, DepotId, DepotKey};
use steamroom::util::checksum::{Sha1Hash, SteamAdler32};
use steamroom_client::download::{BoxError, ChunkFetcher, DepotJob};

const KEY: DepotKey = DepotKey([0x5a; 32]);

/// Mock CDN: serves encrypted chunks and counts requests.
struct MockCdn {
    chunks: HashMap<ChunkId, Bytes>,
    hits: AtomicU64,
}

impl ChunkFetcher for MockCdn {
    async fn fetch_chunk(&self, _depot: DepotId, id: &ChunkId) -> Result<Bytes, BoxError> {
        self.hits.fetch_add(1, Ordering::Relaxed);
        self.chunks
            .get(id)
            .cloned()
            .ok_or_else(|| "missing chunk".into())
    }
}

fn encrypt(plain: &[u8]) -> Vec<u8> {
    let iv = [0x24u8; 16];
    let mut out = steamroom::crypto::symmetric_encrypt_ecb_nopad(&iv, &KEY.0).unwrap();
    out.extend(steamroom::crypto::symmetric_encrypt_cbc(plain, &KEY.0, &iv).unwrap());
    out
}

/// Two files: `data/a.cpk` in three chunks, `b.bin` in one. Windows-style separators as in a
/// Windows depot, which must land as a nested path on Linux.
fn fixture() -> (
    DepotManifest,
    HashMap<ChunkId, Bytes>,
    HashMap<&'static str, Vec<u8>>,
) {
    let files: [(&'static str, Vec<&'static [u8]>); 2] = [
        (
            "data\\a.cpk",
            vec![b"CPK-part-1 ", b"CPK-part-2 ", b"CPK-part-3"],
        ),
        ("b.bin", vec![b"\x00\x01\x02binary\xff"]),
    ];
    let mut chunks = HashMap::new();
    let mut expected = HashMap::new();
    let mut manifest_files = Vec::new();
    let mut n = 0u8;
    for (name, parts) in files {
        let mut offset = 0u64;
        let mut mchunks = Vec::new();
        let mut whole = Vec::new();
        for p in parts {
            n += 1;
            let id = ChunkId([n; 20]);
            chunks.insert(id.clone(), Bytes::from(encrypt(p)));
            let mut c = ManifestChunk::new(id, SteamAdler32::compute(p).0, p.len() as u32);
            c.offset = Some(offset);
            offset += p.len() as u64;
            whole.extend_from_slice(p);
            mchunks.push(c);
        }
        let mut f = ManifestFile::new(name.to_owned(), whole.len() as u64);
        f.sha_content = Some(Sha1Hash::compute(&whole).0);
        f.chunks = mchunks;
        manifest_files.push(f);
        expected.insert(name, whole);
    }
    (DepotManifest::new(manifest_files), chunks, expected)
}

async fn run(
    dir: &std::path::Path,
    manifest: &DepotManifest,
    cdn: Arc<MockCdn>,
    verify: bool,
) -> u64 {
    let stats = Arc::new(TransferStats::default());
    let fetcher = Arc::new(CachedFetcher::new(ArcFetcher(cdn), None, None, stats));
    let job = DepotJob::builder()
        .depot_id(DepotId(2_799_861))
        .depot_key(KEY.clone())
        .install_dir(dir.to_path_buf())
        .max_downloads(8)
        .verify(verify)
        .build()
        .unwrap();
    job.download(manifest, fetcher).await.unwrap().files_skipped
}

struct ArcFetcher(Arc<MockCdn>);

impl ChunkFetcher for ArcFetcher {
    async fn fetch_chunk(&self, d: DepotId, id: &ChunkId) -> Result<Bytes, BoxError> {
        self.0.fetch_chunk(d, id).await
    }
}

fn on_disk(dir: &std::path::Path, name: &str) -> std::path::PathBuf {
    name.split('\\').fold(dir.to_path_buf(), |p, c| p.join(c))
}

#[tokio::test]
async fn chunk_plan_download_resume_and_verify() {
    let (manifest, chunks, expected) = fixture();
    let cdn = Arc::new(MockCdn {
        chunks,
        hits: AtomicU64::new(0),
    });
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path();

    // Fresh install: every chunk fetched once, files reassembled in order.
    run(dir, &manifest, cdn.clone(), true).await;
    assert_eq!(cdn.hits.load(Ordering::Relaxed), 4);
    for (name, bytes) in &expected {
        assert_eq!(&std::fs::read(on_disk(dir, name)).unwrap(), bytes, "{name}");
    }

    // Resume: everything already valid, nothing fetched.
    let skipped = run(dir, &manifest, cdn.clone(), true).await;
    assert_eq!(skipped, 2);
    assert_eq!(cdn.hits.load(Ordering::Relaxed), 4);

    // Verify: same size, wrong content -> only that file's chunk is fetched again.
    std::fs::write(on_disk(dir, "b.bin"), b"\x00\x01\x02BINARY\xff").unwrap();
    let skipped = run(dir, &manifest, cdn.clone(), true).await;
    assert_eq!(skipped, 1);
    assert_eq!(cdn.hits.load(Ordering::Relaxed), 5);
    assert_eq!(
        &std::fs::read(on_disk(dir, "b.bin")).unwrap(),
        &expected["b.bin"]
    );
}

#[test]
fn manifest_parse_rejects_truncated_input() {
    assert!(DepotManifest::parse(&[]).is_err());
    assert!(DepotManifest::parse(&[0xd0, 0x17, 0xf6, 0x71, 0xff]).is_err());
}
