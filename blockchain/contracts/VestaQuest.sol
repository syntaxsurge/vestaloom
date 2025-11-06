// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/**
 * @title VestaQuest
 * @notice Emits `QuestCompleted` events whenever a learner submits proof. The event becomes
 *         the trigger for Somnia Data Streams writers and Kwala automations.
 */
contract VestaQuest {
    event QuestCompleted(address indexed player, uint256 indexed questId, string proofUri);

    /**
     * @notice Record a quest completion. No further validation is applied on-chain so off-chain
     *         automations (e.g. attestation services, reviewers) can determine validity.
     */
    function completeQuest(uint256 questId, string calldata proofUri) external {
        emit QuestCompleted(msg.sender, questId, proofUri);
    }
}
