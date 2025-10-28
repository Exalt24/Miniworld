import { expect } from "chai";
import { network } from "hardhat";
import type { MiniWorld } from "../types/ethers-contracts/MiniWorld";

describe("MiniWorld", function () {
  async function deployMiniWorldFixture() {
    const { ethers } = await network.connect();
    const [owner, player1, player2] = await ethers.getSigners();
    const MiniWorld = await ethers.getContractFactory("MiniWorld");
    const miniWorld = await MiniWorld.deploy() as unknown as MiniWorld;
    await miniWorld.waitForDeployment();
    
    return { miniWorld, owner, player1, player2 };
  }

  describe("Deployment", function () {
    it("Should set correct grid constants", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      expect(await miniWorld.GRID_SIZE()).to.equal(10n);
      expect(await miniWorld.TOTAL_TILES()).to.equal(100n);
    });

    it("Should start with all tiles unclaimed", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      const tile = await miniWorld.getTile(0);
      const { ethers } = await network.connect();
      expect(tile.owner).to.equal(ethers.ZeroAddress);
      expect(tile.itemType).to.equal(0n);
    });
  });

  describe("Tile Claiming", function () {
    it("Should allow claiming an unclaimed tile", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld, player1 } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      await expect(miniWorld.connect(player1).claimTile(42))
        .to.emit(miniWorld, "TileClaimed");

      const tile = await miniWorld.getTile(42);
      expect(tile.owner).to.equal(player1.address);
      expect(tile.itemType).to.equal(0n);
    });

    it("Should revert when claiming already claimed tile", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld, player1, player2 } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      await miniWorld.connect(player1).claimTile(42);
      
      await expect(miniWorld.connect(player2).claimTile(42))
        .to.be.revertedWithCustomError(miniWorld, "TileAlreadyClaimed")
        .withArgs(42n);
    });

    it("Should revert when claiming tile with invalid ID", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld, player1 } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      await expect(miniWorld.connect(player1).claimTile(100))
        .to.be.revertedWithCustomError(miniWorld, "InvalidTileId")
        .withArgs(100n);

      await expect(miniWorld.connect(player1).claimTile(999))
        .to.be.revertedWithCustomError(miniWorld, "InvalidTileId")
        .withArgs(999n);
    });

    it("Should track multiple tiles for one player", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld, player1 } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      await miniWorld.connect(player1).claimTile(0);
      await miniWorld.connect(player1).claimTile(50);
      await miniWorld.connect(player1).claimTile(99);

      const playerTiles = await miniWorld.getPlayerTiles(player1.address);
      expect(playerTiles.length).to.equal(3);
      expect(playerTiles).to.include(0n);
      expect(playerTiles).to.include(50n);
      expect(playerTiles).to.include(99n);
    });

    it("Should allow multiple players to claim different tiles", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld, player1, player2 } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      await miniWorld.connect(player1).claimTile(10);
      await miniWorld.connect(player2).claimTile(20);

      const tile1 = await miniWorld.getTile(10);
      const tile2 = await miniWorld.getTile(20);

      expect(tile1.owner).to.equal(player1.address);
      expect(tile2.owner).to.equal(player2.address);
    });

    it("Should update lastModified timestamp on claim", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld, player1 } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      await miniWorld.connect(player1).claimTile(42);

      const tile = await miniWorld.getTile(42);
      expect(tile.lastModified).to.be.gt(0n);
    });
  });

  describe("Item Placement", function () {
    it("Should allow owner to place Tree item", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld, player1 } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      await miniWorld.connect(player1).claimTile(42);
      
      await expect(miniWorld.connect(player1).placeItem(42, 1))
        .to.emit(miniWorld, "ItemPlaced");

      const tile = await miniWorld.getTile(42);
      expect(tile.itemType).to.equal(1n);
    });

    it("Should allow owner to place all item types", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld, player1 } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      await miniWorld.connect(player1).claimTile(42);
      
      const itemTypes = [0n, 1n, 2n, 3n, 4n, 5n];
      
      for (const itemType of itemTypes) {
        await miniWorld.connect(player1).placeItem(42, itemType);
        const tile = await miniWorld.getTile(42);
        expect(tile.itemType).to.equal(itemType);
      }
    });

    it("Should revert when non-owner tries to place item", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld, player1, player2 } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      await miniWorld.connect(player1).claimTile(42);
      
      await expect(miniWorld.connect(player2).placeItem(42, 1))
        .to.be.revertedWithCustomError(miniWorld, "NotTileOwner")
        .withArgs(42n, player2.address);
    });

    it("Should revert when placing item on unclaimed tile", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld, player1 } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      await expect(miniWorld.connect(player1).placeItem(50, 1))
        .to.be.revertedWithCustomError(miniWorld, "NotTileOwner")
        .withArgs(50n, player1.address);
    });

    it("Should revert when placing item on invalid tile ID", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld, player1 } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      await expect(miniWorld.connect(player1).placeItem(100, 1))
        .to.be.revertedWithCustomError(miniWorld, "InvalidTileId")
        .withArgs(100n);
    });

    it("Should update lastModified timestamp on item placement", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld, player1 } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      await miniWorld.connect(player1).claimTile(42);
      
      await miniWorld.connect(player1).placeItem(42, 1);

      const tile = await miniWorld.getTile(42);
      expect(tile.lastModified).to.be.gt(0n);
    });

    it("Should allow replacing existing item", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld, player1 } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      await miniWorld.connect(player1).claimTile(42);
      await miniWorld.connect(player1).placeItem(42, 1);
      await miniWorld.connect(player1).placeItem(42, 2);

      const tile = await miniWorld.getTile(42);
      expect(tile.itemType).to.equal(2n);
    });
  });

  describe("Item Removal", function () {
    it("Should allow owner to remove item", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld, player1 } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      await miniWorld.connect(player1).claimTile(42);
      await miniWorld.connect(player1).placeItem(42, 1);
      
      await expect(miniWorld.connect(player1).removeItem(42))
        .to.emit(miniWorld, "ItemRemoved");

      const tile = await miniWorld.getTile(42);
      expect(tile.itemType).to.equal(0n);
    });

    it("Should revert when non-owner tries to remove item", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld, player1, player2 } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      await miniWorld.connect(player1).claimTile(42);
      await miniWorld.connect(player1).placeItem(42, 1);
      
      await expect(miniWorld.connect(player2).removeItem(42))
        .to.be.revertedWithCustomError(miniWorld, "NotTileOwner")
        .withArgs(42n, player2.address);
    });

    it("Should revert when removing item from unclaimed tile", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld, player1 } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      await expect(miniWorld.connect(player1).removeItem(50))
        .to.be.revertedWithCustomError(miniWorld, "NotTileOwner")
        .withArgs(50n, player1.address);
    });

    it("Should revert when removing item from invalid tile ID", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld, player1 } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      await expect(miniWorld.connect(player1).removeItem(100))
        .to.be.revertedWithCustomError(miniWorld, "InvalidTileId")
        .withArgs(100n);
    });

    it("Should update lastModified timestamp on item removal", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld, player1 } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      await miniWorld.connect(player1).claimTile(42);
      await miniWorld.connect(player1).placeItem(42, 1);
      
      await miniWorld.connect(player1).removeItem(42);

      const tile = await miniWorld.getTile(42);
      expect(tile.lastModified).to.be.gt(0n);
    });

    it("Should allow removing already empty tile", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld, player1 } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      await miniWorld.connect(player1).claimTile(42);
      await miniWorld.connect(player1).removeItem(42);
      
      await expect(miniWorld.connect(player1).removeItem(42))
        .to.emit(miniWorld, "ItemRemoved");

      const tile = await miniWorld.getTile(42);
      expect(tile.itemType).to.equal(0n);
    });
  });

  describe("View Functions", function () {
    it("Should return correct tile information", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld, player1 } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      await miniWorld.connect(player1).claimTile(42);
      await miniWorld.connect(player1).placeItem(42, 3);
      
      const tile = await miniWorld.getTile(42);
      
      expect(tile.owner).to.equal(player1.address);
      expect(tile.itemType).to.equal(3n);
      expect(tile.lastModified).to.be.gt(0n);
    });

    it("Should return empty data for unclaimed tile", async function () {
      const { networkHelpers, ethers } = await network.connect();
      const { miniWorld } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      const tile = await miniWorld.getTile(50);
      
      expect(tile.owner).to.equal(ethers.ZeroAddress);
      expect(tile.itemType).to.equal(0n);
      expect(tile.lastModified).to.equal(0n);
    });

    it("Should revert getTile for invalid tile ID", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      await expect(miniWorld.getTile(100))
        .to.be.revertedWithCustomError(miniWorld, "InvalidTileId")
        .withArgs(100n);
    });

    it("Should return all tiles owned by player", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld, player1 } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      await miniWorld.connect(player1).claimTile(42);
      await miniWorld.connect(player1).claimTile(10);
      await miniWorld.connect(player1).claimTile(20);
      await miniWorld.connect(player1).claimTile(30);

      const playerTiles = await miniWorld.getPlayerTiles(player1.address);
      
      expect(playerTiles.length).to.equal(4);
      expect(playerTiles).to.include(10n);
      expect(playerTiles).to.include(20n);
      expect(playerTiles).to.include(30n);
      expect(playerTiles).to.include(42n);
    });

    it("Should return empty array for player with no tiles", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld, player2 } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      const playerTiles = await miniWorld.getPlayerTiles(player2.address);
      expect(playerTiles.length).to.equal(0);
    });
  });

  describe("Coordinate Conversion", function () {
    it("Should convert coordinates to tile ID correctly", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      expect(await miniWorld.coordsToTileId(0, 0)).to.equal(0n);
      expect(await miniWorld.coordsToTileId(9, 0)).to.equal(9n);
      expect(await miniWorld.coordsToTileId(0, 1)).to.equal(10n);
      expect(await miniWorld.coordsToTileId(5, 4)).to.equal(45n);
      expect(await miniWorld.coordsToTileId(9, 9)).to.equal(99n);
    });

    it("Should revert for invalid coordinates", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      await expect(miniWorld.coordsToTileId(10, 0))
        .to.be.revertedWithCustomError(miniWorld, "InvalidCoordinates")
        .withArgs(10n, 0n);

      await expect(miniWorld.coordsToTileId(0, 10))
        .to.be.revertedWithCustomError(miniWorld, "InvalidCoordinates")
        .withArgs(0n, 10n);

      await expect(miniWorld.coordsToTileId(15, 15))
        .to.be.revertedWithCustomError(miniWorld, "InvalidCoordinates")
        .withArgs(15n, 15n);
    });

    it("Should convert tile ID to coordinates correctly", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      let coords = await miniWorld.tileIdToCoords(0);
      expect(coords.x).to.equal(0n);
      expect(coords.y).to.equal(0n);

      coords = await miniWorld.tileIdToCoords(9);
      expect(coords.x).to.equal(9n);
      expect(coords.y).to.equal(0n);

      coords = await miniWorld.tileIdToCoords(10);
      expect(coords.x).to.equal(0n);
      expect(coords.y).to.equal(1n);

      coords = await miniWorld.tileIdToCoords(45);
      expect(coords.x).to.equal(5n);
      expect(coords.y).to.equal(4n);

      coords = await miniWorld.tileIdToCoords(99);
      expect(coords.x).to.equal(9n);
      expect(coords.y).to.equal(9n);
    });

    it("Should revert for invalid tile ID", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      await expect(miniWorld.tileIdToCoords(100))
        .to.be.revertedWithCustomError(miniWorld, "InvalidTileId")
        .withArgs(100n);

      await expect(miniWorld.tileIdToCoords(999))
        .to.be.revertedWithCustomError(miniWorld, "InvalidTileId")
        .withArgs(999n);
    });

    it("Should have bidirectional conversion consistency", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          const tileId = await miniWorld.coordsToTileId(x, y);
          const coords = await miniWorld.tileIdToCoords(tileId);
          
          expect(coords.x).to.equal(BigInt(x));
          expect(coords.y).to.equal(BigInt(y));
        }
      }
    });
  });

  describe("Events", function () {
    it("Should emit TileClaimed with correct parameters", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld, player1 } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      await expect(miniWorld.connect(player1).claimTile(42))
        .to.emit(miniWorld, "TileClaimed")
        .withArgs(42n, player1.address, (timestamp: bigint) => timestamp > 0n);
    });

    it("Should emit ItemPlaced with correct parameters", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld, player1 } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      await miniWorld.connect(player1).claimTile(42);
      
      await expect(miniWorld.connect(player1).placeItem(42, 2))
        .to.emit(miniWorld, "ItemPlaced")
        .withArgs(42n, player1.address, 2n, (timestamp: bigint) => timestamp > 0n);
    });

    it("Should emit ItemRemoved with correct parameters", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld, player1 } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      await miniWorld.connect(player1).claimTile(42);
      await miniWorld.connect(player1).placeItem(42, 1);
      
      await expect(miniWorld.connect(player1).removeItem(42))
        .to.emit(miniWorld, "ItemRemoved")
        .withArgs(42n, player1.address, (timestamp: bigint) => timestamp > 0n);
    });
  });

  describe("Complex Scenarios", function () {
    it("Should handle full game cycle for a tile", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld, player1 } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      await miniWorld.connect(player1).claimTile(42);
      await miniWorld.connect(player1).placeItem(42, 1);
      await miniWorld.connect(player1).placeItem(42, 2);
      await miniWorld.connect(player1).removeItem(42);
      await miniWorld.connect(player1).placeItem(42, 3);

      const tile = await miniWorld.getTile(42);
      expect(tile.owner).to.equal(player1.address);
      expect(tile.itemType).to.equal(3n);
    });

    it("Should handle multiple players claiming tiles in same transaction batch", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld, player1, player2 } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      await miniWorld.connect(player1).claimTile(0);
      await miniWorld.connect(player2).claimTile(1);
      await miniWorld.connect(player1).claimTile(2);

      const tile0 = await miniWorld.getTile(0);
      const tile1 = await miniWorld.getTile(1);
      const tile2 = await miniWorld.getTile(2);

      expect(tile0.owner).to.equal(player1.address);
      expect(tile1.owner).to.equal(player2.address);
      expect(tile2.owner).to.equal(player1.address);
    });

    it("Should maintain correct state across many operations", async function () {
      const { networkHelpers } = await network.connect();
      const { miniWorld, player1 } = await networkHelpers.loadFixture(deployMiniWorldFixture);
      
      for (let i = 0; i < 10; i++) {
        await miniWorld.connect(player1).claimTile(i);
      }

      const player1Tiles = await miniWorld.getPlayerTiles(player1.address);
      expect(player1Tiles.length).to.equal(10);

      await miniWorld.connect(player1).placeItem(5, 1);
      const tile5 = await miniWorld.getTile(5);
      expect(tile5.itemType).to.equal(1n);
    });
  });
});