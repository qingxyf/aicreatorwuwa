import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const toyBundleLimitBytes = 140 * 1024 * 1024;

export function readBundleSize(directory) {
  return readdirSync(directory).reduce((total, entry) => {
    const path = join(directory, entry);
    return total + (statSync(path).isDirectory() ? readBundleSize(path) : statSync(path).size);
  }, 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const bundleDirectory = resolve(process.argv[2] ?? 'dist');
  const bundleSize = readBundleSize(bundleDirectory);
  if (bundleSize > toyBundleLimitBytes) {
    console.error(`Toy deployment bundle is ${bundleSize} bytes; the maximum is ${toyBundleLimitBytes} bytes.`);
    process.exitCode = 1;
  } else {
    console.log(`Toy deployment bundle is ${bundleSize} bytes, within the 140 MB limit.`);
  }
}
