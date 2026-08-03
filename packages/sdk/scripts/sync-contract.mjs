#!/usr/bin/env node
// Copies the compiled contract JS/ABI + witness.ts from packages/contract into
// packages/sdk/src/vendor, so the SDK can be published to npm without depending
// on @veil-reputation-protocol/contract (which is never published). See src/vendor/README.md.
//
// Deliberately excludes keys/ and zkir/ — those are hosted on S3/CloudFront and
// fetched at runtime via VeilConfig.zkArtifactsBaseUrl, not bundled here.

import { cpSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const sdkRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const contractSrc = join(sdkRoot, '../contract/src');
const vendorDir = join(sdkRoot, 'src/vendor');

const compiledContractDir = join(contractSrc, 'managed/veil-protocol/contract');
const vendorContractDir = join(vendorDir, 'managed/veil-protocol/contract');

mkdirSync(vendorContractDir, { recursive: true });
cpSync(join(compiledContractDir, 'index.js'), join(vendorContractDir, 'index.js'));
cpSync(join(compiledContractDir, 'index.d.ts'), join(vendorContractDir, 'index.d.ts'));
cpSync(join(compiledContractDir, 'index.js.map'), join(vendorContractDir, 'index.js.map'));
cpSync(join(contractSrc, 'witness.ts'), join(vendorDir, 'witness.ts'));

console.log('Synced compiled contract + witness.ts into src/vendor from packages/contract.');
