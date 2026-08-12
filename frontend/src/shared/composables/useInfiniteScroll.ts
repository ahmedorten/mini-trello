import { ref } from 'vue';

export function useInfiniteScroll(loadMoreCallback: () => Promise<void>) {
  const isFetching = ref(false);
  const hasMore = ref(true);

  const handleScroll = async (el: HTMLElement) => {
    if (isFetching.value || !hasMore.value) return;

    const bottomOfWindow = el.scrollTop + el.clientHeight >= el.scrollHeight - 50;
    if (bottomOfWindow) {
      isFetching.value = true;
      try {
        await loadMoreCallback();
      } finally {
        isFetching.value = false;
      }
    }
  };

  return {
    isFetching,
    hasMore,
    handleScroll,
  };
}
