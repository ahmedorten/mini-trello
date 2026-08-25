import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from './router';
import AppLayout from './layouts/AppLayout.vue';
import './assets/main.css';

createApp(AppLayout).use(createPinia()).use(router).mount('#app');
