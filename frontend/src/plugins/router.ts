import { router } from '@/router';
import type { App } from 'vue';

export default function setupRouter(app: App): void {
  app.use(router);
}
