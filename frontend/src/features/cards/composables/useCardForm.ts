import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { cardSchema } from '../validation/card.schema';
import type { CardFields } from '../validation/card.schema';

export function useCardForm(initialValues?: Partial<CardFields>) {
  const { handleSubmit, errors, defineField, isSubmitting, resetForm } = useForm<CardFields>({
    validationSchema: toTypedSchema(cardSchema),
    initialValues: {
      title: '',
      description: '',
      priority: 'MEDIUM',
      dueDate: '',
      ...initialValues,
    },
  });

  const [title, titleProps] = defineField('title');
  const [description, descriptionProps] = defineField('description');
  const [priority, priorityProps] = defineField('priority');
  const [dueDate, dueDateProps] = defineField('dueDate');

  return {
    handleSubmit,
    errors,
    isSubmitting,
    title,
    titleProps,
    description,
    descriptionProps,
    priority,
    priorityProps,
    dueDate,
    dueDateProps,
    resetForm,
  };
}

export default useCardForm;
