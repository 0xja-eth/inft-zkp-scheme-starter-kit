export function bigint2Buffer(b: bigint, length?: number): Buffer {
  let hex = b.toString(16);
  if (hex.length % 2) hex = '0' + hex; // 确保偶数位

  let buf = Buffer.from(hex, 'hex');

  if (length !== undefined) {
    if (buf.length > length) {
      throw new Error(`BigInt too large to fit in ${length} bytes`);
    }
    // 前导 0 补齐
    if (buf.length < length) {
      const padding = Buffer.alloc(length - buf.length, 0);
      buf = Buffer.concat([padding, buf]);
    }
  }

  return buf;
}

export function buffer2Bigint(b: Buffer): bigint {
  return BigInt('0x' + b.toString('hex'));
}

export function bigintsToBuffer(bigints: bigint[], blockBytes: number): Buffer {
  const buf = Buffer.alloc(bigints.length * blockBytes);
  for (let i = 0; i < bigints.length; i++) {
    const val = bigints[i];

    const valBuf = bigint2Buffer(val, blockBytes);
    valBuf.copy(buf, i * blockBytes);
  }
  return buf;
}

export function bufferToBigints(buf: Buffer, blockBytes: number): bigint[] {
  const res: bigint[] = [];
  for (let i = 0; i < buf.length; i += blockBytes) {
    const valBuf = buf.subarray(i, i + blockBytes);
    const val = buffer2Bigint(valBuf);

    res.push(val);
  }
  return res;
}
