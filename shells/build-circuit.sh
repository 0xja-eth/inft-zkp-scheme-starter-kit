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
    echo -e "${YELLOW}⚠️  Powers of Tau file not found: zkproof/powersOfTau28_hez_final_18.ptau${NC}"
    echo -e "${YELLOW}📥 Downloading from Google Storage (trusted source)...${NC}"
    
    # Create zkproof directory if it doesn't exist
    mkdir -p zkproof
    
    # Download Powers of Tau file from Google Storage (trusted source)
    # This is the final file from the Powers of Tau ceremony, which supports up to 2^18 constraints
    echo "🔗 Downloading powersOfTau28_hez_final_18.ptau (~300MB)..."
    
    # Google Storage direct download link 
    DOWNLOAD_URL="https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_18.ptau"
    
    # Use curl to download with progress bar
    if command -v curl >/dev/null 2>&1; then
        echo "Using curl to download..."
        if curl -L -o zkproof/powersOfTau28_hez_final_18.ptau "${DOWNLOAD_URL}" --progress-bar; then
            echo -e "${GREEN}✅ Download completed${NC}"
        else
            echo -e "${RED}❌ Download failed${NC}"
            rm -f zkproof/powersOfTau28_hez_final_18.ptau
            exit 1
        fi
    elif command -v wget >/dev/null 2>&1; then
        echo "Using wget to download..."
        if wget -O zkproof/powersOfTau28_hez_final_18.ptau "${DOWNLOAD_URL}" --progress=bar; then
            echo -e "${GREEN}✅ Download completed${NC}"
        else
            echo -e "${RED}❌ Download failed${NC}"
            rm -f zkproof/powersOfTau28_hez_final_18.ptau
            exit 1
        fi
    else
        echo -e "${RED}❌ Neither curl nor wget found. Please install one of them or manually download the file.${NC}"
        echo "Download URL: ${DOWNLOAD_URL}"
        echo "Save to: zkproof/powersOfTau28_hez_final_18.ptau"
        exit 1
    fi
    
    # Verify the download was successful
    if [ ! -f "zkproof/powersOfTau28_hez_final_18.ptau" ] || [ ! -s "zkproof/powersOfTau28_hez_final_18.ptau" ]; then
        echo -e "${RED}❌ Failed to download Powers of Tau file${NC}"
        echo -e "${RED}   Please manually download from: ${DOWNLOAD_URL}${NC}"
        echo -e "${RED}   Save as: zkproof/powersOfTau28_hez_final_18.ptau${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Powers of Tau file downloaded successfully${NC}"
    echo -e "${GREEN}   File size: $file_size bytes${NC}"
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

snarkjs zkey export solidityverifier build/preimage_verifier_final.zkey contracts/verifiers/PreimageVerifier.sol

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Solidity verifier contract generated${NC}"
    
    # Replace contract name from Groth16Verifier to PreimageVerifier
    echo -e "${YELLOW}🔄 Updating contract name to PreimageVerifier...${NC}"
    if sed -i '' 's/contract Groth16Verifier/contract PreimageVerifier/g' contracts/verifiers/PreimageVerifier.sol; then
        echo -e "${GREEN}✅ Contract name updated successfully${NC}"
    else
        echo -e "${RED}❌ Failed to update contract name${NC}"
        exit 1
    fi
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
echo "  - contracts/verifiers/PreimageVerifier.sol"
echo ""
echo "🚀 Ready for deployment and testing!"