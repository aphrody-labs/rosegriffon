//! PE analysis API backed by the local bounded `aphrody-nie-pe-inspect` implementation.

pub use aphrody_re::pe::{
    ImportInfo as PeAnalysisImport, PeReport as PeAnalysis, SectionInfo as PeAnalysisSection,
    inspect as analyze_pe_file, inspect_bytes, inspect_bytes_bounded, inspect_bytes_json,
};
