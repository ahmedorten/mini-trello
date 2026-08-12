import { ref } from 'vue';

export function useModal() {
  const isOpen = ref(false);
  const modalData = ref<any>(null);

  const openModal = (data: any = null) => {
    modalData.value = data;
    isOpen.value = true;
  };

  const closeModal = () => {
    isOpen.value = false;
    modalData.value = null;
  };

  return {
    isOpen,
    modalData,
    openModal,
    closeModal,
  };
}

export default useModal;
