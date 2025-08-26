import {ethers, SigningKey} from "ethers";

// 简单的类型声明修复 window.ethereum 错误
declare global {
  interface Window {
    ethereum?: any;
  }
}

// 输入：浏览器导出的 exportPackage
interface ExportPackage {
  address: string;
  encPubBase64: string;
  challenge: string;
  signature: string;
}

function runInExplorerConsole() {
  (async () => {
    if (!window.ethereum) {
      console.error("请先安装 MetaMask 或确保 window.ethereum 可用");
      return;
    }

    try {
      // 1. 请求钱包授权并获取当前账户
      const [address] = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (!address) {
        console.error("未获取到账户");
        return;
      }

      // 2. 获取该地址的 encryptionPublicKey (MetaMask 允许通过此方法获取)
      const encPubBase64 = await window.ethereum.request({
        method: "eth_getEncryptionPublicKey",
        params: [address],
      });

      // 3. 构造 challenge
      const challenge = `Encryption Public Key Declaration
address: ${address}
encPubBase64: ${encPubBase64}`;

      // 4. 请求签名
      const signature = await window.ethereum.request({
        method: "personal_sign",
        params: [challenge, address],
      });

      // 5. 组装导出对象
      const pkg = {
        address,
        encPubBase64,
        challenge,
        signature,
      };

      console.log("签名完成，pkg 对象：", pkg);
      console.log("JSON 格式：", JSON.stringify(pkg));
    } catch (err) {
      console.error("执行过程中出错：", err);
    }
  })();
}

function recoverPubkeys(address: string, challenge: string, signature: string) {
  const digest = ethers.hashMessage(challenge);
  return SigningKey.recoverPublicKey(digest, signature)
}

// Example usage
const pkg: ExportPackage = {
  "address": "0xafedb26dfd24082ab8ebf0eba022c3da9813d69b",
  "encPubBase64": "BO6ehe7KGZ4hxqJEUTHos8EvJ5zvRIS0mFF/85Lf4kA=",
  "challenge": "Encryption Public Key Declaration\naddress: 0xafedb26dfd24082ab8ebf0eba022c3da9813d69b\nencPubBase64: BO6ehe7KGZ4hxqJEUTHos8EvJ5zvRIS0mFF/85Lf4kA=",
  "signature": "0x55a6098b223d4323e62a10151a0cf56986c87a9ad6cb040f8232308f1fcefd4952f3097c86bb40e66d7064aa319c6846794303f0520d0f156f8fbd418715399d1c"
}

const result = recoverPubkeys(pkg.address, pkg.challenge, pkg.signature);
console.log("Public Key: ", result);
