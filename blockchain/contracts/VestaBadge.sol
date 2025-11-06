// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title VestaBadge
 * @notice Soulbound ERC-721 used by Vestaloom automations to issue verifiable credentials.
 *         Minting is restricted to accounts with `MINTER_ROLE` so external automation can
 *         issue badges without holding admin keys.
 */
contract VestaBadge is ERC721, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 public nextId;
    mapping(address => mapping(uint256 => bool)) public badgeMintedForQuest;

    event BadgeMinted(address indexed player, uint256 indexed tokenId, uint256 questId);

    constructor(address admin) ERC721("VestaBadge", "VBADGE") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
    }

    /**
     * @notice Mint a new quest badge and prevent duplicates for the same (player, quest) pair.
     */
    function mintBadge(address to, uint256 questId) external onlyRole(MINTER_ROLE) returns (uint256 tokenId) {
        require(!badgeMintedForQuest[to][questId], "Badge already minted");

        tokenId = ++nextId;
        badgeMintedForQuest[to][questId] = true;
        _safeMint(to, tokenId);

        emit BadgeMinted(to, tokenId, questId);
    }

    /**
     * @dev Override update hook to prevent transfers, making the badge soulbound.
     */
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert("Soulbound");

        return super._update(to, tokenId, auth);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
