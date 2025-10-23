<template>
  <v-app>
    <v-main>
      <div class="hero-container">
        <div class="hero-content">
          <div class="title-section">
            <h1 class="main-title">
              <span class="title-accent">FAR</span>
              <span class="title-main">Laundry</span>
            </h1>
            <div class="title-underline"></div>
            <div class="creator-badge">
              <v-chip
                variant="outlined"
                color="cyan-accent-2"
                size="small"
                prepend-icon="mdi-code-tags"
              >
                Created by Matthew Hirstius
              </v-chip>
            </div>
          </div>
        </div>
      </div>

      <div class="main-content">
        <div class="prediction-container">
          <!-- Hall Selection -->
          <div class="hall-selector-container">
            <v-card
              class="selector-card glass-effect"
              variant="outlined"
              color="cyan-accent-2"
              rounded="xl"
              elevation="4"
            >
              <v-card-text class="selector-content">
                <div class="selector-label">
                  <v-icon size="20" color="cyan-accent-2" class="mr-2">mdi-domain</v-icon>
                  <span>Select Hall</span>
                </div>
                <v-btn-toggle
                  v-model="toggle"
                  mandatory
                  rounded="xl"
                  color="cyan-accent-2"
                  class="modern-toggle"
                >
                  <v-btn
                    @click="changeHall('Oglesby')"
                    :value="0"
                    class="toggle-btn"
                    variant="outlined"
                  >
                    <v-icon left size="18" class="mr-2">mdi-home-variant</v-icon>
                    Oglesby
                  </v-btn>
                  <v-btn
                    @click="changeHall('Trelease')"
                    :value="1"
                    class="toggle-btn"
                    variant="outlined"
                  >
                    <v-icon left size="18" class="mr-2">mdi-home-city</v-icon>
                    Trelease
                  </v-btn>
                </v-btn-toggle>
              </v-card-text>
            </v-card>
          </div>

          <!-- Current Availability Display -->
          <div class="availability-container">
            <v-card
              class="availability-card glass-effect"
              variant="outlined"
              color="cyan-accent-2"
              rounded="xl"
              elevation="8"
            >
              <!-- Header -->
              <div class="card-header">
                <div class="header-content">
                  <div class="header-icon">
                    <v-icon size="32" color="cyan-accent-2">mdi-washing-machine</v-icon>
                  </div>
                  <div class="header-text">
                    <h2 class="availability-title">Current Availability</h2>
                    <h3 class="hall-name">{{ hall }}</h3>
                  </div>
                </div>
                <div class="timestamp-container">
                  <v-chip
                    v-if="!loading"
                    color="cyan-accent-2"
                    variant="outlined"
                    size="small"
                    prepend-icon="mdi-clock-outline"
                  >
                    {{ timestamp }}
                  </v-chip>
                </div>
              </div>

              <!-- Availability Cards -->
              <div class="availability-grid">
                <!-- Washers -->
                <div class="machine-card washer-card">
                  <div class="machine-header">
                    <div class="machine-icon">
                      <v-icon size="28" color="cyan-accent-2">mdi-washing-machine</v-icon>
                    </div>
                    <div class="machine-label">
                      <h4>Washing Machines</h4>
                      <span class="machine-subtitle">Available now</span>
                    </div>
                  </div>

                  <div class="machine-count">
                    <v-progress-circular
                      v-if="loading"
                      indeterminate
                      color="cyan-accent-2"
                      size="64"
                      width="6"
                    ></v-progress-circular>
                    <div v-else class="count-display">
                      <span class="count-number">{{ washerPred }}</span>
                      <div class="count-indicator" :class="getAvailabilityClass(washerPred)">
                        <v-icon size="16">{{ getAvailabilityIcon(washerPred) }}</v-icon>
                      </div>
                    </div>
                  </div>

                  <div class="machine-status" v-if="!loading">
                    <v-progress-linear
                      :model-value="washerPred"
                      :max="14"
                      color="cyan-accent-2"
                      height="8"
                      rounded
                    ></v-progress-linear>
                    <span class="status-text">{{ getStatusText(washerPred, 14) }}</span>
                  </div>
                </div>

                <!-- Dryers -->
                <div class="machine-card dryer-card">
                  <div class="machine-header">
                    <div class="machine-icon">
                      <v-icon size="28" color="cyan-accent-2">mdi-tumble-dryer</v-icon>
                    </div>
                    <div class="machine-label">
                      <h4>Dryers</h4>
                      <span class="machine-subtitle">Available now</span>
                    </div>
                  </div>

                  <div class="machine-count">
                    <v-progress-circular
                      v-if="loading"
                      indeterminate
                      color="cyan-accent-2"
                      size="64"
                      width="6"
                    ></v-progress-circular>
                    <div v-else class="count-display">
                      <span class="count-number">{{ dryerPred }}</span>
                      <div class="count-indicator" :class="getAvailabilityClass(dryerPred)">
                        <v-icon size="16">{{ getAvailabilityIcon(dryerPred) }}</v-icon>
                      </div>
                    </div>
                  </div>

                  <div class="machine-status" v-if="!loading">
                    <v-progress-linear
                      :model-value="dryerPred"
                      :max="15"
                      color="cyan-accent-2"
                      height="8"
                      rounded
                    ></v-progress-linear>
                    <span class="status-text">{{ getStatusText(dryerPred, 15) }}</span>
                  </div>
                </div>
              </div>

              <!-- Quick Actions -->
              <div class="quick-actions" v-if="!loading">
                <v-btn
                  variant="outlined"
                  color="cyan-accent-2"
                  rounded="xl"
                  prepend-icon="mdi-refresh"
                  @click="getPrediction"
                  class="action-btn"
                >
                  Refresh
                </v-btn>
              </div>
            </v-card>
          </div>
        </div>
      </div>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
