import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { checklistSchema } from '../validation/checklist.schema';
import type { ChecklistFields } from '../validation/checklist.schema';

export function useChecklistForm(initialValues?: Partial<ChecklistFields>) {
  const { handleSubmit, errors, defineField, isSubmitting, resetForm } = useForm<ChecklistFields>({
    validationSchema: toTypedSchema(checklistSchema),
    initialValues: {
      title: '',
      ...initialValues,
    },
  });

  const [title, titleProps] = defineField('title');

  return {
    handleSubmit,
    errors,
    isSubmitting,
    title,
    titleProps,
    resetForm,
  };
}

export default useChecklistForm;
