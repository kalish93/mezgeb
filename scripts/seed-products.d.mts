import type { Client, PoolClient } from 'pg'

export type SeedProduct = {
  code: string; name_am: string; name_en: string
  tubaPerPacket: number; packetsPerMadaberiya: number; tubaPerPiece: number
}
export function seedData(): { units: Record<string, { label_am: string; label_en: string }>; products: SeedProduct[] }
export function conversionsFor(p: SeedProduct): { MADABERIYA_TIDOSH: number; PACKET: number; PIECE: number }
export function seedProducts(client: Client | PoolClient, log?: (msg: string) => void): Promise<void>
