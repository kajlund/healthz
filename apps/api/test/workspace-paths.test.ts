import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { projectDirectory, webDirectory } from '../src/config/paths.js';

describe('workspace paths', () => {
  it('loads configuration from the project root and serves the sibling web build', () => {
    expect(projectDirectory).toBe(
      fileURLToPath(new URL('../../../', import.meta.url)),
    );
    expect(webDirectory).toBe(
      fileURLToPath(new URL('../../web/dist/', import.meta.url)),
    );
  });
});
