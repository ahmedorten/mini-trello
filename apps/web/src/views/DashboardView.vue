<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<template>
  <section>
    <h1>Dashboard</h1>
    <p>
      This bootstrap delivers the application shell — routing, layout, and a Pinia-backed API
      client — with no CRM domain screens yet.
    </p>
    <p>
      Visit the <RouterLink to="/system-status">System status</RouterLink> page to see the API and
      database health, fetched live through the API client.
    </p>
  </section>
</template>
