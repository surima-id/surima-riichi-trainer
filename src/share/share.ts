/**
 * Handing the image to the operating system.
 *
 * Instagram has no web posting API — it was removed years ago — so a page cannot
 * put a picture into a post directly. What it can do is give the OS a file and
 * let the native share sheet offer Instagram among the destinations, which on a
 * phone is a genuine one-tap path to Stories. On a desktop there is no sheet
 * worth using and no Instagram behind it, so the honest fallback is saving the
 * file.
 *
 * The awkward part is user activation. `navigator.share` requires it, and
 * although the activation does survive an `await`, generating the card is real
 * work — fonts, SVG decoding, PNG encoding — and WebKit will refuse by the time
 * it finishes. Awaiting a promise that has *already resolved* costs a single
 * microtask and keeps the activation intact, which is why the caller starts
 * generating as soon as the panel opens and only awaits it on the tap.
 */

/** Whether this browser can share a file at all. */
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || !navigator.canShare) return false
  try {
    // Probed with a throwaway file: the check is about the capability, not about
    // this particular image. Synchronous, and it prompts nothing.
    const probe = new File([new Uint8Array(1)], 'probe.png', { type: 'image/png' })
    return navigator.canShare({ files: [probe] })
  } catch {
    return false
  }
}

export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported' | 'failed'

/**
 * Opens the share sheet with the image attached.
 *
 * A cancelled sheet is not a failure — the user looked and chose not to post —
 * so it is reported separately and the caller says nothing about it.
 */
export async function shareImage(
  blob: Blob,
  filename: string,
  payload: { title: string; text: string; url: string },
): Promise<ShareOutcome> {
  const file = new File([blob], filename, { type: 'image/png' })
  if (!canShareFiles()) return 'unsupported'

  try {
    await navigator.share({ files: [file], title: payload.title, text: payload.text })
    return 'shared'
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    // AbortError is a dismissed sheet; InvalidStateError is a sheet already
    // open, which the next tap resolves. Neither is worth an error message.
    if (name === 'AbortError' || name === 'InvalidStateError') return 'cancelled'
    return 'failed'
  }
}
