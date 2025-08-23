// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControlEnumerableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/extensions/AccessControlEnumerableUpgradeable.sol";
import {IERC7857} from "./interfaces/IERC7857.sol";
import {IERC7857Metadata} from "./interfaces/IERC7857Metadata.sol";
import {IERC7857DataVerifier, PreimageProofOutput, TransferValidityProofOutput} from "./interfaces/IERC7857DataVerifier.sol";
import {Utils} from "./Utils.sol";

contract AgentNFT is 
    AccessControlEnumerableUpgradeable,
    IERC7857, 
    IERC7857Metadata 
{
    /// @custom:storage-location erc7201:agent.storage.AgentNFT
    struct AgentNFTStorage {
        // Token data
        mapping(uint256 => TokenData) tokens;
        uint256 nextTokenId;
        
        // Contract metadata
        string name;
        string symbol;
        string chainURL;
        string indexerURL;
        
        // Core components
        IERC7857DataVerifier verifier;
    }

    struct TokenData {
        address owner;
        string[] dataDescriptions;
        bytes32[] dataHashes;
        bytes16[] sealedKeys;
        address[] authorizedUsers;
    }

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    // keccak256(abi.encode(uint(keccak256("agent.storage.AgentNFT")) - 1)) & ~bytes32(uint(0xff))
    bytes32 private constant AGENT_NFT_STORAGE_LOCATION = 
        0x4aa80aaafbe0e5fe3fe1aa97f3c1f8c65d61f96ef1aab2b448154f4e07594600;

    function _getAgentStorage() private pure returns (AgentNFTStorage storage $) {
        assembly {
            $.slot := AGENT_NFT_STORAGE_LOCATION
        }
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory name_,
        string memory symbol_,
        address verifierAddr,
        string memory chainURL_,
        string memory indexerURL_
    ) external initializer {
        require(verifierAddr != address(0), "Zero address");
        
        __AccessControlEnumerable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        
        AgentNFTStorage storage $ = _getAgentStorage();
        $.name = name_;
        $.symbol = symbol_;
        $.chainURL = chainURL_;
        $.indexerURL = indexerURL_;
        $.verifier = IERC7857DataVerifier(verifierAddr);
    }

    // Basic getters
    function name() external view returns (string memory) {
        return _getAgentStorage().name;
    }

    function symbol() external view returns (string memory) {
        return _getAgentStorage().symbol;
    }

    function verifier() external view returns (IERC7857DataVerifier) {
        return _getAgentStorage().verifier;
    }

    // Admin functions
    function updateVerifier(address newVerifier) external onlyRole(ADMIN_ROLE) {
        require(newVerifier != address(0), "Zero address");
        _getAgentStorage().verifier = IERC7857DataVerifier(newVerifier);
    }

    function updateURLS(string memory newChainURL, string memory newIndexerURL) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        AgentNFTStorage storage $ = _getAgentStorage();
        $.chainURL = newChainURL;
        $.indexerURL = newIndexerURL;
    }

    function update(uint256 tokenId, bytes[] calldata proofs) external {
        AgentNFTStorage storage $ = _getAgentStorage();
        TokenData storage token = $.tokens[tokenId];
        require(token.owner == msg.sender, "Not owner");

        PreimageProofOutput[] memory proofOupt = $.verifier.verifyPreimage(proofs);
        bytes32[] memory newDataHashes = new bytes32[](proofOupt.length);

        for (uint i = 0; i < proofOupt.length; i++) {
            require(
                proofOupt[i].isValid,
                string(
                    abi.encodePacked(
                        "Invalid preimage proof at index ",
                        i,
                        " with data hash ",
                        proofOupt[i].dataHash
                    )
                )
            );
            newDataHashes[i] = proofOupt[i].dataHash;
        }

        bytes32[] memory oldDataHashes = token.dataHashes;
        token.dataHashes = newDataHashes;

        emit Updated(tokenId, oldDataHashes, newDataHashes);
    }

    function mint(
        bytes[] calldata proofs,
        string[] calldata dataDescriptions,
        address to
    ) external payable returns (uint256 tokenId) {
        AgentNFTStorage storage $ = _getAgentStorage();
        
        require(
            dataDescriptions.length == proofs.length,
            "Descriptions and proofs length mismatch"
        );
        
        if (to == address(0)) {
            to = msg.sender;
        }

        PreimageProofOutput[] memory proofOupt = $.verifier.verifyPreimage(proofs);

        bytes32[] memory dataHashes = new bytes32[](proofOupt.length);
        bytes16[] memory sealedKeys = new bytes16[](proofOupt.length);

        for (uint i = 0; i < proofOupt.length; i++) {
            require(
                proofOupt[i].isValid,
                string(
                    abi.encodePacked(
                        "Invalid preimage proof at index ",
                        i,
                        " with data hash ",
                        proofOupt[i].dataHash
                    )
                )
            );
            dataHashes[i] = proofOupt[i].dataHash;
            sealedKeys[i] = proofOupt[i].sealedKey;
        }

        tokenId = $.nextTokenId++;
        $.tokens[tokenId] = TokenData({
            owner: to,
            dataHashes: dataHashes,
            sealedKeys: sealedKeys,
            dataDescriptions: dataDescriptions,
            authorizedUsers: new address[](0)
        });

        emit Minted(tokenId, msg.sender, to, dataHashes, dataDescriptions);
        emit PublishedSealedKey(to, tokenId, sealedKeys);
    }

    function transfer(
        address to,
        uint256 tokenId,
        bytes[] calldata proofs
    ) external {
        AgentNFTStorage storage $ = _getAgentStorage();
        require(to != address(0), "Zero address");
        require($.tokens[tokenId].owner == msg.sender, "Not owner");
    
        TransferValidityProofOutput[] memory proofOupt = $.verifier
            .verifyTransferValidity(proofs);
        bytes16[] memory newSealedKeys = new bytes16[](proofOupt.length);
        bytes32[] memory newDataHashes = new bytes32[](proofOupt.length);

        for (uint i = 0; i < proofOupt.length; i++) {
            require(
                proofOupt[i].isValid &&
                proofOupt[i].oldDataHash == $.tokens[tokenId].dataHashes[i] &&
                Utils.pubKeyToAddress(proofOupt[i].pubKey) == to,
                string(
                    abi.encodePacked(
                        "Invalid transfer validity proof at index ",
                        i
                    )
                )
            );
            newSealedKeys[i] = proofOupt[i].sealedKey;
            newDataHashes[i] = proofOupt[i].newDataHash;
        }

        $.tokens[tokenId].owner = to;
        $.tokens[tokenId].dataHashes = newDataHashes;
        $.tokens[tokenId].sealedKeys = newSealedKeys;

        emit Transferred(tokenId, msg.sender, to);
        emit PublishedSealedKey(to, tokenId, newSealedKeys);
    }

    function transferPublic(address to, uint256 tokenId) external {
        AgentNFTStorage storage $ = _getAgentStorage();
        require(to != address(0), "Zero address");
        require($.tokens[tokenId].owner == msg.sender, "Not owner");
        $.tokens[tokenId].owner = to;
        emit Transferred(tokenId, msg.sender, to);
    }

    function clone(
        address to,
        uint256 tokenId,
        bytes[] calldata proofs
    ) external payable returns (uint256) {
        AgentNFTStorage storage $ = _getAgentStorage();
        require(to != address(0), "Zero address");
        require($.tokens[tokenId].owner == msg.sender, "Not owner");

        TransferValidityProofOutput[] memory proofOupt = $.verifier
            .verifyTransferValidity(proofs);
        bytes32[] memory newDataHashes = new bytes32[](proofOupt.length);
        bytes16[] memory newSealedKeys = new bytes16[](proofOupt.length);
        
        for (uint i = 0; i < proofOupt.length; i++) {
            require(
                proofOupt[i].isValid &&
                proofOupt[i].oldDataHash == $.tokens[tokenId].dataHashes[i] &&
                Utils.pubKeyToAddress(proofOupt[i].pubKey) == to,
                string(
                    abi.encodePacked(
                        "Invalid transfer validity proof at index ",
                        i
                    )
                )
            );
            newSealedKeys[i] = proofOupt[i].sealedKey;
            newDataHashes[i] = proofOupt[i].newDataHash;
        }

        uint256 newTokenId = $.nextTokenId++;
        $.tokens[newTokenId] = TokenData({
            owner: to,
            dataHashes: newDataHashes,
            sealedKeys: newSealedKeys,
            dataDescriptions: $.tokens[tokenId].dataDescriptions,
            authorizedUsers: new address[](0)
        });

        emit Cloned(tokenId, newTokenId, msg.sender, to);
        emit PublishedSealedKey(to, newTokenId, newSealedKeys);
        return newTokenId;
    }

    function clonePublic(
        address to,
        uint256 tokenId
    ) external payable returns (uint256) {
        AgentNFTStorage storage $ = _getAgentStorage();
        require(to != address(0), "Zero address");
        require($.tokens[tokenId].owner == msg.sender, "Not owner");

        uint256 newTokenId = $.nextTokenId++;
        $.tokens[newTokenId] = TokenData({
            owner: to,
            dataHashes: $.tokens[tokenId].dataHashes,
            sealedKeys: $.tokens[tokenId].sealedKeys,
            dataDescriptions: $.tokens[tokenId].dataDescriptions,
            authorizedUsers: new address[](0)
        });
        emit Cloned(tokenId, newTokenId, msg.sender, to);
        return newTokenId;
    }

    function authorizeUsage(uint256 tokenId, address user) external {
        AgentNFTStorage storage $ = _getAgentStorage();
        require($.tokens[tokenId].owner == msg.sender, "Not owner");
        $.tokens[tokenId].authorizedUsers.push(user);
        emit AuthorizedUsage(tokenId, user);
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        AgentNFTStorage storage $ = _getAgentStorage();
        TokenData storage token = $.tokens[tokenId];
        require(token.owner != address(0), "Token not exist");
        return token.owner;
    }

    function authorizedUsersOf(uint256 tokenId) external view returns (address[] memory) {
        AgentNFTStorage storage $ = _getAgentStorage();
        TokenData storage token = $.tokens[tokenId];
        require(token.owner != address(0), "Token not exist");
        return token.authorizedUsers;
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        AgentNFTStorage storage $ = _getAgentStorage();
        require(_exists(tokenId), "Token does not exist");

        return string(
            abi.encodePacked(
                '{"chainURL":"',
                $.chainURL,
                '","indexerURL":"',
                $.indexerURL,
                '"}'
            )
        );
    }

    function _exists(uint256 tokenId) internal view returns (bool) {
        return _getAgentStorage().tokens[tokenId].owner != address(0);
    }

    function dataHashesOf(uint256 tokenId) public view returns (bytes32[] memory) {
        AgentNFTStorage storage $ = _getAgentStorage();
        TokenData storage token = $.tokens[tokenId];
        require(token.owner != address(0), "Token not exist");
        return token.dataHashes;
    }

    function sealedKeysOf(uint256 tokenId) public view returns (bytes16[] memory) {
        AgentNFTStorage storage $ = _getAgentStorage();
        TokenData storage token = $.tokens[tokenId];
        require(token.owner != address(0), "Token not exist");
        return token.sealedKeys;
    }

    function dataDescriptionsOf(uint256 tokenId) public view returns (string[] memory) {
        AgentNFTStorage storage $ = _getAgentStorage();
        TokenData storage token = $.tokens[tokenId];
        require(token.owner != address(0), "Token not exist");
        return token.dataDescriptions;
    }

    string public constant VERSION = "1.0.0";
}