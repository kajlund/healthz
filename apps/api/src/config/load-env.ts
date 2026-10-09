import { resolve } from 'node:path';
import { config } from 'dotenv';
import { projectDirectory } from './paths.js';

config({ path: resolve(projectDirectory, '.env'), quiet: true });
