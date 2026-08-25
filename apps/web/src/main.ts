import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from './router';
import AppLayout from './layouts/AppLayout.vue';
import { useAuthStore } from './stores/auth';
import './assets/main.css';

void (async () => {
  const app = createApp(AppLayout);
  const pinia = createPinia();

  app.use(pinia);

  // Pinia first, and the store instantiated before the router: the auth store's
  // setup body registers the axios session handlers, and router.beforeEach
  // calls useAuthStore(). Installing the router first makes the very first
  // navigation run before any of that exists.
  const auth = useAuthStore(pinia);

  // Trade the httpOnly cookie for an access token before anything renders, so a
  // reloaded page does not flash the sign-in screen. Never throws.
  await auth.restore();

  app.use(router);
  await router.isReady();

  app.mount('#app');
})();
