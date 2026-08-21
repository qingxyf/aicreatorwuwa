import { randomBytes, scryptSync } from 'node:crypto';
import { createInterface } from 'node:readline';

const N = 16_384;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;

function readHiddenPassword() {
  if (process.env.OPS_PASSWORD) return Promise.resolve(process.env.OPS_PASSWORD);
  if (!process.stdin.isTTY || !process.stdin.setRawMode) throw new Error('Set OPS_PASSWORD in a protected shell environment.');

  return new Promise((resolve, reject) => {
    let value = '';
    process.stdout.write('运营后台密码（输入不回显）：');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const onData = (chunk) => {
      const input = String(chunk);
      if (input === '\u0003') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        reject(new Error('Cancelled.'));
        return;
      }
      if (input === '\r' || input === '\n') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.off('data', onData);
        process.stdout.write('\n');
        resolve(value);
        return;
      }
      if (input === '\u007f') value = value.slice(0, -1);
      else if (input.length === 1) value += input;
    };
    process.stdin.on('data', onData);
  });
}

const password = await readHiddenPassword();
if (typeof password !== 'string' || password.length < 12) throw new Error('Password must contain at least 12 characters.');
const salt = randomBytes(16);
const derivedKey = scryptSync(password, salt, KEY_LENGTH, { N, r: R, p: P });
process.stdout.write(`scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${derivedKey.toString('base64url')}\n`);
