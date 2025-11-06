// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Supply} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ISplitPayout {
    function recordPayment(address payer, uint256 amount) external;
}

/**
 * @title MembershipPass1155
 * @notice ERC-1155 contract that mints access passes for Vestaloom courses in exchange for USDC.
 * Each course is represented by a tokenId and has an associated price and SplitPayout recipient.
 */
contract MembershipPass1155 is ERC1155Supply, AccessControl, Pausable, ReentrancyGuard {

    struct Course {
        uint256 priceUSDC; // 6 decimals
        address splitter;
        address creator;
        uint64 duration; // seconds; 0 -> no expiry
        uint64 transferCooldown; // seconds; 0 -> no cooldown
    }

    struct PassState {
        uint64 expiresAt; // unix timestamp; 0 -> no expiry
        uint64 cooldownEndsAt; // unix timestamp; 0 -> no cooldown
    }

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant CREATOR_ROLE = keccak256("CREATOR_ROLE");
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant MARKETPLACE_ROLE = keccak256("MARKETPLACE_ROLE");

    IERC20 public immutable usdc;

    mapping(uint256 => Course) private _courses;
    mapping(uint256 => mapping(address => PassState)) private _passStates;

    event CourseCreated(
        uint256 indexed courseId,
        uint256 priceUSDC,
        address indexed splitter,
        address indexed creator,
        uint64 duration,
        uint64 transferCooldown
    );
    event CoursePriceUpdated(uint256 indexed courseId, uint256 oldPrice, uint256 newPrice);
    event CourseSplitterUpdated(uint256 indexed courseId, address oldSplitter, address newSplitter);
    event CourseConfigUpdated(uint256 indexed courseId, uint64 duration, uint64 transferCooldown);
    event PassMinted(uint256 indexed courseId, address indexed buyer, uint256 amountPaid, uint64 expiresAt);
    event PassRenewed(
        uint256 indexed courseId,
        address indexed account,
        uint256 amountPaid,
        uint64 previousExpiry,
        uint64 newExpiry
    );
    event PassStateUpdated(
        uint256 indexed courseId,
        address indexed account,
        uint64 expiresAt,
        uint64 cooldownEndsAt
    );

    error CourseAlreadyExists(uint256 courseId);
    error CourseNotFound(uint256 courseId);
    error InvalidSplitter();
    error NotCourseCreator(uint256 courseId, address account);
    error TransferRestricted(address caller);
    error TransferCooldownActive(uint256 courseId, address account, uint64 availableAt);
    error PassExpired(uint256 courseId, address account, uint64 expiredAt);
    error RenewalNotAllowed(uint256 courseId, address account);
    error AmountMismatch(uint256 expected, uint256 provided);
    error InvalidDuration();

    constructor(IERC20 usdcToken, string memory uri, address admin) ERC1155(uri) {
        require(address(usdcToken) != address(0), "USDC address zero");
        usdc = usdcToken;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    /* -------------------------------------------------------------------------- */
    /*                              Course lifecycle                              */
    /* -------------------------------------------------------------------------- */

    function createCourse(
        uint256 courseId,
        uint256 priceUSDC,
        address splitter,
        address creator,
        uint64 duration,
        uint64 transferCooldown
    ) external whenNotPaused onlyRole(REGISTRAR_ROLE) {
        if (_courses[courseId].splitter != address(0)) revert CourseAlreadyExists(courseId);
        if (splitter == address(0)) revert InvalidSplitter();
        if (duration == type(uint64).max || transferCooldown == type(uint64).max) revert InvalidDuration();

        _courses[courseId] = Course({
            priceUSDC: priceUSDC,
            splitter: splitter,
            creator: creator,
            duration: duration,
            transferCooldown: transferCooldown
        });

        if (creator != address(0)) {
            _grantRole(CREATOR_ROLE, creator);
        }

        emit CourseCreated(courseId, priceUSDC, splitter, creator, duration, transferCooldown);
    }

    function setPrice(uint256 courseId, uint256 newPriceUSDC) external whenNotPaused {
        Course storage courseInfo = _courses[courseId];
        if (courseInfo.splitter == address(0)) revert CourseNotFound(courseId);
        if (!_canManageCourse(courseId, msg.sender)) revert NotCourseCreator(courseId, msg.sender);

        uint256 oldPrice = courseInfo.priceUSDC;
        courseInfo.priceUSDC = newPriceUSDC;

        emit CoursePriceUpdated(courseId, oldPrice, newPriceUSDC);
    }

    function setSplitter(uint256 courseId, address newSplitter) external whenNotPaused {
        Course storage courseInfo = _courses[courseId];
        if (courseInfo.splitter == address(0)) revert CourseNotFound(courseId);
        if (!_canManageCourse(courseId, msg.sender)) revert NotCourseCreator(courseId, msg.sender);
        if (newSplitter == address(0)) revert InvalidSplitter();

        address oldSplitter = courseInfo.splitter;
        courseInfo.splitter = newSplitter;

        emit CourseSplitterUpdated(courseId, oldSplitter, newSplitter);
    }

    function setCourseConfig(uint256 courseId, uint64 duration, uint64 transferCooldown)
        external
        whenNotPaused
        onlyRole(ADMIN_ROLE)
    {
        Course storage courseInfo = _courses[courseId];
        if (courseInfo.splitter == address(0)) revert CourseNotFound(courseId);
        if (duration == type(uint64).max || transferCooldown == type(uint64).max) revert InvalidDuration();

        courseInfo.duration = duration;
        courseInfo.transferCooldown = transferCooldown;

        emit CourseConfigUpdated(courseId, duration, transferCooldown);
    }

    /* -------------------------------------------------------------------------- */
    /*                                 Mint logic                                 */
    /* -------------------------------------------------------------------------- */

    function marketplaceMint(address to, uint256 courseId, uint256 amountPaid)
        external
        nonReentrant
        whenNotPaused
        onlyRole(MARKETPLACE_ROLE)
    {
        Course memory courseInfo = _getCourseOrRevert(courseId);
        if (courseInfo.priceUSDC != 0 && amountPaid < courseInfo.priceUSDC) {
            revert AmountMismatch(courseInfo.priceUSDC, amountPaid);
        }

        uint64 expiresAt = _initialExpiry(courseInfo);
        _mint(to, courseId, 1, "");
        emit PassMinted(courseId, to, amountPaid, expiresAt);
    }

    function extendPass(uint256 courseId, address account, uint256 amountPaid, uint64 additionalDuration)
        external
        nonReentrant
        whenNotPaused
        onlyRole(MARKETPLACE_ROLE)
    {
        if (additionalDuration == 0) revert InvalidDuration();
        Course memory courseInfo = _getCourseOrRevert(courseId);
        if (courseInfo.priceUSDC != 0 && amountPaid < courseInfo.priceUSDC) {
            revert AmountMismatch(courseInfo.priceUSDC, amountPaid);
        }

        if (balanceOf(account, courseId) == 0) {
            revert RenewalNotAllowed(courseId, account);
        }

        PassState storage state = _passStates[courseId][account];
        uint64 currentExpiry = state.expiresAt;
        uint64 base = currentExpiry > block.timestamp ? currentExpiry : uint64(block.timestamp);
        uint64 newExpiry = _checkedAdd(base, additionalDuration);
        state.expiresAt = newExpiry;
        state.cooldownEndsAt = _cooldownDeadline(courseInfo);

        emit PassRenewed(courseId, account, amountPaid, currentExpiry, newExpiry);
        emit PassStateUpdated(courseId, account, newExpiry, state.cooldownEndsAt);
    }

    /* -------------------------------------------------------------------------- */
    /*                                Admin controls                              */
    /* -------------------------------------------------------------------------- */

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function setURI(string memory newURI) external onlyRole(ADMIN_ROLE) {
        _setURI(newURI);
    }

    /* -------------------------------------------------------------------------- */
    /*                                  Helpers                                   */
    /* -------------------------------------------------------------------------- */

    function hasPass(address account, uint256 courseId) external view returns (bool) {
        return isPassActive(courseId, account);
    }

    function getCourse(uint256 courseId) external view returns (Course memory) {
        return _getCourseOrRevert(courseId);
    }

    function getPassState(uint256 courseId, address account) external view returns (PassState memory) {
        return _passStates[courseId][account];
    }

    function canTransfer(uint256 courseId, address account)
        external
        view
        returns (bool eligible, uint64 availableAt, uint64 expiresAt)
    {
        PassState memory state = _passStates[courseId][account];
        expiresAt = state.expiresAt;
        availableAt = state.cooldownEndsAt;

        bool ownsToken = balanceOf(account, courseId) > 0;
        bool active = state.expiresAt == 0 || state.expiresAt >= block.timestamp;
        bool cooldownElapsed = state.cooldownEndsAt == 0 || state.cooldownEndsAt <= block.timestamp;

        eligible = ownsToken && active && cooldownElapsed;
    }

    function isPassActive(uint256 courseId, address account) public view returns (bool) {
        if (balanceOf(account, courseId) == 0) {
            return false;
        }
        PassState memory state = _passStates[courseId][account];
        if (state.expiresAt == 0) {
            return true;
        }
        return state.expiresAt >= block.timestamp;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _handleTransferState(uint256 id, address from, address to) internal {
        PassState memory previous = _passStates[id][from];
        delete _passStates[id][from];

        Course memory courseInfo = _getCourseOrRevert(id);
        uint64 cooldownEndsAt = courseInfo.transferCooldown == 0
            ? 0
            : _checkedAdd(uint64(block.timestamp), courseInfo.transferCooldown);
        uint64 expiresAt = previous.expiresAt;

        _passStates[id][to] = PassState({expiresAt: expiresAt, cooldownEndsAt: cooldownEndsAt});
        emit PassStateUpdated(id, to, expiresAt, cooldownEndsAt);
    }

    function _handleMintState(uint256 id, address to, uint256 amount) internal {
        if (amount != 1) {
            revert("Membership mints require amount 1");
        }
        Course memory courseInfo = _getCourseOrRevert(id);
        uint64 expiresAt = _initialExpiry(courseInfo);
        uint64 cooldownEndsAt = _cooldownDeadline(courseInfo);
        _passStates[id][to] = PassState({expiresAt: expiresAt, cooldownEndsAt: cooldownEndsAt});
        emit PassStateUpdated(id, to, expiresAt, cooldownEndsAt);
    }

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override(ERC1155Supply)
    {
        if (from != address(0) && to != address(0) && !hasRole(MARKETPLACE_ROLE, _msgSender())) {
            revert TransferRestricted(_msgSender());
        }

        for (uint256 i = 0; i < ids.length; i++) {
            uint256 amount = values[i];
            if (from == address(0)) {
                _handleMintState(ids[i], to, amount);
            } else if (to == address(0)) {
                delete _passStates[ids[i]][from];
            } else {
                _beforeTransferChecks(ids[i], from, amount);
                _handleTransferState(ids[i], from, to);
            }
        }

        super._update(from, to, ids, values);
    }

    function _initialExpiry(Course memory courseInfo) internal view returns (uint64) {
        if (courseInfo.duration == 0) {
            return 0;
        }
        return _checkedAdd(uint64(block.timestamp), courseInfo.duration);
    }

    function _cooldownDeadline(Course memory courseInfo) internal view returns (uint64) {
        if (courseInfo.transferCooldown == 0) {
            return 0;
        }
        return _checkedAdd(uint64(block.timestamp), courseInfo.transferCooldown);
    }

    function _beforeTransferChecks(uint256 id, address from, uint256 amount) internal view {
        if (amount != 1) {
            revert("Membership transfers require amount 1");
        }
        if (from != address(0)) {
            PassState memory state = _passStates[id][from];
            if (state.expiresAt != 0 && state.expiresAt < block.timestamp) {
                revert PassExpired(id, from, state.expiresAt);
            }
            if (state.cooldownEndsAt != 0 && state.cooldownEndsAt > block.timestamp) {
                revert TransferCooldownActive(id, from, state.cooldownEndsAt);
            }
        }
    }

    function _getCourseOrRevert(uint256 courseId) internal view returns (Course memory) {
        Course memory course = _courses[courseId];
        if (course.splitter == address(0)) revert CourseNotFound(courseId);
        return course;
    }

    function _canManageCourse(uint256 courseId, address account) internal view returns (bool) {
        return hasRole(ADMIN_ROLE, account) || _courses[courseId].creator == account;
    }

    function _checkedAdd(uint64 a, uint64 b) internal pure returns (uint64) {
        unchecked {
            uint64 c = a + b;
            if (c < a) revert InvalidDuration();
            return c;
        }
    }
}
