<script setup lang="ts">
import { ref } from 'vue';
import { onClickOutside } from '@vueuse/core';

interface Props {
  align?: 'left' | 'right';
}

withDefaults(defineProps<Props>(), {
  align: 'right',
});

const isOpen = ref(false);
const dropdownRef = ref<HTMLElement | null>(null);

onClickOutside(dropdownRef, () => {
  isOpen.value = false;
});
</script>

<template>
  <div ref="dropdownRef" class="relative inline-block text-left">
    <div @click="isOpen = !isOpen" class="cursor-pointer">
      <slot name="trigger" />
    </div>

    <transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        class="absolute z-20 mt-2 w-56 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
        :class="[align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left']"
      >
        <div class="py-1" @click="isOpen = false">
          <slot name="content" />
        </div>
      </div>
    </transition>
  </div>
</template>
