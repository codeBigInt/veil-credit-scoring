import { ccc } from '@ckb-ccc/core';
import {
  getSporeById,
  unpackToRawSporeData,
  bufferToRawString,
  type SporeConfig,
} from '@spore-sdk/core';
import type { Cell, Script } from '@ckb-lumos/base';

import type { CkbConfig } from './ckb.config.js';

export type CkbScript = Script;

export class SporeService {
  constructor(private readonly config: CkbConfig) {}

  async getSporeCell(sporeId: string): Promise<Cell> {
    return getSporeById(sporeId, this.config.spore);
  }

  decodeJsonSporeContent(cell: Cell): Record<string, unknown> {
    const raw = unpackToRawSporeData(cell.data);
    if (raw.contentType !== 'application/json') {
      throw new Error(`Expected application/json Spore content, got ${raw.contentType}`);
    }
    const text = bufferToRawString(raw.content);
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Spore JSON content must decode to an object');
    }
    return parsed as Record<string, unknown>;
  }

  sporeConfig(): SporeConfig {
    return this.config.spore;
  }

  cccClient(): ccc.ClientPublicTestnet {
    return new ccc.ClientPublicTestnet({ url: this.config.rpcUrl });
  }
}
