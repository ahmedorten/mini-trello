export interface ShortcutBinding {
  keys: string; // e.g. "Control+k" or "/" or "Escape"
  description: string;
  action: (e: KeyboardEvent) => void;
  preventDefault?: boolean;
}

export class KeyboardShortcutService {
  private static bindings: ShortcutBinding[] = [];
  private static isListening = false;

  /**
   * Registers a key combination and its handler.
   */
  static bind(binding: ShortcutBinding): void {
    this.bindings.push(binding);
    if (!this.isListening && typeof window !== 'undefined') {
      this.startListening();
    }
  }

  /**
   * Unbinds a shortcut by exact matching key.
   */
  static unbind(keys: string): void {
    this.bindings = this.bindings.filter((b) => b.keys !== keys);
  }

  private static startListening(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', this.handleKeyDown);
    this.isListening = true;
  }

  static stopListening(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('keydown', this.handleKeyDown);
    this.isListening = false;
  }

  private static handleKeyDown = (e: KeyboardEvent) => {
    // Basic chord parsing (e.g. Ctrl+K)
    const keysPressed: string[] = [];
    if (e.ctrlKey || e.metaKey) keysPressed.push('Control');
    if (e.shiftKey) keysPressed.push('Shift');
    if (e.altKey) keysPressed.push('Alt');
    if (e.key !== 'Control' && e.key !== 'Shift' && e.key !== 'Alt' && e.key !== 'Meta') {
      keysPressed.push(e.key.toLowerCase());
    }

    const combination = keysPressed.join('+');

    for (const binding of this.bindings) {
      if (binding.keys.toLowerCase() === combination || binding.keys.toLowerCase() === e.key.toLowerCase()) {
        if (binding.preventDefault) {
          e.preventDefault();
        }
        binding.action(e);
        break;
      }
    }
  };
}
export default KeyboardShortcutService;
