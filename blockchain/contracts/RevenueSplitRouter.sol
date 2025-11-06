// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title RevenueSplitRouter
 * @notice Splits ERC20 transfers across collaborators using basis points.
 * Callers must approve this contract for the amount being distributed.
 */
contract RevenueSplitRouter {
    using SafeERC20 for IERC20;

    uint32 public constant TOTAL_BPS = 10_000;

    event RevenueSplit(
        address indexed payer,
        address indexed token,
        uint256 amount,
        address[] recipients,
        uint32[] sharesBps
    );

    error InvalidRecipients();
    error InvalidShares();
    error InvalidAmount();

    /**
     * @notice Distributes `amount` of `token` across recipients according to `sharesBps`.
     * @dev Shares must sum to `TOTAL_BPS`. Any rounding remainder is allocated to the last recipient.
     */
    function splitTransfer(
        IERC20 token,
        address[] calldata recipients,
        uint32[] calldata sharesBps,
        uint256 amount
    ) external {
        if (amount == 0) revert InvalidAmount();
        if (recipients.length == 0 || recipients.length != sharesBps.length) {
            revert InvalidRecipients();
        }

        uint256 totalShares = 0;
        for (uint256 i = 0; i < sharesBps.length; i++) {
            if (recipients[i] == address(0)) revert InvalidRecipients();
            totalShares += sharesBps[i];
        }
        if (totalShares != TOTAL_BPS) revert InvalidShares();

        token.safeTransferFrom(msg.sender, address(this), amount);

        uint256 remaining = amount;
        for (uint256 i = 0; i < recipients.length; i++) {
            uint256 payout = (amount * sharesBps[i]) / TOTAL_BPS;
            if (i == recipients.length - 1) {
                payout = remaining;
            } else {
                remaining -= payout;
            }

            if (payout > 0) {
                token.safeTransfer(recipients[i], payout);
            }
        }

        emit RevenueSplit(msg.sender, address(token), amount, recipients, sharesBps);
    }
}
