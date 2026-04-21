import { createLogger } from '../logger-utils.js';
import { run } from '../index.js';
import { PreviewConfig } from '../config.js';

const config = new PreviewConfig();
const logger = await createLogger(config.logDir);
const testEnvironment = config.getEnvironment(logger);
await run(config, testEnvironment, logger);
