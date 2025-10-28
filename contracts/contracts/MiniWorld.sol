// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title MiniWorld
 * @notice Autonomous 10x10 grid world where players claim tiles and place items
 * @dev All game state lives on-chain with events for off-chain indexing
 */
contract MiniWorld {
    enum ItemType {
        Empty,
        Tree,
        Rock,
        Flag,
        Building,
        Water
    }

    struct Tile {
        address owner;
        ItemType itemType;
        uint256 lastModified;
    }

    uint256 public constant GRID_SIZE = 10;
    uint256 public constant TOTAL_TILES = GRID_SIZE * GRID_SIZE;

    mapping(uint256 => Tile) public tiles;
    mapping(address => uint256[]) private playerTiles;

    event TileClaimed(uint256 indexed tileId, address indexed owner, uint256 timestamp);
    event ItemPlaced(uint256 indexed tileId, address indexed owner, ItemType itemType, uint256 timestamp);
    event ItemRemoved(uint256 indexed tileId, address indexed owner, uint256 timestamp);

    error InvalidTileId(uint256 tileId);
    error TileAlreadyClaimed(uint256 tileId);
    error NotTileOwner(uint256 tileId, address caller);
    error InvalidCoordinates(uint256 x, uint256 y);

    /**
     * @notice Claim an unclaimed tile
     * @param tileId The tile to claim (0-99)
     */
    function claimTile(uint256 tileId) external {
        if (tileId >= TOTAL_TILES) revert InvalidTileId(tileId);
        if (tiles[tileId].owner != address(0)) revert TileAlreadyClaimed(tileId);

        tiles[tileId] = Tile({
            owner: msg.sender,
            itemType: ItemType.Empty,
            lastModified: block.timestamp
        });

        playerTiles[msg.sender].push(tileId);

        emit TileClaimed(tileId, msg.sender, block.timestamp);
    }

    /**
     * @notice Place an item on an owned tile
     * @param tileId The tile to modify
     * @param itemType The item to place
     */
    function placeItem(uint256 tileId, ItemType itemType) external {
        if (tileId >= TOTAL_TILES) revert InvalidTileId(tileId);
        if (tiles[tileId].owner != msg.sender) revert NotTileOwner(tileId, msg.sender);

        tiles[tileId].itemType = itemType;
        tiles[tileId].lastModified = block.timestamp;

        emit ItemPlaced(tileId, msg.sender, itemType, block.timestamp);
    }

    /**
     * @notice Remove an item from an owned tile
     * @param tileId The tile to clear
     */
    function removeItem(uint256 tileId) external {
        if (tileId >= TOTAL_TILES) revert InvalidTileId(tileId);
        if (tiles[tileId].owner != msg.sender) revert NotTileOwner(tileId, msg.sender);

        tiles[tileId].itemType = ItemType.Empty;
        tiles[tileId].lastModified = block.timestamp;

        emit ItemRemoved(tileId, msg.sender, block.timestamp);
    }

    /**
     * @notice Get tile information
     * @param tileId The tile to query
     * @return owner The tile owner address
     * @return itemType The current item on the tile
     * @return lastModified The timestamp of last modification
     */
    function getTile(uint256 tileId) external view returns (address owner, ItemType itemType, uint256 lastModified) {
        if (tileId >= TOTAL_TILES) revert InvalidTileId(tileId);
        Tile memory tile = tiles[tileId];
        return (tile.owner, tile.itemType, tile.lastModified);
    }

    /**
     * @notice Get all tiles owned by a player
     * @param player The player address
     * @return Array of tile IDs owned by the player
     */
    function getPlayerTiles(address player) external view returns (uint256[] memory) {
        return playerTiles[player];
    }

    /**
     * @notice Convert x,y coordinates to tileId
     * @param x The x coordinate (0-9)
     * @param y The y coordinate (0-9)
     * @return tileId The corresponding tile ID
     */
    function coordsToTileId(uint256 x, uint256 y) external pure returns (uint256) {
        if (x >= GRID_SIZE || y >= GRID_SIZE) revert InvalidCoordinates(x, y);
        return y * GRID_SIZE + x;
    }

    /**
     * @notice Convert tileId to x,y coordinates
     * @param tileId The tile ID (0-99)
     * @return x The x coordinate
     * @return y The y coordinate
     */
    function tileIdToCoords(uint256 tileId) external pure returns (uint256 x, uint256 y) {
        if (tileId >= TOTAL_TILES) revert InvalidTileId(tileId);
        x = tileId % GRID_SIZE;
        y = tileId / GRID_SIZE;
    }
}