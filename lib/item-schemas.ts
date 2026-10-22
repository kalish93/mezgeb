/** Request schemas shared by POST /api/items and PUT /api/items/:id */
import { z } from 'zod'

export const RawForm = z.object({
  buy_price: z.number().min(0).default(0), // per kg
  stock: z.number().min(0).optional(),     // kg on hand (opening count / correction)
  reorder: z.number().min(0).default(0),
})

export const FinishedForm = z.object({
  unit: z.string().trim().min(1).default('ቱባ'), // base unit; TUBA for cone products
  price: z.number().min(0).default(0),             // per ONE base unit — packaging units carry their own prices
  stock: z.number().min(0).optional(),             // base units on hand
  reorder: z.number().min(0).default(0),
  can_buy: z.boolean().default(false),             // finished goods bought directly (separate from raw cone purchases)
})

export const ItemCode = z.string().trim().toUpperCase().regex(/^[A-Z0-9_]+$/, 'Use A–Z, 0–9 and _')
