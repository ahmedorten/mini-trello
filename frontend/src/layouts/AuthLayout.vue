<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors duration-200">
    <div class="sm:mx-auto sm:w-full sm:max-w-md text-center">
      <div class="flex justify-center mb-6">
        <div class="bg-indigo-650 hover:bg-indigo-600 text-white font-bold text-3xl p-3.5 rounded-2xl select-none shadow-md transition-all">
          MT
        </div>
      </div>
      <h2 class="text-center text-3xl font-extrabold text-gray-900 dark:text-gray-50 tracking-tight font-sans">Mini Trello</h2>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div class="bg-white dark:bg-gray-900 py-8 px-4 shadow-md sm:rounded-2xl sm:px-10 border border-gray-150 dark:border-gray-800 transition-colors duration-200">
        <slot />
      </div>
    </div>
  </div>
</template>
