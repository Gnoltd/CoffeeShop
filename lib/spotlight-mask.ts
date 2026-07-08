export const SPOTLIGHT_R = 260

/**
 * CSS radial-gradient mask string for the landing hero's cursor spotlight.
 * Stops match the Lithos hero spec (soft glowing edge, fully transparent rim).
 */
export function spotlightMask(x: number, y: number, radius: number = SPOTLIGHT_R): string {
  return (
    `radial-gradient(circle ${radius}px at ${x}px ${y}px, ` +
    "rgba(255,255,255,1) 0%, " +
    "rgba(255,255,255,1) 40%, " +
    "rgba(255,255,255,0.75) 60%, " +
    "rgba(255,255,255,0.4) 75%, " +
    "rgba(255,255,255,0.12) 88%, " +
    "rgba(255,255,255,0) 100%)"
  )
}
