import { ethers, SigningKey } from "ethers";
import { utils, Signature } from "@noble/secp256k1";

// 输入：浏览器导出的 exportPackage
interface ExportPackage {
  address: string;
  encPubBase64: string;
  challenge: string;
  signature: string;
}

function recoverPubkeys(address: string, challenge: string, signature: string) {

  const digest = ethers.hashMessage(challenge);
  const publicKey = SigningKey.recoverPublicKey(digest, signature)


  // const publicKey2 = SigningKey.computePublicKey(publicKey, true)

  // const signatureObj = Signature.fromBytes(Buffer.from(ethers.getBytes(pkg.signature)))

  // // 2️⃣ 拆 signature 为 r,s,v
  // let sig = signature.startsWith("0x") ? signature.slice(2) : signature;
  // const r = ethers.toBigInt("0x" + sig.slice(0, 64));
  // const s = ethers.toBigInt("0x" + sig.slice(64, 128));
  // let v = parseInt(sig.slice(128, 130), 16);
  // if (v < 27) v += 27;
  //
  // const sigObj = new Signature(r, s, v - 27)
  //
  // const publicKey = sigObj.recoverPublicKey(ethers.getBytes(digest))
  console.log("Recovered public key (hex, uncompressed 65 bytes):", publicKey) //ethers.hexlify(publicKey.toBytes()));
  // console.log("Recovered public key (hex, uncompressed 65 bytes):", publicKey2) //ethers.hexlify(publicKey.toBytes()));

  //
  // // 3️⃣ 使用 recoverPublicKey 恢复公钥
  // const pubkey = recoverPublicKey(digest, sigObj.r + sigObj.s, sigObj.recovery);
  // console.log("Recovered public key (hex, uncompressed 65 bytes):", pubkey);
  //
  // 4️⃣ 可再计算钱包地址
  const computedAddress = ethers.keccak256("0x" + publicKey.substring(4)).substring(26).toString();
  console.log("Derived Ethereum address:", computedAddress);

  // // 2. 恢复真实签名公钥（未压缩，65 bytes）
  // const pubUncompressed = ethers.recoverPublicKey(digest, signature);
  //
  // // 3. 获取压缩公钥（33 bytes）
  // const pubCompressed = ethers.computePublicKey(pubUncompressed, true);
  //
  // 4. 恢复签名地址
  const recoveredAddress = ethers.recoverAddress(digest, signature);
  console.log("Recovered address:", recoveredAddress);
  //
  // // 5. 转换加密公钥为 hex（方便使用）
  // const encPubHex = Buffer.from(encPubBase64, "base64").toString("hex");

  return {
    publicKey
  };
}

// Example usage
const pkg: ExportPackage = {
  "address": "0x6b315fc332e3b739da8788a86ef860d99d173d0c",
  "encPubBase64": "S/q4UPWGzJbdXxK7c2E9cf9aVeLHWmGtOSBZE0dONUM=",
  "challenge": "Encryption Public Key Declaration\naddress: 0x6b315fc332e3b739da8788a86ef860d99d173d0c\nencPubBase64: S/q4UPWGzJbdXxK7c2E9cf9aVeLHWmGtOSBZE0dONUM=",
  "signature": "0x6dd2ee04ef0236b4ac462bd9f17dcc670659bb824d7cc97d03d7b3b45e5008782352f72ee8034cc8db0ef9062a4b9661fbc320f3a3777045c0c016fdcabede291b"
}

const result = recoverPubkeys(pkg.address, pkg.challenge, pkg.encPubBase64);
console.log(result);
