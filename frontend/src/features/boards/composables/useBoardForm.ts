import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { boardSchema } from '../validation/board.schema';
import type { BoardFields } from '../validation/board.schema';

export function useBoardForm(initialValues?: Partial<BoardFields>) {
  const { handleSubmit, errors, defineField, isSubmitting, resetForm } = useForm<BoardFields>({
    validationSchema: toTypedSchema(boardSchema),
    initialValues: {
      name: '',
      description: '',
      ...initialValues,
    },
  });

  const [name, nameProps] = defineField('name');
  const [description, descriptionProps] = defineField('description');

  return {
    handleSubmit,
    errors,
    isSubmitting,
    name,
    nameProps,
    description,
    descriptionProps,
    resetForm,
  };
}

export default useBoardForm;
