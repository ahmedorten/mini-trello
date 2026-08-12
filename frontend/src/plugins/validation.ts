import type { App } from 'vue';
import { configure } from 'vee-validate';

export default function setupValidation(_app: App): void {
  configure({
    validateOnBlur: true,
    validateOnChange: true,
    validateOnInput: false,
    validateOnModelUpdate: true,
  });
}
