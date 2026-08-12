import { Request, Response, NextFunction } from 'express';
import { CardService } from './card.service';
import { LabelService } from '../label/label.service';
import { CardSearchInput } from './card-search.schema';
import { AppError } from '../../shared/errors/app-error';

const cardService: CardService = new CardService();
const labelService: LabelService = new LabelService();

export class CardController {
  public async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      const result = await cardService.searchCards(
        req.user.id,
        req.query as unknown as CardSearchInput
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  public async create(
    req: Request<{ columnId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      const card = await cardService.createCard(req.params.columnId, req.user.id, req.body);
      res.status(201).json({
        success: true,
        data: card,
      });
    } catch (error) {
      next(error);
    }
  }

  public async list(
    req: Request<{ columnId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      const cards = await cardService.getCards(req.params.columnId, req.user.id);
      res.status(200).json({
        success: true,
        data: cards,
      });
    } catch (error) {
      next(error);
    }
  }

  public async getById(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      const card = await cardService.getCard(req.params.id, req.user.id);
      res.status(200).json({
        success: true,
        data: card,
      });
    } catch (error) {
      next(error);
    }
  }

  public async update(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      const card = await cardService.updateCard(req.params.id, req.user.id, req.body);
      res.status(200).json({
        success: true,
        data: card,
      });
    } catch (error) {
      next(error);
    }
  }

  public async delete(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      await cardService.deleteCard(req.params.id, req.user.id);
      res.status(200).json({
        success: true,
        data: null,
      });
    } catch (error) {
      next(error);
    }
  }

  public async move(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      const card = await cardService.moveCard(req.params.id, req.user.id, req.body);
      res.status(200).json({
        success: true,
        data: card,
      });
    } catch (error) {
      next(error);
    }
  }

  public async attachLabel(
    req: Request<{ cardId: string; labelId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      await labelService.attachLabel(req.params.cardId, req.params.labelId, req.user.id);
      res.status(200).json({
        success: true,
        data: null,
      });
    } catch (error) {
      next(error);
    }
  }

  public async detachLabel(
    req: Request<{ cardId: string; labelId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401);
      }
      await labelService.detachLabel(req.params.cardId, req.params.labelId, req.user.id);
      res.status(200).json({
        success: true,
        data: null,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default CardController;
