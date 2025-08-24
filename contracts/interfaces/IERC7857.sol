// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import "./IERC7857DataVerifier.sol";

interface IERC7857 {
    /// @dev This emits when a new functional NFT is minted
    event Minted(
        uint256 indexed _tokenId,
        address indexed _creator,
        address indexed _owner,
        bytes32[] _dataHashes,
        string[] _dataDescriptions
    );

    /// @dev This emits when a user is authorized to use the data
    event AuthorizedUsage(uint256 indexed _tokenId, address indexed _user);

    /// @dev This emits when data is transferred with ownership
    event Transferred(
        uint256 _tokenId,
        address indexed _from,
        address indexed _to
    );

    /// @dev This emits when data is cloned
    event Cloned(
        uint256 indexed _tokenId,
        uint256 indexed _newTokenId,
        address _from,
        address _to
    );

    /// @dev This emits when a sealed key is published
    event PublishedSealedKey(
        address indexed _to,
        uint256 indexed _tokenId,
        bytes[] _sealedKeys
    );

    /// @notice The verifier interface that this NFT uses
    /// @return The address of the verifier contract
    function verifier() external view returns (IERC7857DataVerifier);

    /// @notice Mint new functional NFT with functional data ownership proof
    /// @param _proofs Proof of data ownership
    /// @param _dataDescriptions Descriptions of the data
    /// @return _tokenId The ID of the newly minted token
    /// @param _to The address to mint the token for, if _to is not set, the token will be minted for the caller
    function mint(
        bytes[] calldata _proofs,
        string[] calldata _dataDescriptions,
        address _to
    ) external payable returns (uint256 _tokenId);

    /// @notice Transfer data with ownership
    /// @param _to Address to transfer data to
    /// @param _tokenId The token to transfer data for
    /// @param _proofs Proofs of data available for _to
    function transfer(
        address _to,
        uint256 _tokenId,
        bytes[] calldata _proofs
    ) external;

    /// @notice Clone data
    /// @param _to Address to clone data to
    /// @param _tokenId The token to clone data for
    /// @param _proofs Proofs of data available for _to
    /// @return _newTokenId The ID of the newly cloned token
    function clone(
        address _to,
        uint256 _tokenId,
        bytes[] calldata _proofs
    ) external payable returns (uint256 _newTokenId);

    /// @notice Transfer public data with ownership
    /// @param _to Address to transfer data to
    /// @param _tokenId The token to transfer data for
    function transferPublic(address _to, uint256 _tokenId) external;

    /// @notice Clone public data
    /// @param _to Address to clone data to
    /// @param _tokenId The token to clone data for
    /// @return _newTokenId The ID of the newly cloned token
    function clonePublic(
        address _to,
        uint256 _tokenId
    ) external payable returns (uint256 _newTokenId);

    /// @notice Add authorized user to group
    /// @param _tokenId The token to add to group
    function authorizeUsage(uint256 _tokenId, address _user) external;

    /// @notice Get token owner
    /// @param _tokenId The token identifier
    /// @return The current owner of the token
    function ownerOf(uint256 _tokenId) external view returns (address);

    /// @notice Get the authorized users of a token
    /// @param _tokenId The token identifier
    /// @return The current authorized users of the token
    function authorizedUsersOf(
        uint256 _tokenId
    ) external view returns (address[] memory);
}
