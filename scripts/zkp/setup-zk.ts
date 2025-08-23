#!/usr/bin/env npx ts-node

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

async function setupZKEnvironment() {
  console.log('🔧 设置ZK证明环境...\n');
  
  const circuits = ['xor_encrypt', 'key_seal'];
  const buildDir = 'build';
  const zkproofDir = 'zkproof';
  
  // 确保目录存在
  if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir);
  if (!fs.existsSync(zkproofDir)) fs.mkdirSync(zkproofDir);
  
  try {
    for (const circuit of circuits) {
      console.log(`📋 处理电路: ${circuit}`);
      console.log('=' .repeat(50));
      
      // 1. 编译电路
      console.log('1️⃣ 编译电路...');
      execSync(`circom circuits/${circuit}.circom --r1cs --wasm --sym`, {
        stdio: 'inherit'
      });
      
      // 移动生成的文件到build目录
      console.log('📁 移动文件到build目录...');
      try {
        if (fs.existsSync(`${circuit}.r1cs`)) {
          fs.renameSync(`${circuit}.r1cs`, `${buildDir}/${circuit}.r1cs`);
        }
        if (fs.existsSync(`${circuit}.sym`)) {
          fs.renameSync(`${circuit}.sym`, `${buildDir}/${circuit}.sym`);
        }
        if (fs.existsSync(`${circuit}_js`)) {
          fs.renameSync(`${circuit}_js`, `${buildDir}/${circuit}_js`);
        }
        if (fs.existsSync(`${circuit}.wasm`)) {
          fs.renameSync(`${circuit}.wasm`, `${buildDir}/${circuit}.wasm`);
        }
        console.log(`✅ 文件移动完成`);
      } catch (moveError: any) {
        console.log(`⚠️ 移动文件时出错: ${moveError.message}`);
      }
      
      // 2. 显示电路信息
      console.log('2️⃣ 电路信息:');
      const infoCmd = `snarkjs r1cs info ${buildDir}/${circuit}.r1cs`;
      execSync(infoCmd, { stdio: 'inherit' });
      
      // 3. 检查WASM文件
      console.log('3️⃣ 检查WASM文件...');
      if (!fs.existsSync(`${buildDir}/${circuit}.wasm`)) {
        console.log('⚠️ WASM文件未生成');
        continue;
      } else {
        console.log('✅ WASM文件生成成功');
      }
      
      console.log(`✅ ${circuit} 电路设置完成\n`);
    }
    
    // 4. 生成通用的trusted setup (小规模测试用)
    console.log('4️⃣ 生成Powers of Tau (trusted setup)...');
    const potauFile = `${zkproofDir}/pot12_0000.ptau`;
    
    if (!fs.existsSync(potauFile)) {
      console.log('生成新的Powers of Tau...');
      execSync(`snarkjs powersoftau new bn128 12 ${potauFile} -v`, {
        stdio: 'inherit'
      });
      
      const contributeFile = `${zkproofDir}/pot12_0001.ptau`;
      execSync(`snarkjs powersoftau contribute ${potauFile} ${contributeFile} --name="First contribution" -v`, {
        stdio: 'inherit'
      });
      
      const finalFile = `${zkproofDir}/pot12_final.ptau`;
      execSync(`snarkjs powersoftau prepare phase2 ${contributeFile} ${finalFile} -v`, {
        stdio: 'inherit'
      });
    } else {
      console.log('Powers of Tau 文件已存在，跳过生成');
    }
    
    console.log('\n🎉 ZK环境设置完成!');
    console.log('\n📋 下一步操作:');
    console.log('1. 运行 npm run zk:prove 生成证明');
    console.log('2. 运行 npm run zk:verify 验证证明');
    console.log('3. 查看 zkproof/ 目录中的文件');
    
  } catch (error: any) {
    console.error('❌ 设置失败:', error.message);
    console.error('\n💡 可能的解决方案:');
    console.error('1. 确保 circom 和 snarkjs 已正确安装');
    console.error('2. 检查电路语法是否正确');
    console.error('3. 确保有足够的内存和磁盘空间');
  }
}

setupZKEnvironment();