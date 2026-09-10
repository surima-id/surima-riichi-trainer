/**
 * Placeholder substitution: `"{n} fu"` with `{ n: 40 }` becomes `"40 fu"`.
 *
 * Deliberately minimal — no plural machinery. Indonesian does not inflect for
 * number, and every English count in this app ("{n} han", "{n} fu", "{n} tiles")
 * is plural-invariant in the forms used, so a plural engine would add weight
 * without changing a single string.
 */

import { type Params } from './types'

export function interpolate(template: string, params?: Params): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in params ? String(params[key]) : whole,
  )
}
