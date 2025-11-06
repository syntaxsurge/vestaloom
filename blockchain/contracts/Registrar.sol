// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SplitPayout} from "./helpers/SplitPayout.sol";
import {MembershipPass1155} from "./MembershipPass1155.sol";

/**
 * @title Registrar
 * @notice Deploys SplitPayout contracts and wires new courses into MembershipPass1155.
 */
contract Registrar is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    IERC20 public immutable usdc;
    MembershipPass1155 public immutable membership;
    address public marketplace;

    event CourseRegistered(
        uint256 indexed courseId,
        address indexed splitter,
        uint256 priceUSDC,
        address indexed creator,
        uint64 duration,
        uint64 transferCooldown
    );

    constructor(IERC20 usdcToken, MembershipPass1155 membershipContract, address admin) {
        require(address(usdcToken) != address(0), "USDC address zero");
        require(address(membershipContract) != address(0), "Membership address zero");

        usdc = usdcToken;
        membership = membershipContract;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    function setMarketplace(address marketplaceAddress) external onlyRole(ADMIN_ROLE) {
        require(marketplaceAddress != address(0), "Marketplace address zero");
        marketplace = marketplaceAddress;
    }

    function registerCourse(
        uint256 courseId,
        uint256 priceUSDC,
        address[] calldata recipients,
        uint32[] calldata sharesBps,
        uint64 duration,
        uint64 transferCooldown
    ) external returns (address splitterAddress) {
        SplitPayout splitter = new SplitPayout(usdc, address(membership), marketplace, recipients, sharesBps);
        splitterAddress = address(splitter);

        membership.createCourse(courseId, priceUSDC, splitterAddress, msg.sender, duration, transferCooldown);

        emit CourseRegistered(courseId, splitterAddress, priceUSDC, msg.sender, duration, transferCooldown);
    }
}
