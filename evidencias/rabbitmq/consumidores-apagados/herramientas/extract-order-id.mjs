import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ORDER_ID = /^ORD-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Extract one distinct orderId from actual JSON HTTP response bodies.
 * Postman verbose wraps body text; remove only its pipe prefix, then join
 * without adding whitespace (a wrap can occur inside a JSON string).
 * Request bodies, test output and HTTP_EVIDENCE console text are excluded.
 */
export function extractOrderId(stdout) {
  const lines = stdout.replace(/\x1b\[[0-9;]*m/g, '').split(/\r?\n/);
  const ids = new Set();
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^\s*- v application\/json(?:\s|;|$)/i.test(lines[i])) continue;
    const chunks = [];
    while (i + 1 < lines.length) {
      const match = /^\s*\| ?(.*)$/.exec(lines[i + 1]);
      if (!match) break;
      chunks.push(match[1]);
      i += 1;
    }
    let body;
    try {
      body = JSON.parse(chunks.join(''));
    } catch (cause) {
      throw new Error('Invalid JSON HTTP response; cannot validate orderId', { cause });
    }
    if (body === null || typeof body !== 'object' || Array.isArray(body)
        || !Object.hasOwn(body, 'orderId')) continue;
    if (typeof body.orderId !== 'string' || !ORDER_ID.test(body.orderId)) {
      throw new Error('Invalid orderId UUID in JSON HTTP response');
    }
    ids.add(body.orderId);
  }
  if (ids.size !== 1) {
    throw new Error(`Expected exactly one distinct response orderId; found ${ids.size}`);
  }
  return [...ids][0];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node extract-order-id.mjs STDOUT_FILE');
    console.log(extractOrderId(readFileSync(process.argv[2], 'utf8')));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
