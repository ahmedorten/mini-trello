<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<template>
  <section>
    <h1>Not allowed</h1>
    <p>Your account does not have permission to view this page.</p>
    <p><RouterLink to="/">Back to the dashboard</RouterLink></p>
  </section>
</template>
