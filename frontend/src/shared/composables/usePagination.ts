import { ref, computed } from 'vue';

export function usePagination(initialPageSize = 20) {
  const page = ref(1);
  const pageSize = ref(initialPageSize);
  const total = ref(0);

  const totalPages = computed(() => Math.ceil(total.value / pageSize.value));

  const nextPage = () => {
    if (page.value < totalPages.value) {
      page.value++;
    }
  };

  const prevPage = () => {
    if (page.value > 1) {
      page.value--;
    }
  };

  const setPage = (p: number) => {
    if (p >= 1 && p <= totalPages.value) {
      page.value = p;
    }
  };

  return {
    page,
    pageSize,
    total,
    totalPages,
    nextPage,
    prevPage,
    setPage,
  };
}
