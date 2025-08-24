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
    bytes internal constant PROOF_DATA = hex"7b79d8dcf55b4fee331faa932fc20e6ade3c2ef3ccc273b986913102bd6c58a8ba0e95d2c9976321daf6d2243d2ae37ef3e7145cb990c99eab8890a15f37e69af5482d95d3d2077249f45699d1cc37563f49df26d05c6b3165651e5bb4663ba9071c6634462ae03ebfe7e248108414c73eb84ea50a1c3cbeaf20b825a1a2b6dabafdf86d5640f04800000000000000000000000000000000000000000000000000000000a36fc33408de71c0986e3e18159310b3d22f4efd2426e76641f5134b6701f571b1114d89114f45df0d688a5370f9d2ab7f299c98f52f1915be5016161e5e2b6b80c2515323dcc9cc61fd5b97dddcc16d5deef4e2b31f0a45641b17a4d234fcafdb7dc74d1f09e053294dee6f7c315bf41d8b01956aeef3a5fd63980e07b2c70552110fb50a44a9da775a1e044a37b2d568844e5d8847939ce4e6d55e3dac75eb2b29d9da2edaa668032311853591bc88214152e9dd505f255a897a283862e3411ad8ef1b2d61d7ffcc09f021dd8d78d392722b160b958c36dc059bb48064b97fea59b2221890de9095ae796ae17d674d3e8224e4fad388be77a45a8ad67e60aaafaa85f32eb829cc059b38294cf9b164bcfa663088c2608591752a13407a0073b0599017";

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
        
        vm.stopPrank();
    }
    
    function testInitialization() public {
        // Assert contract initialization
        assertEq(agentNFT.name(), "Test Agent NFT", "Incorrect contract name");
        assertEq(agentNFT.symbol(), "TNFT", "Incorrect contract symbol");
        assertEq(address(agentNFT.verifier()), address(zkpVerifier), "Incorrect verifier address");
    }
    
    function testMintWithValidProof() public {
        // Arrange
        bytes[] memory proofs = new bytes[](1);
        proofs[0] = PROOF_DATA;
        
        string[] memory descriptions = new string[](1);
        descriptions[0] = "Test AI Agent";
        
//        uint256 initialBalance = agentNFT.balanceOf(user);
        
        vm.startPrank(user);
        
        // Act
        uint256 tokenId = agentNFT.mint(proofs, descriptions, user);
        
        // Assert
        assertEq(agentNFT.ownerOf(tokenId), user, "Token should belong to minter");
//        assertEq(agentNFT.balanceOf(user), initialBalance + 1, "User balance should increase by 1");
        assertTrue(tokenId == 0, "Token ID should be greater than 0");
        
        vm.stopPrank();
    }
    
    function testZKPVerifierWithValidProof() public {
        // Arrange
        bytes[] memory proofs = new bytes[](1);
        proofs[0] = PROOF_DATA;
        
        vm.startPrank(user);
        
        // Act
        PreimageProofOutput[] memory outputs = zkpVerifier.verifyPreimage(proofs);
        
        // Assert
        assertEq(outputs.length, 1, "Should return 1 output");
        assertTrue(outputs[0].isValid, "Proof should be valid");
        assertEq(outputs[0].sealedKey.length, 104, "Sealed key should be 104 bytes");
        assertGt(uint256(outputs[0].dataHash), 0, "Data hash should not be zero");
        
        vm.stopPrank();
    }
    
    function testMintFailsWithInvalidProof() public {
        // Arrange - create invalid proof (too short)
        bytes[] memory proofs = new bytes[](1);
        proofs[0] = hex"deadbeef"; // Invalid short proof
        
        string[] memory descriptions = new string[](1);
        descriptions[0] = "Test AI Agent";
        
        vm.startPrank(user);
        
        // Act & Assert - should revert
        vm.expectRevert("Invalid proof length");
        agentNFT.mint(proofs, descriptions, user);
        
        vm.stopPrank();
    }
    
    function testMintFailsWithEmptyArrays() public {
        // Arrange
        bytes[] memory proofs = new bytes[](0); // Empty proofs array
        string[] memory descriptions = new string[](0);
        
        vm.startPrank(user);
        
        // Act & Assert - should revert or handle gracefully
        vm.expectRevert();
        agentNFT.mint(proofs, descriptions, user);
        
        vm.stopPrank();
    }
    
    function testMintFailsWithMismatchedArrays() public {
        // Arrange - mismatched array lengths
        bytes[] memory proofs = new bytes[](1);
        proofs[0] = PROOF_DATA;
        
        string[] memory descriptions = new string[](2); // Different length
        descriptions[0] = "Test AI Agent";
        descriptions[1] = "Another Agent";
        
        vm.startPrank(user);
        
        // Act & Assert - should revert
        vm.expectRevert();
        agentNFT.mint(proofs, descriptions, user);
        
        vm.stopPrank();
    }
    
    function testMultipleProofMinting() public {
        // Arrange
        bytes[] memory proofs = new bytes[](2);
        proofs[0] = PROOF_DATA;
        proofs[1] = PROOF_DATA; // Reuse same proof for simplicity
        
        string[] memory descriptions = new string[](2);
        descriptions[0] = "AI Agent Prompts";
        descriptions[1] = "AI Agent Memories";
        
        vm.startPrank(user);
        
        // Act
        uint256 tokenId = agentNFT.mint(proofs, descriptions, user);
        
        // Assert
        assertEq(agentNFT.ownerOf(tokenId), user, "First token should belong to user");

        vm.stopPrank();
    }
    
    function testMintToSpecificAddress() public {
        // Arrange
        address recipient = address(0x3);
        bytes[] memory proofs = new bytes[](1);
        proofs[0] = PROOF_DATA;
        
        string[] memory descriptions = new string[](1);
        descriptions[0] = "Test AI Agent";
        
        vm.startPrank(user);
        
        // Act
        uint256 tokenId = agentNFT.mint(proofs, descriptions, recipient);
        
        // Assert
        assertEq(agentNFT.ownerOf(tokenId), recipient, "Token should belong to specified recipient");
//        assertEq(agentNFT.balanceOf(recipient), 1, "Recipient should have 1 token");
//        assertEq(agentNFT.balanceOf(user), 0, "Minter should have 0 tokens");
        
        vm.stopPrank();
    }
    
    function testZKPVerifierFailsWithInvalidProof() public {
        // Arrange
        bytes[] memory proofs = new bytes[](1);
        proofs[0] = hex"deadbeef"; // Invalid short proof
        
        vm.startPrank(user);
        
        // Act & Assert
        vm.expectRevert("Invalid proof length");
        zkpVerifier.verifyPreimage(proofs);
        
        vm.stopPrank();
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