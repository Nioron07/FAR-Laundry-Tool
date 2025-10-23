<template>
  <v-app>
    <v-main>
      <v-container class="pa-4">
        <div class="text-center mb-6 mt-4">
          <h1 class="main-title mb-2">
            <span class="title-accent-green">Contribute</span> Data
          </h1>
          <p class="subtitle-text">Help improve predictions by submitting current availability</p>
        </div>

        <v-card
          class="form-card glass-effect"
          variant="outlined"
          color="light-green-accent-2"
          rounded="xl"
          elevation="4"
        >
          <v-card-title class="form-title">
            <v-icon size="32" color="light-green-accent-2" class="mr-2">mdi-database-plus</v-icon>
            Laundry Data Entry
          </v-card-title>

          <v-card-text>
            <v-select
              v-model="hall"
              label="Select Hall"
              :items="['Oglesby', 'Trelease']"
              variant="outlined"
              color="light-green-accent-2"
              class="mb-4"
              :rules="rules"
            ></v-select>

            <v-select
              v-model="washerNum"
              label="Number of Washers Available"
              :items="[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]"
              variant="outlined"
              color="light-green-accent-2"
              class="mb-4"
              :rules="rules"
            ></v-select>

            <v-select
              v-model="dryerNum"
              label="Number of Dryers Available"
              :items="[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]"
              variant="outlined"
              color="light-green-accent-2"
              class="mb-4"
              :rules="rules"
            ></v-select>
          </v-card-text>

          <v-card-actions class="pa-4">
            <v-btn
              block
              color="light-green-accent-2"
              variant="elevated"
              size="large"
              @click="postToDatabase"
              :loading="loading"
              prepend-icon="mdi-send"
            >
              Submit
            </v-btn>
          </v-card-actions>
        </v-card>

        <div class="alert-container mt-6">
          <v-alert
            v-if="success === 'success'"
            type="success"
            variant="tonal"
            closable
            @click:close="success = null"
            title="Success!"
            text="Thank you for contributing!"
          ></v-alert>

          <v-alert
            v-if="success === 'duplicate'"
            type="warning"
            variant="tonal"
            closable
            @click:close="success = null"
            title="Duplicate Submission"
            text="This data has already been submitted recently."
          ></v-alert>

          <v-alert
            v-if="success === 'failed'"
            type="error"
            variant="tonal"
            closable
            @click:close="success = null"
            title="Error"
            text="Something went wrong with your request. Please try again."
          ></v-alert>
        </div>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
const success = ref<string | null>(null)
const hall = ref<string | null>(null)
const washerNum = ref<number | null>(null)
const dryerNum = ref<number | null>(null)
const loading = ref(false)

const halls: Record<string, number> = { 'Oglesby': 0, 'Trelease': 1 }

const rules = [
  (value: any) => {
    if (value !== null && value !== undefined) return true
    return 'You must pick an option'
  },
]

async function postToDatabase() {
  if (hall.value !== null && washerNum.value !== null && dryerNum.value !== null) {
    loading.value = true
    success.value = null

    try {
      const response = await $fetch('/api/contribute', {
        method: 'POST',
        body: {
          data: [washerNum.value, dryerNum.value, halls[hall.value]]
        }
      })

      success.value = 'success'
      // Clear form
      hall.value = null
      washerNum.value = null
      dryerNum.value = null
    } catch (error: any) {
      console.error('Error posting data:', error)
      if (error.statusCode === 400) {
        success.value = 'duplicate'
      } else {
        success.value = 'failed'
      }
    } finally {
      loading.value = false
    }
  }
}
</script>

<style scoped>
.main-title {
  font-family: 'Oxanium', sans-serif;
  font-weight: 700;
  font-size: clamp(2rem, 6vw, 3rem);
  letter-spacing: -0.02em;
}

.title-accent-green {
  background: linear-gradient(135deg, #b2ff59, #76ff03);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle-text {
  font-family: 'Oxanium', sans-serif;
  font-size: clamp(0.9rem, 3vw, 1.1rem);
  color: rgba(255, 255, 255, 0.7);
}

.form-card {
  max-width: 600px;
  margin: 0 auto;
  backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(178, 255, 89, 0.3) !important;
}

.form-title {
  font-family: 'Oxanium', sans-serif;
  font-size: 1.5rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.glass-effect {
  backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.05);
}

.alert-container {
  max-width: 600px;
  margin: 0 auto;
}

@media (max-width: 768px) {
  .main-title {
    font-size: 2rem;
  }

  .subtitle-text {
    font-size: 0.95rem;
  }

  .form-card {
    margin: 0 0.5rem;
  }

  .form-title {
    font-size: 1.3rem;
    padding: 1.25rem;
  }

  .form-title .v-icon {
    font-size: 28px !important;
  }
}

@media (max-width: 480px) {
  .text-center {
    padding: 0 0.5rem;
  }

  .main-title {
    font-size: 1.75rem;
  }

  .subtitle-text {
    font-size: 0.85rem;
  }

  .form-card {
    margin: 0 0.25rem;
  }

  .form-title {
    font-size: 1.1rem;
    padding: 1rem;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-title .v-icon {
    font-size: 24px !important;
  }
}
</style>
