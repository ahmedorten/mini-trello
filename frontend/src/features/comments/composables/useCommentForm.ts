import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { commentSchema } from '../validation/comment.schema';
import type { CommentFields } from '../validation/comment.schema';

export function useCommentForm(initialValues?: Partial<CommentFields>) {
  const { handleSubmit, errors, defineField, isSubmitting, resetForm } = useForm<CommentFields>({
    validationSchema: toTypedSchema(commentSchema),
    initialValues: {
      content: '',
      ...initialValues,
    },
  });

  const [content, contentProps] = defineField('content');

  return {
    handleSubmit,
    errors,
    isSubmitting,
    content,
    contentProps,
    resetForm,
  };
}

export default useCommentForm;
