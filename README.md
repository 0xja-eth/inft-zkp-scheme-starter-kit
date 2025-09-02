# 0G iNFT Starter Kit

基于 0G Protocol 的智能 NFT (iNFT) 开发工具包，实现了完整的 ZKP 验证方案来解决传统 NFT 的元数据验证问题。

## 项目概览

本项目提供了一个完整的基于区块链的智能 NFT 解决方案：

- **iNFT 智能合约**: 遵循 ERC-7857 标准的 AgentNFT 合约实现
- **ZK 加密系统**: 使用 Poseidon 哈希的流密码加密和 ZKP 验证
- **0G 存储集成**: 分布式存储支持
- **CLI 工具**: 完整的铸造、转移、克隆操作脚本
- **TypeScript SDK**: 加密、存储、元数据管理的完整库

## 核心特性

### 🔐 ZK 友好加密
- 使用 Poseidon 哈希的流密码加密
- 分层哈希承诺，支持大文件的高效 ZK 证明
- 密钥封装机制确保安全的密钥转移

### 🏗️ 智能合约架构
- ERC-7857 标准智能 NFT 实现
- Beacon 代理模式支持合约升级
- 多种验证器支持 (TEE/ZKP/Preimage)

### 🌐 分布式存储
- 0G 存储网络集成
- 本地存储服务支持开发
- 元数据加密保护隐私

### 🛠️ 开发工具
- Hardhat + Foundry 双重构建支持
- 完整的 CLI 工具集
- TypeScript SDK 和类型定义

## 快速开始

### 配置合约开发环境

#### Hardhat

Hardhat 是以太坊智能合约开发环境与任务运行器，它可以帮助你编译、部署、测试和调试智能合约，同时支持与 ethers.js 等库集成。Hardhat 适合日常开发、测试和部署流程，是 Solidity 开发者的主力工具之一。

安装和配置方法如下：

```bash
# 安装 Hardhat
pnpm install --save-dev hardhat

# 创建 Hardhat 项目
npx hardhat
```

初始化项目时，Hardhat 会提示选择项目类型：

- Create a basic sample project（带示例合约和测试，推荐新手）
- Create an advanced sample project
- Create an empty hardhat.config.js

选择后，Hardhat 会生成：

- `hardhat.config.js`（核心配置文件）
- `contracts/`（存放 Solidity 合约）
- `scripts/`（部署脚本）
- `test/`（测试文件）

安装依赖：

```bash
pnpm install
```

接下来对安装进行验证，可以运行本地节点：

```bash
npx hardhat node
```

在另一个终端执行测试：

```bash
npx hardhat test
```

如果看到测试运行成功或本地节点启动信息，说明 Hardhat 已成功安装并配置。

#### Foundry（可选）

Foundry 是一个高性能的智能合约开发工具链，专注于快速测试、调试和部署以太坊智能合约。它包含 Forge、Cast 和 Anvil 等组件，支持智能合约的单元测试与集成测试、命令行与区块链节点交互，以及本地 EVM 节点的快速启动和状态模拟。

我个人主要使用 Foundry 来测试智能合约，因为它支持在合约中直接打印日志（类似 JavaScript 的 `console.log`），并提供详细的堆栈跟踪功能，是调试和验证合约逻辑的利器。

除了测试，Foundry 也可以用于合约部署或编写脚本，但我认为在这些场景下，其便利性不如 Hardhat。

因此，如果你的主要目标是合约测试，强烈推荐安装 Foundry；如果主要用于部署和脚本开发，只使用 Hardhat 即可。当然，Hardhat 和 Foundry 是可以一起使用的。

```bash
# 安装 Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 验证安装
forge --version
cast --version
anvil --version
```

如果成功安装，将会返回：

```
forge Version: 1.3.2-stable
Commit SHA: c4245d663339cdfdf478a4a17588c8fc0528e896
Build Timestamp: 2025-08-21T19:03:33.152990000Z (1755803013)
Build Profile: maxperf
cast Version: 1.3.2-stable
Commit SHA: c4245d663339cdfdf478a4a17588c8fc0528e896
Build Timestamp: 2025-08-21T19:03:33.152990000Z (1755803013)
Build Profile: maxperf
anvil Version: 1.3.2-stable
Commit SHA: c4245d663339cdfdf478a4a17588c8fc0528e896
Build Timestamp: 2025-08-21T19:03:33.152990000Z (1755803013)
Build Profile: maxperf
```

要注意的是，当 Foundry 与 Hardhat 一起使用时，需要为 Foundry 配置一个 remappings（在 `foundry.toml` 中配置），用于解析依赖包（尤其是 NPM 包和本地库）的路径映射。

比如，我们可能会配置为：

