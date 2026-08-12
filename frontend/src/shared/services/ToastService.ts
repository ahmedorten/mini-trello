import { useToastStore } from '../stores/toast.store';

export class ToastService {
  public static success(message: string, duration = 3000): void {
    useToastStore().add(message, 'success', duration);
  }

  public static error(message: string, duration = 4000): void {
    useToastStore().add(message, 'error', duration);
  }

  public static warning(message: string, duration = 3500): void {
    useToastStore().add(message, 'warning', duration);
  }

  public static info(message: string, duration = 3000): void {
    useToastStore().add(message, 'info', duration);
  }
}

export default ToastService;
