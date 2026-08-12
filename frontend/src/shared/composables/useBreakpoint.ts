import { useBreakpoints, breakpointsTailwind } from '@vueuse/core';

export function useBreakpoint() {
  const breakpoints = useBreakpoints(breakpointsTailwind);

  return {
    isMobile: breakpoints.smaller('sm'),
    isTablet: breakpoints.between('sm', 'md'),
    isLaptop: breakpoints.between('md', 'lg'),
    isDesktop: breakpoints.greaterOrEqual('lg'),
    breakpoints,
  };
}
