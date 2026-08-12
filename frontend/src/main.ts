import { validateEnvironment } from '@/core/config/EnvironmentSchema';
import { createApp } from 'vue';
import App from './App.vue';
import setupPinia from '@/plugins/pinia';
import setupRouter from '@/plugins/router';
import setupAxios from '@/plugins/axios';
import setupValidation from '@/plugins/validation';
import setupI18n from '@/plugins/i18n';
import '@/assets/styles/main.css';

// Fail-fast if environment configuration is invalid
validateEnvironment();

const app = createApp(App);

setupPinia(app);
setupRouter(app);
setupAxios(app);
setupValidation(app);
setupI18n(app);

app.mount('#app');