```toml
remappings = [
    "@openzeppelin/contracts/=node_modules/@openzeppelin/contracts/",
    "@openzeppelin/contracts-upgradeable/=node_modules/@openzeppelin/contracts-upgradeable/",
]
```

配置后，通过 Foundry 编译合约时就能正确解析 `import "@openzeppelin/contracts/***";` 这样的 import 语句

### 配置 Circom 电路开发环境

要使用 Circom 开发零知识证明电路，需要下载 Circom 编译器。

安装教程如下：https://docs.circom.io/getting-started/installation/

- 安装 Rust：

    ```bash
    curl --proto '=https' --tlsv1.2 [https://sh.rustup.rs](https://sh.rustup.rs/) -sSf | sh
    ```

- 拉取 Circom 源代码：

    ```bash
    git clone https://github.com/iden3/circom.git
    ```

- 从源代码中编译并安装：

    ```bash
    cd circom
    cargo build --release
    cargo install --path circom
    ```

- 验证是否成功安装：

    ```bash
    circom --help
    ```

  如果一切正常，将会输出：

    ```
    circom compiler 2.2.2
    IDEN3
    Compiler for the circom programming language
    
    USAGE:
        circom [FLAGS] [OPTIONS] [--] [input]
    
    FLAGS:
            --r1cs                                 Outputs the constraints in r1cs format
            --sym                                  Outputs witness in sym format
            --wasm                                 Compiles the circuit to wasm
            --json                                 Outputs the constraints in json format
            --wat                                  Compiles the circuit to wat
        -c, --c                                    Compiles the circuit to C++
            --O0                                   No simplification is applied
            --O1                                   Only applies signal to signal and signal to constant simplification. This
                                                   is the default option
            --O2                                   Full constraint simplification
            --verbose                              Shows logs during compilation
            --inspect                              Does an additional check over the constraints produced
            --constraint_assert_dissabled          Does not add asserts in the witness generation code to check constraints
                                                   introduced with "==="
            --use_old_simplification_heuristics    Applies the old version of the heuristics when performing linear
                                                   simplification
            --simplification_substitution          Outputs the substitution applied in the simplification phase in json
                                                   format
            --no_asm                               Does not use asm files in witness generation code in C++
            --no_init                              Removes initializations to 0 of variables ("var") in the witness
                                                   generation code
        -h, --help                                 Prints help information
        -V, --version                              Prints version information
    
    OPTIONS:
        -o, --output <output>                    Path to the directory where the output will be written [default: .]
        -p, --prime <prime>                      To choose the prime number to use to generate the circuit. Receives the
                                                 name of the curve (bn128, bls12377, bls12381, goldilocks, grumpkin, pallas,
                                                 secq256r1, vesta) [default: bn128]
        -l <link_libraries>...                   Adds directory to library search path
            --O2round <simplification_rounds>    Maximum number of rounds of the simplification process
    
    ARGS:
        <input>    Path to a circuit with a main component [default: ./circuit.circom]
    
    ```

- 最后，安装对应的 Typescript 套件：

    ```bash
    pnpm install -g snarkjs
    ```

### 1. 项目初始化

```bash
# 克隆项目
git clone <repository-url>
cd 0g-inft-starter-kit

# 安装依赖
pnpm install
```

### 2. 验证开发环境

```bash
# 验证 Hardhat
npx hardhat --version

# 验证 Foundry
forge --version

# 验证 Circom
circom --version

# 编译测试 (验证环境完整性)
pnpm run build
pnpm run foundry:build
```

### 2. 环境配置

创建 `.env` 文件：

```bash
# 部署配置
PRIVATE_KEY_DEV=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80  # 本地测试用
PRIVATE_KEY_TESTNET=your_testnet_private_key_here

# 0G 网络配置
ZG_RPC_URL=https://evmrpc-testnet.0g.ai/
ZG_INDEXER_URL=https://indexer-storage-testnet-turbo.0g.ai/
ZG_CHAIN_ID=16601

# 合约地址 (部署后填写)
AGENT_NFT_ADDRESS=

# 可选：Gas 报告
REPORT_GAS=true
```

### 3. 编译和部署

```bash
# 编译合约 (Hardhat)
pnpm run build

# 或使用 Foundry
pnpm run foundry:build

# 部署到本地网络
pnpm run deploy:localhost

# 部署到 0G 测试网
pnpm run deploy
```

### 4. 运行示例

部署完成后，更新 `.env` 中的 `AGENT_NFT_ADDRESS`，然后运行：

```bash
# 铸造新的 Agent NFT
pnpm run agent:mint

# 查询 NFT 信息
pnpm run agent:query

# 转移 NFT
pnpm run agent:transfer

# 克隆 NFT
pnpm run agent:clone
```

## 项目结构

