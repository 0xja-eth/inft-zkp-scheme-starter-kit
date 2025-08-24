#!/bin/bash

# Rebuild PreimageVerifier circuit after modifications
# This script recompiles circuit and regenerates all necessary files

set -e  # Exit on any error

echo "🔄 Rebuilding PreimageVerifier circuit..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if required files exist
if [ ! -f "circuits/preimage_verifier.circom" ]; then
    echo -e "${RED}❌ Circuit file not found: circuits/preimage_verifier.circom${NC}"
    exit 1
fi

if [ ! -f "zkproof/powersOfTau28_hez_final_18.ptau" ]; then
    echo -e "${RED}❌ Powers of Tau file not found: zkproof/powersOfTau28_hez_final_18.ptau${NC}"
    exit 1
fi

# Create build directory if it doesn't exist
mkdir -p build

echo -e "${YELLOW}📝 Step 1: Compiling circuit...${NC}"
circom circuits/preimage_verifier.circom --r1cs --wasm --sym -o build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Circuit compilation successful${NC}"
else
    echo -e "${RED}❌ Circuit compilation failed${NC}"
    exit 1
fi

echo -e "${YELLOW}📊 Step 2: Checking circuit info...${NC}"
snarkjs r1cs info build/preimage_verifier.r1cs

echo -e "${YELLOW}🔑 Step 3: Generating zkey (phase 1)...${NC}"
snarkjs groth16 setup build/preimage_verifier.r1cs zkproof/powersOfTau28_hez_final_18.ptau build/preimage_verifier_0000.zkey

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ zkey generation successful${NC}"
else
    echo -e "${RED}❌ zkey generation failed${NC}"
    exit 1
fi

echo -e "${YELLOW}🤝 Step 4: Contributing to phase 2...${NC}"
# Generate random contribution name for security
RANDOM_SUFFIX=$(openssl rand -hex 8)
CONTRIBUTION_NAME="Rebuild-$(date +%Y%m%d-%H%M%S)-${RANDOM_SUFFIX}"
echo "📝 Using contribution name: ${CONTRIBUTION_NAME}"

# Use --entropy flag for better randomness in development
snarkjs zkey contribute build/preimage_verifier_0000.zkey build/preimage_verifier_final.zkey --name="${CONTRIBUTION_NAME}" --entropy="$(openssl rand -hex 32)" -v

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Phase 2 contribution successful${NC}"
else
    echo -e "${RED}❌ Phase 2 contribution failed${NC}"
    exit 1
fi

echo -e "${YELLOW}🔐 Step 5: Exporting verification key...${NC}"
snarkjs zkey export verificationkey build/preimage_verifier_final.zkey build/verification_key.json

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Verification key export successful${NC}"
else
    echo -e "${RED}❌ Verification key export failed${NC}"
    exit 1
fi

echo -e "${YELLOW}📜 Step 6: Generating Solidity verifier contract...${NC}"
# Ensure contracts directory exists
mkdir -p contracts

snarkjs zkey export solidityverifier build/preimage_verifier_final.zkey contracts/verifiers/PreimageVerifierBase.sol

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Solidity verifier contract generated${NC}"
else
    echo -e "${RED}❌ Solidity verifier generation failed${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Step 7: Final circuit info...${NC}"
snarkjs r1cs info build/preimage_verifier.r1cs

echo -e "${GREEN}🎉 Circuit rebuild completed successfully!${NC}"
echo ""
echo "Generated files:"
echo "  - build/preimage_verifier.r1cs"
echo "  - build/preimage_verifier.wasm"
echo "  - build/preimage_verifier.sym"
echo "  - build/preimage_verifier_final.zkey"
echo "  - build/verification_key.json"
echo "  - contracts/verifiers/PreimageVerifierBase.sol"
echo "  - contracts/verifiers/PreimageVerifierExample.sol"
echo ""
echo "🚀 Ready for deployment and testing!"
echo "📝 Next steps:"
echo "  1. Deploy PreimageVerifierBase.sol as base verifier"
echo "  2. Deploy PreimageVerifierExample.sol with base verifier address"
echo "  3. Run ZK proof tests with contract verification"