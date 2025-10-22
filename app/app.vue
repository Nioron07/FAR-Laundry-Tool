<template>
  <v-app>
    <NuxtRouteAnnouncer />
    <NuxtPage />

    <v-bottom-navigation
      v-model="activeTab"
      color="cyan-accent-2"
      grow
    >
      <v-btn value="home" to="/">
        <v-icon>mdi-home</v-icon>
        <span>Home</span>
      </v-btn>

      <v-btn value="forecast" to="/forecast">
        <v-icon>mdi-chart-line</v-icon>
        <span>Forecast</span>
      </v-btn>

      <v-btn value="contribute" to="/contribute">
        <v-icon>mdi-database-plus</v-icon>
        <span>Contribute</span>
      </v-btn>
    </v-bottom-navigation>
  </v-app>
</template>

<script setup lang="ts">
const activeTab = ref('home')
</script>