```
├── circuits/                    # ZK 电路
│   ├── preimage_verifier.circom    # 预像验证电路
│   ├── dual_key_verifier.circom    # 双密钥验证电路
│   └── circomlib/                  # Circom 库文件
├── contracts/                   # 智能合约
│   ├── AgentNFT.sol               # 主要 iNFT 合约
│   ├── interfaces/                # 接口定义
│   └── verifiers/                 # 验证器合约
├── shared/lib/                  # 共享库
│   ├── clients/                   # 客户端封装
│   ├── managers/                  # 业务逻辑管理
│   ├── services/                  # 核心服务
│   │   ├── crypto/                # 加密服务
│   │   └── storage/               # 存储服务
│   └── types/                     # 类型定义
├── scripts/                     # CLI 脚本
│   ├── agent-nft/                 # NFT 操作脚本
│   └── utils/                     # 工具函数
├── test/                        # 测试文件
├── ignition/                    # Hardhat Ignition 部署
└── foundry-test/                # Foundry 测试
```

## 开发指南

### 可用脚本

#### 构建和编译
```bash
pnpm run build          # Hardhat 编译
pnpm run foundry:build  # Foundry 编译
```

#### 测试
```bash
pnpm run test           # Hardhat 测试
pnpm run foundry:test   # Foundry 测试
pnpm run foundry:test-v # Foundry 详细测试
```

#### 部署
```bash
pnpm run deploy:localhost    # 本地部署
pnpm run deploy:0g-testnet   # 0G 测试网部署
pnpm run node               # 启动本地节点
```

#### Agent NFT 操作
```bash
pnpm run agent:mint      # 铸造 Agent NFT
pnpm run agent:query     # 查询 NFT 信息
pnpm run agent:transfer  # 转移 NFT
pnpm run agent:clone     # 克隆 NFT
```

#### 代码质量
```bash
pnpm run lint           # ESLint 检查并修复
pnpm run lint:check     # ESLint 检查
pnpm run prettier       # Prettier 格式化
pnpm run format         # 完整格式化
```

#### ZK 相关
```bash
pnpm run test:stream-enc-zkp  # ZK 加密测试
```

### 网络配置

项目支持多个网络：

#### 本地开发
- **Network**: localhost
- **RPC**: http://127.0.0.1:8545
- **Chain ID**: 31337

#### 0G Galileo 测试网
- **Network**: 0g-testnet
- **RPC**: https://evmrpc-testnet.0g.ai/
- **Chain ID**: 16601
- **浏览器**: https://chainscan-galileo.0g.ai/

### 核心组件使用

#### 1. AgentNFT 客户端

```typescript
import { AgentNFTClient } from './shared/lib/clients/AgentNFTClient';

const client = new AgentNFTClient(contractAddress, signer);

// 铸造新的 Agent NFT
const result = await client.mint({
  model: 'gpt-4-agent',
  weights: 'ipfs://...',
  config: { temperature: 0.7 },
  capabilities: ['nlp', 'analysis'],
  description: 'AI 金融分析师'
});
```

#### 2. 加密服务

```typescript
import { StreamCipherEncryptionService } from './shared/lib/services/crypto/encryption/StreamCipherEncryptionService';

const encService = new StreamCipherEncryptionService();

// 加密数据
const { encryptedData, keystream } = await encService.encrypt(plaintext, keySeed);

// 解密数据
const decryptedData = await encService.decrypt(encryptedData, keySeed);
```

#### 3. 存储服务

```typescript
import { ZGStorageService } from './shared/lib/services/storage/ZGStorageService';

const storage = new ZGStorageService(config);

// 存储数据
const dataHash = await storage.store(data);

// 检索数据
const retrievedData = await storage.retrieve(dataHash);
```

### ZK 电路开发

项目包含多个 Circom 电路，以下是详细的开发和使用流程：

#### 电路文件结构
```
circuits/
├── preimage_verifier.circom        # 预像验证电路
├── dual_key_verifier.circom         # 双密钥验证电路  
├── dual_key_verifier_minimal.circom # 双密钥验证最小版本
├── preimage_verifier_minimal.circom # 预像验证最小版本
└── circomlib/                       # Circom 标准库
    └── circuits/
        ├── poseidon.circom          # Poseidon 哈希函数
        ├── bitify.circom            # 位操作工具
        └── comparators.circom       # 比较器
```

#### ZK 电路编译流程

##### 1. 编译电路
```bash
# 编译预像验证电路
circom circuits/preimage_verifier.circom --r1cs --wasm --sym -o build

# 编译双密钥验证电路
circom circuits/dual_key_verifier.circom --r1cs --wasm --sym -o build
```

