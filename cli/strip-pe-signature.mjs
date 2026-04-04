/**
 * Strip Authenticode signature from a Windows PE executable.
 *
 * The Authenticode signature is stored in the Certificate Table data directory
 * (index 4 in the optional header). We zero out the directory entry and truncate
 * the file at the certificate table offset.
 *
 * This is needed before injecting SEA blobs with postject on Linux,
 * because the signature prevents postject from locating the sentinel fuse.
 */

import fs from 'node:fs';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node strip-pe-signature.mjs <file.exe>');
  process.exit(1);
}

const buf = fs.readFileSync(filePath);

// DOS header: e_lfanew at offset 0x3C (4 bytes, LE)
const peOffset = buf.readUInt32LE(0x3c);

// Verify PE signature
if (buf.toString('ascii', peOffset, peOffset + 4) !== 'PE\0\0') {
  console.error('Not a valid PE file');
  process.exit(1);
}

// COFF header starts at peOffset + 4
const coffOffset = peOffset + 4;
const sizeOfOptionalHeader = buf.readUInt16LE(coffOffset + 16);

// Optional header starts after COFF header (20 bytes)
const optOffset = coffOffset + 20;

// Check PE32 vs PE32+ (magic number)
const magic = buf.readUInt16LE(optOffset);
const isPE32Plus = magic === 0x20b; // PE32+ = 0x20b, PE32 = 0x10b

// Certificate Table is data directory entry index 4
// Data directories start at different offsets for PE32 vs PE32+
const dataDirectoryOffset = optOffset + (isPE32Plus ? 112 : 96);
const certTableEntryOffset = dataDirectoryOffset + (4 * 8); // Index 4, each entry is 8 bytes

const certVA = buf.readUInt32LE(certTableEntryOffset);
const certSize = buf.readUInt32LE(certTableEntryOffset + 4);

if (certVA === 0 && certSize === 0) {
  console.log('No Authenticode signature found — nothing to strip.');
  process.exit(0);
}

console.log(`Found certificate table at VA=0x${certVA.toString(16)}, size=${certSize}`);

// Zero out the certificate table data directory entry
buf.writeUInt32LE(0, certTableEntryOffset);
buf.writeUInt32LE(0, certTableEntryOffset + 4);

// Also update the checksum to 0 (offset 64 in optional header)
buf.writeUInt32LE(0, optOffset + 64);

// Truncate the file to remove the certificate data (it's always at the end)
const truncatedBuf = buf.subarray(0, certVA);

fs.writeFileSync(filePath, truncatedBuf);
console.log(`Stripped signature. File truncated from ${buf.length} to ${truncatedBuf.length} bytes.`);
