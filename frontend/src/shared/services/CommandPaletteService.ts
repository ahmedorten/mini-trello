export interface Command {
  id: string;
  name: string;
  category: string;
  shortcut?: string[];
  action: () => void;
}

export class CommandPaletteService {
  private static commands = new Map<string, Command>();
  private static isOpen = false;

  /**
   * Registers a new command to the global palette index.
   */
  static register(command: Command): void {
    this.commands.set(command.id, command);
  }

  /**
   * Unregisters a command by identifier.
   */
  static unregister(id: string): void {
    this.commands.delete(id);
  }

  /**
   * Toggles the visibility of the global palette modal overlay.
   */
  static toggle(): void {
    this.isOpen = !this.isOpen;
    console.log(`[CommandPalette] Toggled. Open state: ${this.isOpen}`);
  }

  /**
   * Retrieves all registered commands.
   */
  static getCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  /**
   * Clears the commands registry.
   */
  static clear(): void {
    this.commands.clear();
  }
}
export default CommandPaletteService;
