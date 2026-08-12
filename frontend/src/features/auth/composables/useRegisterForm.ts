import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { registerSchema } from '../validation/register.schema';
import type { RegisterFields } from '../validation/register.schema';

export function useRegisterForm() {
  const { handleSubmit, errors, defineField, isSubmitting } = useForm<RegisterFields>({
    validationSchema: toTypedSchema(registerSchema),
    initialValues: {
      fullName: '',
      email: '',
      password: '',
    },
  });

  const [fullName, fullNameProps] = defineField('fullName');
  const [email, emailProps] = defineField('email');
  const [password, passwordProps] = defineField('password');

  return {
    handleSubmit,
    errors,
    isSubmitting,
    fullName,
    fullNameProps,
    email,
    emailProps,
    password,
    passwordProps,
  };
}

export default useRegisterForm;
