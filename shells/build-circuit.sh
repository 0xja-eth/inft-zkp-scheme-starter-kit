#!/bin/bash

# Rebuild circuits after modifications
# This script recompiles circuit and regenerates all necessary files
# Usage: ./build-circuit.sh [circuit_name]
# Examples: 
#   ./build-circuit.sh preimage_verifier
#   ./build-circuit.sh dual_key_verifier
#   ./build-circuit.sh (defaults to preimage_verifier)

set -e  # Exit on any error

# Default circuit name
CIRCUIT_NAME="${1:-preimage_verifier}"

echo "🔄 Rebuilding ${CIRCUIT_NAME} circuit..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if required files exist
if [ ! -f "circuits/${CIRCUIT_NAME}.circom" ]; then
    echo -e "${RED}❌ Circuit file not found: circuits/${CIRCUIT_NAME}.circom${NC}"
    exit 1
fi

# Determine required Powers of Tau file based on circuit
case "$CIRCUIT_NAME" in
    "dual_key_verifier")
        PTAU_FILE="powersOfTau28_hez_final_19.ptau"
        PTAU_CONSTRAINTS="19"
        ;;
    "dual_key_verifier_minimal")
        PTAU_FILE="powersOfTau28_hez_final_19.ptau"
        PTAU_CONSTRAINTS="16"
        ;;
    "preimage_verifier_minimal")
        PTAU_FILE="powersOfTau28_hez_final_18.ptau"
        PTAU_CONSTRAINTS="16"
        ;;
    *)
        PTAU_FILE="powersOfTau28_hez_final_18.ptau"
        PTAU_CONSTRAINTS="18"
        ;;
esac

if [ ! -f "zkproof/${PTAU_FILE}" ]; then
    echo -e "${YELLOW}⚠️  Powers of Tau file not found: zkproof/${PTAU_FILE}${NC}"
    echo -e "${YELLOW}📥 Downloading from Google Storage (trusted source)...${NC}"
    
    # Create zkproof directory if it doesn't exist
    mkdir -p zkproof
    
    # Download Powers of Tau file from Google Storage (trusted source)
    # This is the final file from the Powers of Tau ceremony, which supports up to 2^${PTAU_CONSTRAINTS} constraints
    echo "🔗 Downloading ${PTAU_FILE} (~$([ "$PTAU_CONSTRAINTS" = "19" ] && echo "600MB" || echo "300MB"))..."
    
    # Google Storage direct download link 
    DOWNLOAD_URL="https://storage.googleapis.com/zkevm/ptau/${PTAU_FILE}"
    
    # Use curl to download with progress bar
    if command -v curl >/dev/null 2>&1; then
        echo "Using curl to download..."
        if curl -L -o "zkproof/${PTAU_FILE}" "${DOWNLOAD_URL}" --progress-bar; then
            echo -e "${GREEN}✅ Download completed${NC}"
        else
            echo -e "${RED}❌ Download failed${NC}"
            rm -f "zkproof/${PTAU_FILE}"
            exit 1
        fi
    elif command -v wget >/dev/null 2>&1; then
        echo "Using wget to download..."
        if wget -O "zkproof/${PTAU_FILE}" "${DOWNLOAD_URL}" --progress=bar; then
            echo -e "${GREEN}✅ Download completed${NC}"
        else
            echo -e "${RED}❌ Download failed${NC}"
            rm -f "zkproof/${PTAU_FILE}"
            exit 1
        fi
    else
        echo -e "${RED}❌ Neither curl nor wget found. Please install one of them or manually download the file.${NC}"
        echo "Download URL: ${DOWNLOAD_URL}"
        echo "Save to: zkproof/${PTAU_FILE}"
        exit 1
    fi
    
    # Verify the download was successful
    if [ ! -f "zkproof/${PTAU_FILE}" ] || [ ! -s "zkproof/${PTAU_FILE}" ]; then
        echo -e "${RED}❌ Failed to download Powers of Tau file${NC}"
        echo -e "${RED}   Please manually download from: ${DOWNLOAD_URL}${NC}"
        echo -e "${RED}   Save as: zkproof/${PTAU_FILE}${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Powers of Tau file downloaded successfully${NC}"
    file_size=$(stat -f%z "zkproof/${PTAU_FILE}" 2>/dev/null || echo "unknown")
    echo -e "${GREEN}   File size: $file_size bytes${NC}"
