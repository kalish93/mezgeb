import { NextResponse } from 'next/server'

/** Throw inside a route handler to return a specific status + error code. */
export class HttpError extends Error {
  constructor(public status: number, public code: string) {
    super(code)
  }
}

// Constraint-specific codes the UI can translate
const constraintCodes: Record<string, [number, string]> = {
  products_stock_nonneg: [409, 'INSUFFICIENT_STOCK'],
  uq_packaging_active: [409, 'DUPLICATE_UNIT'],
  items_code_key: [409, 'DUPLICATE_CODE'],
  uq_products_item_form: [409, 'DUPLICATE_FORM'],
  packaging_units_base_per_unit_check: [400, 'INVALID_FACTOR'],
}

/**
 * Maps errors thrown inside route handlers to JSON responses.
 * Postgres constraint violations become 4xx so the UI can show a useful message.
 */
export function errorResponse(err: unknown) {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.code }, { status: err.status })
  }
  const e = err as { code?: string; detail?: string; name?: string; constraint?: string }
  if (e?.name === 'SyntaxError') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const known = e?.constraint && constraintCodes[e.constraint]
  if (known) {
    return NextResponse.json({ error: known[1] }, { status: known[0] })
  }
  switch (e?.code) {
    case '23505': // unique_violation
      return NextResponse.json({ error: e.detail ?? 'Record already exists' }, { status: 409 })
    case '23503': // foreign_key_violation
      return NextResponse.json({ error: e.detail ?? 'Referenced record is missing or still in use' }, { status: 409 })
    case '23502': // not_null_violation
    case '23514': // check_violation
    case '22P02': // invalid_text_representation
      return NextResponse.json({ error: e.detail ?? 'Invalid data' }, { status: 400 })
  }
  console.error(err)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
