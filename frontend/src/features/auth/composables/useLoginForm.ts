import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { loginSchema } from '../validation/login.schema';
import type { LoginFields } from '../validation/login.schema';

export function useLoginForm() {
  const { handleSubmit, errors, defineField, isSubmitting } = useForm<LoginFields>({
    validationSchema: toTypedSchema(loginSchema),
    initialValues: {
      email: '',
      password: '',
    },
  });

  const [email, emailProps] = defineField('email');
  const [password, passwordProps] = defineField('password');

  return {
    handleSubmit,
    errors,
    isSubmitting,
    email,
    emailProps,
    password,
    passwordProps,
  };
}

export default useLoginForm;
