export class FocusManager {
  private static focusStack: HTMLElement[] = [];

  /**
   * Stashes the currently focused element on top of the stack.
   */
  public static stashFocus(): void {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      this.focusStack.push(document.activeElement);
    }
  }

  /**
   * Restores focus to the element stashed on top of the stack.
   */
  public static restoreFocus(): void {
    const previousElement = this.focusStack.pop();
    if (previousElement && typeof previousElement.focus === 'function') {
      previousElement.focus();
    }
  }

  /**
   * Explicitly sets focus on a target element, stashing the current focus first.
   */
  public static focusElement(element: HTMLElement, stashCurrent = true): void {
    if (stashCurrent) {
      this.stashFocus();
    }
    element.focus();
  }

  /**
   * Clears the stashed focus stack.
   */
  public static clear(): void {
    this.focusStack = [];
  }
}

export default FocusManager;
