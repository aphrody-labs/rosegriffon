# yolo-re-bin-format

Bounded binary-header identification and the associated public report and output-strategy types,
migrated from the GPL-3.0-or-later Bun Engine binary ingestion module. The implementation is
read-only: it classifies headers and does not decode, mount, execute, or convert payloads.

The crate preserves the source license in `LICENSE`. Its API includes `inspect_binary`,
`BinaryInspection`, `BinaryFormat`, `BinaryFamily`, `Architecture`, `Endianness`, and
`output_strategy`.
