<template>
  <v-app>
    <NuxtRouteAnnouncer />
    <NuxtPage />

    <v-bottom-navigation
      v-model="activeTab"
      :color="navColor"
      :bg-color="navBgColor"
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

      <v-btn value="schedule" to="/schedule">
        <v-icon>mdi-calendar-star</v-icon>
        <span>Schedule</span>
      </v-btn>
    </v-bottom-navigation>
  </v-app>
</template>

<script setup lang="ts">
const route = useRoute()
const activeTab = ref('home')

// Compute navigation colors based on current route
const navColor = computed(() => {
  switch (route.path) {
    case '/':
      return 'cyan-accent-2'
    case '/forecast':
      return 'amber-accent-2'
    case '/schedule':
      return 'deep-purple-accent-2'
    default:
      return 'cyan-accent-2'
  }
})

const navBgColor = computed(() => {
  switch (route.path) {
    case '/':
      return 'cyan-darken-4'
    case '/forecast':
      return 'amber-darken-4'
    case '/schedule':
      return 'deep-purple-darken-3'
    default:
      return 'cyan-darken-4'
  }
})
</script>
