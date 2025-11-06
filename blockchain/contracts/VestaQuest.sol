// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title VestaQuest
 * @notice Emits `QuestCompleted` events whenever a learner submits proof. The on-chain mapping
 *         prevents duplicate submissions per quest so downstream automations stay idempotent.
 */
contract VestaQuest {
    event QuestCompleted(address indexed player, uint256 indexed questId, string proofUri);

    mapping(address => mapping(uint256 => bool)) public completed;

    /**
     * @notice Record a quest completion for the caller and emit the automation trigger.
     */
    function completeQuest(uint256 questId, string calldata proofUri) external {
        require(!completed[msg.sender][questId], "Already completed");

        completed[msg.sender][questId] = true;
        emit QuestCompleted(msg.sender, questId, proofUri);
    }
}
