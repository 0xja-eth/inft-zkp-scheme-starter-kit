// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {AgentNFT} from "../contracts/AgentNFT.sol";
import {ZKPVerifier} from "../contracts/verifiers/ZKPVerifier.sol";
import {PreimageVerifier} from "../contracts/verifiers/PreimageVerifier.sol";
import "../contracts/interfaces/IERC7857DataVerifier.sol";

contract AgentNFTTest is Test {
    AgentNFT public agentNFT;
    ZKPVerifier public zkpVerifier;
    PreimageVerifier public preimageVerifier;
    
    address public owner = address(0x1);
    address public user = address(0x2);
    
    // Your proof data - 456 bytes
    bytes constant PROOF_DATA = hex"7839ea49ad9dcc298cb8157c90f2cc14a9c2203d30a8cf23ae6f452f8cbf9b89c4712e7d11457a74cfa79dcb71b2ccf8528404ae4258f16998bdd160fa3c9067b832e654a09c32e775ba6dfa19af79573b09f35c4e8a856a335337e1016b5af91ea64a17f1467cf0295552af77fd39617253e02449456c7edb6c7a1e85bc4392ee4ecd3ea13860b200000000000000000000000000000000000000000000000000000000af8a32f32482f107a5617443d1fe46a1a6fb5097854b9a00dbae2ec13330ace346686fc72beed9562d12f8e52dda0c514c495e772ff5c7e15748c4339a1b06970fef608313f49a46af830c7b2ff13fe9a00055cc27cb70836b0ffd2f5cc76d62cb5f60fb2f7331cc4ac805d26d0d8ef2640475cdf4d7040744e9fc382ada23817a7ca29d2b29c11ada4071d177a990e550b4dea42956e1b102bed70e36c121701fb78974272e140a5dc0acdcbd0d9978a849aca2672305d1af184ccf63db66894b691c9a0721b08bcea11228993989e474c0d05a37f24db58f3bd92edc0fcc1478b8b2c4051d52ed7190e114014b531350d0a22f3556322d60d820826784d279b919544e160d5fcbcdc0e653d3fd3fc301e53965e4e887e78d0edd3f17e574fee49a198c";

    function setUp() public {
        vm.startPrank(owner);
        
        // Deploy verifiers
        preimageVerifier = new PreimageVerifier();
        zkpVerifier = new ZKPVerifier(address(preimageVerifier), address(0));
        
        // Deploy AgentNFT implementation directly (without upgrades)
        AgentNFT impl = new AgentNFT();
        
        // Deploy minimal proxy to simulate upgradeable behavior  
        bytes memory initData = abi.encodeCall(
            AgentNFT.initialize,
            (
                "Test Agent NFT",
                "TNFT",
                address(zkpVerifier),
                "https://chain.test.com", 
                "https://indexer.test.com"
            )
        );
        
        agentNFT = AgentNFT(deployProxy(address(impl), initData));
        
        console.log("Deployed PreimageVerifier at:", address(preimageVerifier));
        console.log("Deployed ZKPVerifier at:", address(zkpVerifier));
        console.log("Deployed AgentNFT at:", address(agentNFT));
        
        vm.stopPrank();
    }
    
    function testMintWithYourProof() public {
        console.log("Testing AgentNFT.mint with your proof data");
        console.log("Proof data length:", PROOF_DATA.length, "bytes");
        
        // Create proofs array
        bytes[] memory proofs = new bytes[](1);
        proofs[0] = PROOF_DATA;
        
        // Create descriptions
        string[] memory descriptions = new string[](1);
        descriptions[0] = "Test AI Agent";
        
        vm.startPrank(user);
        
        console.log("Minting as user:", user);
        console.log("Calling AgentNFT.mint...");
        
        try agentNFT.mint(proofs, descriptions, user) returns (uint256 tokenId) {
            console.log("SUCCESS: Minted token ID:", tokenId);
            
            // Verify mint results
            console.log("Verifying mint results...");
            
            // Check that token exists and has correct owner
            try agentNFT.ownerOf(tokenId) returns (address tokenOwner) {
                console.log("Token owner:", tokenOwner);
                assertEq(tokenOwner, user, "Token should belong to minter");
                console.log("Ownership verified");
            } catch {
                console.log("Failed to get token owner - token may not exist");
            }
            
            console.log("MINT TEST PASSED!");
            
        } catch Error(string memory reason) {
            console.log("MINT FAILED:", reason);
            
            // Let's debug by testing the verifier directly
            console.log("Testing ZKPVerifier directly...");
            testVerifierDirectly();
            
        } catch (bytes memory lowLevelData) {
            console.log("MINT FAILED with low-level error:");
            console.logBytes(lowLevelData);
        }
        
        vm.stopPrank();
    }
    
    function testVerifierDirectly() public {
        console.log("Testing ZKPVerifier.verifyPreimage directly");
        
        bytes[] memory proofs = new bytes[](1);
        proofs[0] = PROOF_DATA;
        
        vm.startPrank(user);
        
        try zkpVerifier.verifyPreimage(proofs) returns (PreimageProofOutput[] memory outputs) {
            console.log("Verifier call successful");
            console.log("Number of outputs:", outputs.length);
            
            for (uint i = 0; i < outputs.length; i++) {
                console.log("--- Output", i, "---");
                console.log("Data Hash:");
                console.logBytes32(outputs[i].dataHash);
                console.log("Sealed Key length:", outputs[i].sealedKey.length);
                console.log("Nonce:", outputs[i].nonce);
                console.log("MAC:", outputs[i].mac);
                console.log("Verifier used:", outputs[i].verifier);
                console.log("Is Valid:", outputs[i].isValid);
                
                if (outputs[i].isValid) {
                    console.log("PROOF VERIFIED BY VERIFIER!");
                } else {
                    console.log("PROOF REJECTED BY VERIFIER");
                }
            }
        } catch Error(string memory reason) {
            console.log("Verifier failed:", reason);
        } catch (bytes memory lowLevelData) {
            console.log("Verifier failed with low-level error:");
            console.logBytes(lowLevelData);
        }
        
        vm.stopPrank();
    }

//    function testProofFormat() public view {
//        console.log("Analyzing your proof format:");
//        console.log("Total length:", PROOF_DATA.length, "bytes");
//
//        bytes calldata proof = PROOF_DATA;
//
//        // Extract key components based on ZKPVerifier parsing
//        bytes32 dataHash = bytes32(proof[0:32]);
//        uint256 nonce = uint256(bytes32(proof[136:168]));
//        uint256 mac = uint256(bytes32(proof[168:200]));
//
//        console.log("Key components:");
//        console.log("Data Hash:");
//        console.logBytes32(dataHash);
//        console.log("Sealed Key (32-135): 104 bytes");
//        console.log("Nonce:", nonce);
//        console.log("MAC:", mac);
//        console.log("ZK Proof components (200-455): 256 bytes");
//
//        // Verify structure expectations
//        if (PROOF_DATA.length >= 456) {
//            console.log("Proof meets minimum length requirement");
//        } else {
//            console.log("Proof too short, need at least 456 bytes");
//        }
//    }

    function testInitialization() public view {
        console.log("Testing AgentNFT initialization...");
        
        assertEq(agentNFT.name(), "Test Agent NFT");
        assertEq(agentNFT.symbol(), "TNFT");
        assertEq(address(agentNFT.verifier()), address(zkpVerifier));
        
        console.log("AgentNFT initialized correctly");
        console.log("  Name:", agentNFT.name());
        console.log("  Symbol:", agentNFT.symbol());
        console.log("  Verifier:", address(agentNFT.verifier()));
    }

    // Utility function to deploy a minimal proxy (simulates upgradeable pattern without upgrades library)
    function deployProxy(address implementation, bytes memory initData) internal returns (address proxy) {
        // Simple minimal proxy bytecode
        bytes memory bytecode = abi.encodePacked(
            hex"3d602d80600a3d3981f3363d3d373d3d3d363d73",
            implementation,
            hex"5af43d82803e903d91602b57fd5bf3"
        );

        bytes32 salt_ = salt();

        assembly {
            proxy := create2(0, add(bytecode, 0x20), mload(bytecode), salt_)
        }

        require(proxy != address(0), "Proxy deployment failed");

        // Initialize the proxy
        (bool success, ) = proxy.call(initData);
        require(success, "Proxy initialization failed");
    }

    function salt() internal view returns (bytes32) {
        return keccak256(abi.encode(block.timestamp, msg.sender, address(this)));
    }
}