##### 2. Powers of Tau 设置
```bash
# 下载 Powers of Tau 文件 (项目已包含)
# 小电路使用 16 阶
zkproof/powersOfTau28_hez_final_16.ptau

# 大电路使用 21 阶  
zkproof/powersOfTau28_hez_final_21.ptau
```

##### 3. 生成证明密钥
```bash
# 设置电路 (以预像验证为例)
snarkjs groth16 setup build/preimage_verifier.r1cs \
  zkproof/powersOfTau28_hez_final_18.ptau \
  zkproof/preimage_verifier.zkey

# 导出验证密钥
snarkjs zkey export verificationkey \
  zkproof/preimage_verifier.zkey \
  zkproof/verification_key.json
```

##### 4. 生成和验证证明
```bash
# 生成见证文件
node build/preimage_verifier_js/generate_witness.js \
  build/preimage_verifier_js/preimage_verifier.wasm \
  temp/input.json \
  zkproof/witness.wtns

# 生成 ZK 证明
snarkjs groth16 prove \
  zkproof/preimage_verifier.zkey \
  zkproof/witness.wtns \
  zkproof/proof.json \
  zkproof/public.json

# 验证证明
snarkjs groth16 verify \
  zkproof/verification_key.json \
  zkproof/public.json \
  zkproof/proof.json
```

#### 电路功能说明

##### 预像验证电路 (`preimage_verifier.circom`)
- **功能**: 验证密钥和消息的预像知识
- **输入**: 密钥、消息块 (128 x 16字节)
- **输出**: nonce、MAC、密文
- **约束**: ~133K (需要 2^18 阶 Powers of Tau)

##### 双密钥验证电路 (`dual_key_verifier.circom`)  
- **功能**: 支持更复杂的密钥验证场景
- **应用**: 密钥转移和封装验证
- **版本**: 包含完整版和最小化版本

#### 电路开发最佳实践

##### 1. 约束优化
```circom
// 优化前 - 多次调用 Poseidon
component h1 = Poseidon(2);
component h2 = Poseidon(2);

// 优化后 - 使用链式哈希
component chain = PoseidonChain(N);
```

##### 2. 内存管理
```bash
# 监控内存使用
/usr/bin/time -v circom circuit.circom --r1cs

# 大电路分阶段处理
# 1. 先编译小版本测试
# 2. 确认逻辑正确后编译完整版本
```

##### 3. 调试技巧
```bash
# 生成符号文件用于调试
circom circuit.circom --r1cs --wasm --sym

# 查看约束数量
snarkjs info -r build/circuit.r1cs
```

#### 集成到智能合约

##### 1. 生成 Solidity 验证器
```bash
snarkjs zkey export solidityverifier \
  zkproof/circuit.zkey \
  contracts/verifiers/CircuitVerifier.sol
```

##### 2. 部署和使用
```solidity
// 部署验证器合约
CircuitVerifier verifier = new CircuitVerifier();

// 在 AgentNFT 中使用
function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint[] memory input
) public view returns (bool) {
    return verifier.verifyProof(a, b, c, input);
}
```

### 智能合约架构

#### AgentNFT 合约特性
- 遵循 ERC-7857 标准
- 支持元数据加密和验证
- 可升级的 Beacon 代理模式
- 多种验证器支持

#### 验证器系统
- **TEEVerifier**: TEE (可信执行环境) 验证
- **ZKPVerifier**: ZK 证明验证
- **PreimageVerifier**: 预像知识验证

## 测试

### Hardhat 测试
```bash
pnpm run test
```

### Foundry 测试
```bash
pnpm run foundry:test
```

### ZK 加密测试
```bash
pnpm run test:stream-enc-zkp
```

## 安全考虑

- **私钥管理**: 绝不将私钥提交到代码库
- **密钥封装**: 生产环境使用 ECIES 而非 XOR
- **证明验证**: 集成实际的 TEE/ZKP 验证器
- **存储安全**: 确保 0G 存储端点的安全性

## 故障排除

### 常见问题

1. **编译错误**: 确保安装了所有依赖
2. **部署失败**: 检查网络配置和私钥设置
3. **ZK 电路问题**: 确保有足够的内存和正确的 Powers of Tau
4. **存储错误**: 验证 0G 网络连接和配置

### 调试技巧

- 使用 `pnpm run foundry:test-v` 获取详细测试输出
- 启用 Gas 报告查看合约优化情况
- 使用 Hardhat 控制台进行交互式调试

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

## 支持与社区

- 📖 [0G 官方文档](https://docs.0g.ai/)
- 💬 [0G 社区 Discord](https://discord.gg/0g)
- 🐛 [GitHub Issues](https://github.com/your-repo/issues)
- 🌐 [0G 官网](https://0g.ai/)

---

*最后更新: 2025-01-31*
*维护者: 0G Team*