fi

# Create build directory if it doesn't exist
mkdir -p build

echo -e "${YELLOW}📝 Step 1: Compiling circuit...${NC}"
if circom "circuits/${CIRCUIT_NAME}.circom" --r1cs --wasm --sym -o build; then
    echo -e "${GREEN}✅ Circuit compilation successful${NC}"
else
    echo -e "${RED}❌ Circuit compilation failed${NC}"
    exit 1
fi

echo -e "${YELLOW}📊 Step 2: Checking circuit info...${NC}"
snarkjs r1cs info "build/${CIRCUIT_NAME}.r1cs"

echo -e "${YELLOW}🔑 Step 3: Generating zkey (phase 1)...${NC}"
if snarkjs groth16 setup "build/${CIRCUIT_NAME}.r1cs" "zkproof/${PTAU_FILE}" "build/${CIRCUIT_NAME}_0000.zkey"; then
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
if snarkjs zkey contribute "build/${CIRCUIT_NAME}_0000.zkey" "build/${CIRCUIT_NAME}_final.zkey" --name="${CONTRIBUTION_NAME}" --entropy="$(openssl rand -hex 32)" -v; then
    echo -e "${GREEN}✅ Phase 2 contribution successful${NC}"
else
    echo -e "${RED}❌ Phase 2 contribution failed${NC}"
    exit 1
fi

echo -e "${YELLOW}🔐 Step 5: Exporting verification key...${NC}"
if snarkjs zkey export verificationkey "build/${CIRCUIT_NAME}_final.zkey" "build/${CIRCUIT_NAME}_verification_key.json"; then
    echo -e "${GREEN}✅ Verification key export successful${NC}"
else
    echo -e "${RED}❌ Verification key export failed${NC}"
    exit 1
fi

echo -e "${YELLOW}📜 Step 6: Generating Solidity verifier contract...${NC}"
# Ensure contracts directory exists
mkdir -p contracts/verifiers

# Generate contract name based on circuit
case "$CIRCUIT_NAME" in
    "preimage_verifier")
        CONTRACT_NAME="PreimageVerifier"
        ;;
    "preimage_verifier_minimal")
        CONTRACT_NAME="PreimageVerifierMinimal"
        ;;
    "dual_key_verifier")
        CONTRACT_NAME="DualKeyVerifier"
        ;;
    "dual_key_verifier_minimal")
        CONTRACT_NAME="DualKeyVerifierMinimal"
        ;;
    *)
        # Default: convert snake_case to PascalCase and add Verifier
        CONTRACT_NAME="$(echo ${CIRCUIT_NAME} | sed 's/_/ /g' | sed 's/\b\w/\U&/g' | sed 's/ //g')Verifier"
        ;;
esac

if snarkjs zkey export solidityverifier "build/${CIRCUIT_NAME}_final.zkey" "contracts/verifiers/${CONTRACT_NAME}.sol"; then
    echo -e "${GREEN}✅ Solidity verifier contract generated${NC}"
    
    # Replace contract name from Groth16Verifier to circuit-specific name
    echo -e "${YELLOW}🔄 Updating contract name to ${CONTRACT_NAME}...${NC}"
    if sed -i '' "s/contract Groth16Verifier/contract ${CONTRACT_NAME}/g" "contracts/verifiers/${CONTRACT_NAME}.sol"; then
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
snarkjs r1cs info "build/${CIRCUIT_NAME}.r1cs"

echo -e "${GREEN}🎉 Circuit rebuild completed successfully!${NC}"
echo ""
echo "Generated files:"
echo "  - build/${CIRCUIT_NAME}.r1cs"
echo "  - build/${CIRCUIT_NAME}.wasm"
echo "  - build/${CIRCUIT_NAME}.sym"
echo "  - build/${CIRCUIT_NAME}_final.zkey"
echo "  - build/${CIRCUIT_NAME}_verification_key.json"
echo "  - contracts/verifiers/${CONTRACT_NAME}.sol"
echo ""
echo "🚀 Ready for deployment and testing!"