export const AnimationPresets = {
  fade: {
    enterActiveClass: 'transition-opacity duration-200 ease-out',
    leaveActiveClass: 'transition-opacity duration-150 ease-in',
    enterFromClass: 'opacity-0',
    leaveToClass: 'opacity-0',
  },
  modal: {
    enterActiveClass: 'transition duration-300 ease-out',
    leaveActiveClass: 'transition duration-200 ease-in',
    enterFromClass: 'opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95',
    enterToClass: 'opacity-100 translate-y-0 sm:scale-100',
    leaveFromClass: 'opacity-100 translate-y-0 sm:scale-100',
    leaveToClass: 'opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95',
  },
  drawer: {
    enterActiveClass: 'transition-transform duration-300 ease-out',
    leaveActiveClass: 'transition-transform duration-250 ease-in',
    enterFromClass: 'translate-x-full',
    leaveToClass: 'translate-x-full',
  },
  toast: {
    enterActiveClass: 'transform ease-out duration-300 transition',
    enterFromClass: 'translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2',
    enterToClass: 'translate-y-0 opacity-100 sm:translate-x-0',
    leaveActiveClass: 'transition ease-in duration-100',
    leaveFromClass: 'opacity-100',
    leaveToClass: 'opacity-0',
  },
} as const;

export default AnimationPresets;
