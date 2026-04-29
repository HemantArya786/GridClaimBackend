import { Request, Response } from 'express';
import { tileService } from '../services/tileService';
import type { ClaimTileInput } from '../validators/schemas';

export class TileController {

  /**
   * GET /api/tiles
   * Returns the full grid state. Suitable for initial client load.
   */
  async getAllTiles(_req: Request, res: Response): Promise<void> {
    const tiles = await tileService.getAllTiles();
    res.status(200).json({
      success: true,
      data: { tiles, count: tiles.length },
    });
  }

  /**
   * POST /api/tiles/claim
   * REST fallback for claiming a tile (primary flow is via Socket.IO).
   */
  async claimTile(req: Request, res: Response): Promise<void> {
    const { tileId, userId } = req.body as ClaimTileInput;
    const tile = await tileService.claimTile(tileId, userId);
    res.status(200).json({
      success: true,
      message: 'Tile claimed successfully',
      data: { tile },
    });
  }
}

export const tileController = new TileController();
