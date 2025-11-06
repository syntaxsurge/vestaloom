// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title Badge1155
 * @notice Soulbound completion badges for Vestaloom learners.
 */
contract Badge1155 is ERC1155, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    event BadgeMinted(address indexed to, uint256 indexed courseId);

    constructor(string memory uri, address admin) ERC1155(uri) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
    }

    function mintCompletion(address to, uint256 courseId) external onlyRole(MINTER_ROLE) {
        _mint(to, courseId, 1, "");
        emit BadgeMinted(to, courseId);
    }

    function mintBatch(address[] calldata recipients, uint256 courseId) external onlyRole(MINTER_ROLE) {
        for (uint256 i = 0; i < recipients.length; i++) {
            _mint(recipients[i], courseId, 1, "");
            emit BadgeMinted(recipients[i], courseId);
        }
    }

    function setURI(string memory newURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setURI(newURI);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function setApprovalForAll(address, bool) public pure override(ERC1155) {
        revert("Badge approvals disabled");
    }

    function safeTransferFrom(address, address, uint256, uint256, bytes memory)
        public
        pure
        override(ERC1155)
    {
        revert("Badge non-transferable");
    }

    function safeBatchTransferFrom(address, address, uint256[] memory, uint256[] memory, bytes memory)
        public
        pure
        override(ERC1155)
    {
        revert("Badge non-transferable");
    }

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override(ERC1155) {
        if (from != address(0) && to != address(0)) {
            revert("Badge is non-transferable");
        }
        super._update(from, to, ids, values);
    }
}
