import { ToastService } from './ToastService';

export interface NotificationOptions {
  type: 'toast' | 'banner' | 'in-app';
  severity: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  priority?: 'low' | 'normal' | 'high';
}

export class NotificationCenter {
  /**
   * Main entry point to dispatch generic notifications.
   */
  public static notify(options: NotificationOptions): void {
    const { type, severity, message, duration } = options;

    if (type === 'toast') {
      this.toast(message, severity, duration);
    } else {
      // Extensible routing to banner or in-app channels in the future
      console.warn(`[NotificationCenter] Delivery type "${type}" is currently stubbed. Falling back to Toast.`);
      this.toast(`[${type.toUpperCase()}] ${message}`, severity, duration);
    }
  }

  /**
   * Directly issue toast notifications.
   */
  public static toast(
    message: string,
    severity: NotificationOptions['severity'] = 'info',
    duration?: number
  ): void {
    switch (severity) {
      case 'success':
        ToastService.success(message, duration);
        break;
      case 'error':
        ToastService.error(message, duration);
        break;
      case 'warning':
        ToastService.warning(message, duration);
        break;
      case 'info':
      default:
        ToastService.info(message, duration);
        break;
    }
  }
}

export default NotificationCenter;
