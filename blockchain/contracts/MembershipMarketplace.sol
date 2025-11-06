// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {MembershipPass1155, ISplitPayout} from "./MembershipPass1155.sol";

/**
 * @title MembershipMarketplace
 * @notice Facilitates primary sales, renewals, and secondary listings for Vestaloom memberships.
 * Transfers are restricted at the Membership contract level so all peer-to-peer activity must flow
 * through this marketplace, allowing the platform to enforce cooldowns and collect fees.
 */
contract MembershipMarketplace is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Listing {
        address seller;
        uint256 priceUSDC;
        uint64 listedAt;
        uint64 expiresAt;
        bool active;
    }

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    uint96 public constant FEE_DENOMINATOR = 10_000;
    uint96 public constant MAX_PLATFORM_FEE_BPS = 1_000; // 10%

    IERC20 public immutable usdc;
    MembershipPass1155 public immutable membership;

    address public treasury;
    uint96 public platformFeeBps;
    uint64 public maxListingDuration; // seconds; 0 -> unlimited

    mapping(uint256 => mapping(address => Listing)) private _listings;
    mapping(uint256 => address[]) private _listingIndex;
    mapping(uint256 => mapping(address => bool)) private _isIndexed;

    event PrimaryPurchase(
        uint256 indexed courseId,
        address indexed buyer,
        uint256 priceUSDC,
        uint256 feeUSDC
    );
    event ListingCreated(
        uint256 indexed courseId,
        address indexed seller,
        uint256 priceUSDC,
        uint64 listedAt,
        uint64 expiresAt,
        uint64 passExpiresAt
    );
    event ListingCancelled(uint256 indexed courseId, address indexed seller);
    event ListingPurchased(
        uint256 indexed courseId,
        address indexed seller,
        address indexed buyer,
        uint256 priceUSDC,
        uint256 feeUSDC
    );
    event PassRenewedOnMarketplace(
        uint256 indexed courseId,
        address indexed account,
        uint256 priceUSDC,
        uint256 feeUSDC,
        uint64 newExpiry
    );
    event PlatformFeeUpdated(uint96 previousFeeBps, uint96 newFeeBps);
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event ListingDurationUpdated(uint64 previousDuration, uint64 newDuration);

    error InvalidAddress();
    error InvalidPrice();
    error InvalidFee();
    error InvalidDuration();
    error ListingNotFound(uint256 courseId, address seller);
    error ListingExpired(uint256 courseId, address seller);
    error CooldownActive(uint64 availableAt);
    error MembershipExpired(uint64 expiredAt);
    error PassNotHeld();
    error DurationTooLong();

    constructor(
        IERC20 usdcToken,
        MembershipPass1155 membershipContract,
        address admin,
        address treasuryAddress,
        uint96 feeBps,
        uint64 listingDuration
    ) {
        if (address(usdcToken) == address(0) || address(membershipContract) == address(0)) {
            revert InvalidAddress();
        }
        if (admin == address(0) || treasuryAddress == address(0)) {
            revert InvalidAddress();
        }
        if (feeBps > MAX_PLATFORM_FEE_BPS) {
            revert InvalidFee();
        }

        usdc = usdcToken;
        membership = membershipContract;
        treasury = treasuryAddress;
        platformFeeBps = feeBps;
        maxListingDuration = listingDuration;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE, admin);
    }

    /* -------------------------------------------------------------------------- */
    /*                            Marketplace operations                          */
    /* -------------------------------------------------------------------------- */

    function purchasePrimary(uint256 courseId, uint256 maxPrice)
        external
        nonReentrant
        whenNotPaused
    {
        MembershipPass1155.Course memory courseInfo = membership.getCourse(courseId);
        uint256 price = courseInfo.priceUSDC;
        if (price == 0) revert InvalidPrice();
        if (price > maxPrice) revert InvalidPrice();

        _collectPayment(msg.sender, price);

        uint256 fee = _applyFee(price);
        uint256 payout = price - fee;

        if (payout > 0) {
            usdc.safeTransfer(courseInfo.splitter, payout);
            ISplitPayout(courseInfo.splitter).recordPayment(msg.sender, payout);
        }

        membership.marketplaceMint(msg.sender, courseId, price);

        emit PrimaryPurchase(courseId, msg.sender, price, fee);
    }

    function createListing(uint256 courseId, uint256 priceUSDC, uint64 durationSeconds)
        external
        nonReentrant
        whenNotPaused
    {
        if (priceUSDC == 0) revert InvalidPrice();
        if (membership.balanceOf(msg.sender, courseId) == 0) {
            revert PassNotHeld();
        }

        (bool transferable, uint64 availableAt, uint64 expiresAt) = membership.canTransfer(courseId, msg.sender);
        if (!transferable) {
            if (expiresAt != 0 && expiresAt < block.timestamp) {
                revert MembershipExpired(expiresAt);
            }
            if (availableAt != 0 && availableAt > block.timestamp) {
                revert CooldownActive(availableAt);
            }
            revert PassNotHeld();
        }

        uint64 expiresAtTs = _listingExpiry(durationSeconds);
        if (expiresAtTs != 0 && expiresAt != 0 && expiresAtTs > expiresAt) {
            // Prevent listing that outlives the underlying membership.
            expiresAtTs = expiresAt;
        }

        Listing storage listing = _listings[courseId][msg.sender];
        listing.seller = msg.sender;
        listing.priceUSDC = priceUSDC;
        listing.listedAt = uint64(block.timestamp);
        listing.expiresAt = expiresAtTs;
        listing.active = true;

        if (!_isIndexed[courseId][msg.sender]) {
            _listingIndex[courseId].push(msg.sender);
            _isIndexed[courseId][msg.sender] = true;
        }

        emit ListingCreated(courseId, msg.sender, priceUSDC, listing.listedAt, expiresAtTs, expiresAt);
    }

    function cancelListing(uint256 courseId) external nonReentrant {
        Listing storage listing = _listings[courseId][msg.sender];
        if (!listing.active) revert ListingNotFound(courseId, msg.sender);

        listing.active = false;
        emit ListingCancelled(courseId, msg.sender);
    }

    function buyListing(uint256 courseId, address seller, uint256 maxPrice)
        external
        nonReentrant
        whenNotPaused
    {
        Listing storage listing = _listings[courseId][seller];
        if (!listing.active) revert ListingNotFound(courseId, seller);
        if (listing.expiresAt != 0 && listing.expiresAt < block.timestamp) {
            listing.active = false;
            revert ListingExpired(courseId, seller);
        }

        uint256 price = listing.priceUSDC;
        if (price == 0 || price > maxPrice) revert InvalidPrice();

        if (membership.balanceOf(seller, courseId) == 0) {
            listing.active = false;
            revert PassNotHeld();
        }

        (bool transferable, uint64 availableAt, uint64 expiresAt) = membership.canTransfer(courseId, seller);
        if (!transferable) {
            if (expiresAt != 0 && expiresAt < block.timestamp) {
                listing.active = false;
                revert MembershipExpired(expiresAt);
            }
            if (availableAt != 0 && availableAt > block.timestamp) {
                revert CooldownActive(availableAt);
            }
            revert PassNotHeld();
        }

        _collectPayment(msg.sender, price);

        uint256 fee = _applyFee(price);
        uint256 sellerProceeds = price - fee;

        if (sellerProceeds > 0) {
            usdc.safeTransfer(seller, sellerProceeds);
        }

        membership.safeTransferFrom(seller, msg.sender, courseId, 1, "");

        listing.active = false;

        emit ListingPurchased(courseId, seller, msg.sender, price, fee);
    }

    function renew(uint256 courseId, uint256 maxPrice) external nonReentrant whenNotPaused {
        MembershipPass1155.Course memory courseInfo = membership.getCourse(courseId);
        if (membership.balanceOf(msg.sender, courseId) == 0) {
            revert PassNotHeld();
        }
        if (courseInfo.duration == 0) {
            revert InvalidDuration();
        }

        uint256 price = courseInfo.priceUSDC;
        if (price == 0 || price > maxPrice) revert InvalidPrice();

        _collectPayment(msg.sender, price);

        uint256 fee = _applyFee(price);
        uint256 payout = price - fee;

        if (payout > 0) {
            usdc.safeTransfer(courseInfo.splitter, payout);
            ISplitPayout(courseInfo.splitter).recordPayment(msg.sender, payout);
        }

        membership.extendPass(courseId, msg.sender, price, courseInfo.duration);

        MembershipPass1155.PassState memory state = membership.getPassState(courseId, msg.sender);
        emit PassRenewedOnMarketplace(courseId, msg.sender, price, fee, state.expiresAt);
    }

    /* -------------------------------------------------------------------------- */
    /*                             Admin configuration                            */
    /* -------------------------------------------------------------------------- */

    function setPlatformFeeBps(uint96 newFeeBps) external onlyRole(MANAGER_ROLE) {
        if (newFeeBps > MAX_PLATFORM_FEE_BPS) revert InvalidFee();
        emit PlatformFeeUpdated(platformFeeBps, newFeeBps);
        platformFeeBps = newFeeBps;
    }

    function setTreasury(address newTreasury) external onlyRole(MANAGER_ROLE) {
        if (newTreasury == address(0)) revert InvalidAddress();
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    function setMaxListingDuration(uint64 newDuration) external onlyRole(MANAGER_ROLE) {
        emit ListingDurationUpdated(maxListingDuration, newDuration);
        maxListingDuration = newDuration;
    }

    function pause() external onlyRole(MANAGER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(MANAGER_ROLE) {
        _unpause();
    }

    /* -------------------------------------------------------------------------- */
    /*                               View functions                               */
    /* -------------------------------------------------------------------------- */

    function getListing(uint256 courseId, address seller) external view returns (Listing memory) {
        return _listings[courseId][seller];
    }

    function getActiveListings(uint256 courseId) external view returns (Listing[] memory listings) {
        address[] storage sellers = _listingIndex[courseId];
        uint256 activeCount;
        for (uint256 i = 0; i < sellers.length; i++) {
            Listing storage listing = _listings[courseId][sellers[i]];
            if (_isListingActive(listing)) {
                activeCount++;
            }
        }

        listings = new Listing[](activeCount);
        uint256 idx;
        for (uint256 i = 0; i < sellers.length; i++) {
            Listing storage listing = _listings[courseId][sellers[i]];
            if (_isListingActive(listing)) {
                listings[idx] = listing;
                idx++;
            }
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                              Internal helpers                              */
    /* -------------------------------------------------------------------------- */

    function _collectPayment(address payer, uint256 amount) internal {
        if (amount == 0) return;
        usdc.safeTransferFrom(payer, address(this), amount);
    }

    function _applyFee(uint256 amount) internal returns (uint256 fee) {
        if (platformFeeBps == 0 || amount == 0) {
            return 0;
        }
        fee = (amount * platformFeeBps) / FEE_DENOMINATOR;
        if (fee > 0) {
            usdc.safeTransfer(treasury, fee);
        }
    }

    function _listingExpiry(uint64 durationSeconds) internal view returns (uint64) {
        if (durationSeconds == 0) {
            return 0;
        }
        if (maxListingDuration != 0 && durationSeconds > maxListingDuration) {
            revert DurationTooLong();
        }
        unchecked {
            uint64 expiry = uint64(block.timestamp) + durationSeconds;
            if (expiry < uint64(block.timestamp)) {
                revert DurationTooLong();
            }
            return expiry;
        }
    }

    function _isListingActive(Listing storage listing) internal view returns (bool) {
        if (!listing.active) return false;
        if (listing.expiresAt != 0 && listing.expiresAt < block.timestamp) {
            return false;
        }
        return true;
    }
}
