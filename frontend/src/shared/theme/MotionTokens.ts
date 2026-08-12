export const MotionTokens = {
  durations: {
    fast: '100ms',     // Hover effects, quick micro-interactions
    normal: '200ms',   // Modal scale-in, drawer slide-in, collapses
    slow: '300ms',     // Transitions between pages, large panel moves
  },
  curves: {
    ease: 'ease',
    linear: 'linear',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // Out-back spring curve
  },
  presets: {
    fade: 'transition-opacity duration-200 ease-in-out',
    transform: 'transition-all duration-200 cubic-bezier(0.34, 1.56, 0.64, 1)',
  }
} as const;

export default MotionTokens;
