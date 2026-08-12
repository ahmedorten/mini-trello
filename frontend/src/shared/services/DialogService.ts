import { useDialogStore } from '../stores/dialog.store';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  severity?: 'info' | 'warning' | 'danger';
}

export class DialogService {
  /**
   * Prompts the user with a confirm dialog and returns a promise resolving to true or false.
   */
  public static confirm(options: ConfirmOptions): Promise<boolean> {
    const store = useDialogStore();
    return store.pushDialog({
      title: options.title,
      message: options.message,
      confirmText: options.confirmText || 'Confirm',
      cancelText: options.cancelText || 'Cancel',
      severity: options.severity || 'info',
    });
  }
}

export default DialogService;