const config = useRuntimeConfig()
const toggle = ref(0)
const hall = ref('Oglesby')
const hallsDict: Record<string, number> = { 'Oglesby': 0, 'Trelease': 1 }

const timestamp = ref('')
const loading = ref(true)
const dryerPred = ref(0)
const washerPred = ref(0)

function changeHall(value: string) {
  hall.value = value
  loading.value = true
  getPrediction()
}

async function getPrediction() {
  try {
    loading.value = true
    const response = await $fetch(`${config.public.apiBase}/api/current/${hallsDict[hall.value]}`)

    dryerPred.value = response.Dryers
    washerPred.value = response['Washing Machines']
    timestamp.value = response.Timestamp
    loading.value = false
  }
  catch (error) {
    console.error('Error fetching data:', error)
    loading.value = false
  }
}

function getAvailabilityClass(count: number) {
  if (count >= 10) return 'status-excellent'
  if (count >= 6) return 'status-good'
  if (count >= 1) return 'status-limited'
  return 'status-none'
}

function getAvailabilityIcon(count: number) {
  if (count >= 10) return 'mdi-check-circle'
  if (count >= 6) return 'mdi-check'
  if (count >= 1) return 'mdi-alert'
  return 'mdi-close-circle'
}

function getStatusText(count: number, total: number) {
  if (count === 0) return 'None available'
  if (count >= 10) return 'Excellent availability'
  if (count >= 6) return 'Good availability'
  return 'Limited availability'
}

// Initial load
onMounted(() => {
  getPrediction()
})
</script>

<style scoped>
.hero-container {
  position: relative;
  min-height: 22vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(0, 188, 212, 0.1) 0%, rgba(0, 150, 136, 0.05) 100%);
  overflow: hidden;
}

.hero-content {
  text-align: center;
  z-index: 2;
  position: relative;
}

.title-section {
  margin-top: 1rem;
  margin-bottom: 1rem;
}

.main-title {
  font-family: 'Oxanium', sans-serif;
  font-weight: 700;
  font-size: clamp(3rem, 8vw, 4.5rem);
  line-height: 1.1;
  margin: 0;
  letter-spacing: -0.02em;
}

