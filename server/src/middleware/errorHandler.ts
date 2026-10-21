import { Request, Response, NextFunction } from 'express'

export interface AppError extends Error {
  statusCode?: number
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(err)
  const status = err.statusCode ?? 500
  res.status(status).json({
    error: err.message || 'Internal server error',
  })
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Route not found' })
}
