// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import {FHE, euint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title GuestBook
 * @notice On-chain encrypted guestbook: addresses can submit one message; contract owner can pause/resume; all records are immutable.
 */
contract GuestBook is Ownable, Pausable, ZamaEthereumConfig {
    struct Message {
        address author;
        uint64 timestamp;
        string content;
    }

    Message[] private _messages;
    mapping(address => bool) public hasSubmitted;
    mapping(address => uint256) private _authorIndex;

    // Encrypted total messages counter (FHE)
    euint32 private _encTotal;

    event MessageSubmitted(address indexed author, uint256 index, string content, uint64 timestamp);

    constructor() Ownable() {}

    /**
     * @notice Submit a message, only once per address
     * @param content Text content (1~280 bytes)
     */
    function submitMessage(string calldata content) external whenNotPaused {
        require(!hasSubmitted[msg.sender], "AlreadySubmitted");
        bytes memory contentBytes = bytes(content);
        require(contentBytes.length > 0 && contentBytes.length <= 280, "InvalidContentLength");

        uint64 ts = uint64(block.timestamp);
        _messages.push(Message({author: msg.sender, timestamp: ts, content: content}));
        uint256 idx = _messages.length - 1;
        hasSubmitted[msg.sender] = true;
        _authorIndex[msg.sender] = idx;
        emit MessageSubmitted(msg.sender, idx, content, ts);

        // Update encrypted total using a clear constant as encrypted input (FHE)
        // This enables users to decrypt the total count with the Relayer SDK or mock locally.
        euint32 one = FHE.asEuint32(1);
        _encTotal = FHE.add(_encTotal, one);
        // Allow this contract to decrypt (contract can then allow others via a public function)
        FHE.allowThis(_encTotal);
    }

    /**
     * @notice Pause message submissions
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Resume message submissions
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @return count Total message count
     */
    function totalMessages() external view returns (uint256 count) {
        return _messages.length;
    }

    /**
     * @notice Get encrypted total messages handle (FHE)
     * @return euint32 Encrypted handle (bytes32)
     */
    function getEncTotal() external view returns (euint32) {
        return _encTotal;
    }

    /**
     * @notice Allow a user to decrypt the encrypted total (public access)
     * @param user Address to grant decryption permission
     */
    function allowUserToDecrypt(address user) external {
        FHE.allow(_encTotal, user);
    }

    /**
     * @notice Get paginated messages sorted by time (newest first)
     * @param offset Skip count from the newest (0 means from the newest message)
     * @param limit Maximum number of messages to return
     * @return authors Address array
     * @return timestamps Timestamp array
     * @return contents Content array
     */
    function getMessages(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory authors, uint64[] memory timestamps, string[] memory contents)
    {
        uint256 count = _messages.length;
        if (offset >= count || limit == 0) {
            return (new address[](0), new uint64[](0), new string[](0));
        }

        uint256 size = limit;
        if (size > count - offset) {
            size = count - offset;
        }

        authors = new address[](size);
        timestamps = new uint64[](size);
        contents = new string[](size);

        for (uint256 i = 0; i < size; i++) {
            // From newest: index = count - 1 - (offset + i)
            uint256 idx = count - 1 - (offset + i);
            Message storage m = _messages[idx];
            authors[i] = m.author;
            timestamps[i] = m.timestamp;
            contents[i] = m.content;
        }
    }

    /**
     * @notice Query a specific address's message
     * @param user Address
     * @return exists Whether the message exists
     * @return author Address
     * @return timestamp Timestamp
     * @return content Message content
     */
    function getMyMessage(address user)
        external
        view
        returns (bool exists, address author, uint64 timestamp, string memory content)
    {
        if (!hasSubmitted[user]) {
            return (false, address(0), 0, "");
        }
        uint256 idx = _authorIndex[user];
        Message storage m = _messages[idx];
        return (true, m.author, m.timestamp, m.content);
    }
}

