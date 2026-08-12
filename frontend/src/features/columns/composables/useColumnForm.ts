import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { columnSchema } from '../validation/column.schema';
import type { ColumnFields } from '../validation/column.schema';

export function useColumnForm(initialValues?: Partial<ColumnFields>) {
  const { handleSubmit, errors, defineField, isSubmitting, resetForm } = useForm<ColumnFields>({
    validationSchema: toTypedSchema(columnSchema),
    initialValues: {
      name: '',
      ...initialValues,
    },
  });

  const [name, nameProps] = defineField('name');

  return {
    handleSubmit,
    errors,
    isSubmitting,
    name,
    nameProps,
    resetForm,
  };
}

export default useColumnForm;
