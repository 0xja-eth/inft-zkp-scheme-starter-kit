// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

library Utils {
    function toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function hexToString(
        bytes memory data
    ) internal pure returns (string memory) {
        return string(abi.encodePacked(data));
    }

    function isEqual(
        bytes32[] memory arr1,
        bytes32[] memory arr2
    ) internal pure returns (bool) {
        if (arr1.length != arr2.length) {
            return false;
        }
        for (uint i = 0; i < arr1.length; i++) {
            if (arr1[i] != arr2[i]) {
                return false;
            }
        }
        return true;
    }

    function pubKeyToAddress(
        bytes memory pubKey
    ) internal pure returns (address) {
        require(pubKey.length == 64, "Invalid public key length");
        bytes32 hash = keccak256(pubKey);
        return address(uint160(uint256(hash)));
    }

    function verify(
        address signer,
        string memory message,
        bytes memory signature
    ) public pure returns (bool) {
        bytes32 messageHash = prefixedHash(message);

        require(signature.length == 65, "invalid signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }

        address recovered = ecrecover(messageHash, v, r, s);

        return (recovered == signer);
    }

    function prefixedHash(string memory message) public pure returns (bytes32) {
        return keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n", uint2str(bytes(message).length), message)
        );
    }

    function uint2str(uint _i) internal pure returns (string memory _uintAsString) {
        if (_i == 0) return "0";
        uint j = _i;
        uint len;
        while (j != 0) { len++; j /= 10; }
        bytes memory bstr = new bytes(len);
        uint k = len;
        while (_i != 0) { bstr[--k] = bytes1(uint8(48 + _i % 10)); _i /= 10; }
        return string(bstr);
    }
}