.title-accent {
  background: linear-gradient(135deg, #00bcd4, #26c6da);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.title-main {
  color: rgba(255, 255, 255, 0.9);
}

.title-underline {
  height: 4px;
  width: 120px;
  background: linear-gradient(90deg, #00bcd4, #26c6da);
  margin: 1rem auto;
  border-radius: 2px;
  animation: glow 2s ease-in-out infinite alternate;
}

@keyframes glow {
  from { box-shadow: 0 0 10px rgba(0, 188, 212, 0.5); }
  to { box-shadow: 0 0 20px rgba(0, 188, 212, 0.8); }
}

.subtitle {
  font-family: 'Oxanium', sans-serif;
  font-size: clamp(1rem, 3vw, 1.25rem);
  color: rgba(255, 255, 255, 0.7);
  margin: 1rem 0 2rem 0;
  font-weight: 400;
}

.creator-badge {
  margin-top: 1.5rem;
}

.main-content {
  position: relative;
  z-index: 2;
  padding: 2rem 0;
}

.prediction-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 0 1rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.hall-selector-container {
  display: flex;
  justify-content: center;
}

.selector-card {
  backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(0, 188, 212, 0.3);
  transition: all 0.3s ease;
}

.selector-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 1.5rem 2rem;
}

.selector-label {
  display: flex;
  align-items: center;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.95rem;
  font-weight: 500;
}

.modern-toggle {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px !important;
  padding: 4px;
}

.toggle-btn {
  font-family: 'Oxanium', sans-serif;
  font-weight: 500;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  text-transform: none;
  letter-spacing: 0.5px;
}

.availability-container {
  width: 100%;
}

.availability-card {
  backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(0, 188, 212, 0.3);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2rem 2rem 1rem 2rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  background: rgba(0, 188, 212, 0.1);
  border-radius: 16px;
  border: 1px solid rgba(0, 188, 212, 0.2);
}

.header-text {
  display: flex;
  flex-direction: column;
}

.availability-title {
  font-family: 'Oxanium', sans-serif;
  font-size: 1.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
  line-height: 1.2;
}

.hall-name {
  font-family: 'Oxanium', sans-serif;
  font-size: 1.1rem;
  font-weight: 400;
  color: #26c6da;
  margin: 0.25rem 0 0 0;
}

.availability-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  padding: 2rem;
}

.machine-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 1.5rem;
}

.machine-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.machine-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: rgba(0, 188, 212, 0.1);
  border-radius: 12px;
}

.machine-label h4 {
  font-family: 'Oxanium', sans-serif;
  font-size: 1.1rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
}

.machine-subtitle {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.6);
}

.machine-count {
  display: flex;
  justify-content: center;
  margin: 1.5rem 0;
}

.count-display {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.count-number {
  font-family: 'Oxanium', sans-serif;
  font-size: 3rem;
  font-weight: 700;
  color: #26c6da;
  line-height: 1;
}

.count-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.status-excellent {
  background: rgba(76, 175, 80, 0.2);
  color: #4caf50;
}

.status-good {
  background: rgba(255, 193, 7, 0.2);
  color: #ffc107;
}

.status-limited {
  background: rgba(255, 152, 0, 0.2);
  color: #ff9800;
}

.status-none {
  background: rgba(244, 67, 54, 0.2);
  color: #f44336;
}

.machine-status {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.status-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.status-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.8s ease;
  background: linear-gradient(90deg, #26c6da, #00bcd4);
}

.status-text {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
}

.quick-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
  padding: 1rem 2rem 2rem 2rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.action-btn {
  font-family: 'Oxanium', sans-serif;
  text-transform: none;
  letter-spacing: 0.5px;
}

.glass-effect {
  backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.05);
}

/* Responsive Design */
@media (max-width: 768px) {
  .hero-container {
    min-height: 35vh;
    padding: 1rem;
  }

  .prediction-container {
    padding: 0 0.5rem;
    gap: 1.5rem;
  }

  .availability-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
    padding: 1.5rem;
  }

  .card-header {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }

  .header-icon {
    width: 48px;
    height: 48px;
  }

  .header-icon .v-icon {
    font-size: 24px !important;
  }

  .availability-title {
    font-size: 1.5rem;
  }

  .quick-actions {
    flex-direction: column;
    gap: 0.75rem;
  }

  .count-number {
    font-size: 2.5rem;
  }

  .machine-icon {
    width: 40px;
    height: 40px;
  }

  .machine-icon .v-icon {
    font-size: 22px !important;
  }
}

@media (max-width: 480px) {
  .hero-container {
    min-height: 30vh;
  }

  .selector-content {
    padding: 1rem 1.5rem;
  }

  .card-header {
    padding: 1.5rem 1rem 0.75rem 1rem;
  }

  .header-icon {
    width: 40px;
    height: 40px;
  }

  .header-icon .v-icon {
    font-size: 20px !important;
  }

  .availability-title {
    font-size: 1.25rem;
  }

  .hall-name {
    font-size: 1rem;
  }

  .availability-grid {
    padding: 1rem;
  }

  .machine-card {
    padding: 1rem;
  }

  .machine-icon {
    width: 36px;
    height: 36px;
  }

  .machine-icon .v-icon {
    font-size: 20px !important;
  }

  .machine-label h4 {
    font-size: 1rem;
  }

  .count-number {
    font-size: 2rem;
  }
}
</style>
