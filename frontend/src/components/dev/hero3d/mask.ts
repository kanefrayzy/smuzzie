/** Fades a 3D stage's (or its fallback image's) edges into the section background. Kept free of three.js imports. */
export const STAGE_MASK = {
  maskImage: 'radial-gradient(ellipse 50% 50% at 50% 50%, black 62%, transparent 100%)',
  WebkitMaskImage: 'radial-gradient(ellipse 50% 50% at 50% 50%, black 62%, transparent 100%)',
} as const;
