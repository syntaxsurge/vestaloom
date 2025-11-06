// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title VestaBadge
 * @notice Minimal ERC721 used by Vestaloom automations to issue verifiable credentials.
 *         Ownership is restricted to the deployer so external automation (Kwala) can mint
 *         on behalf of the protocol without exposing administrative keys.
 */
contract VestaBadge is ERC721, Ownable {
    uint256 private _nextTokenId;

    constructor(address initialOwner) ERC721("Vestaloom Badge", "VESTA") Ownable(initialOwner) {}

    /**
     * @notice Mint a new badge to `recipient`.
     * @dev Only callable by the contract owner (Kwala automation signer).
     */
    function mintBadge(address recipient) external onlyOwner returns (uint256 tokenId) {
        tokenId = ++_nextTokenId;
        _safeMint(recipient, tokenId);
    }
}
