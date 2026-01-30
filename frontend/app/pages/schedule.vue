<script setup lang="ts">
import { createEvents } from 'ics'

useSeoMeta({
  title: 'UIUC Schedule Laundry - FAR Laundry',
  description: 'Plan your laundry schedule with optimal time suggestions based on predicted availability for Florida Avenue Residence halls at UIUC',
  ogTitle: 'UIUC Schedule Laundry - FAR Laundry',
  ogDescription: 'Plan your laundry schedule with optimal time suggestions based on predicted availability for Florida Avenue Residence halls at UIUC',
  ogUrl: 'https://farlaundry.com/schedule',
  twitterTitle: 'UIUC Schedule Laundry - FAR Laundry',
  twitterDescription: 'Plan your laundry schedule with optimal time suggestions based on predicted availability for Florida Avenue Residence halls at UIUC',
  twitterCard: 'summary',
})

useHead({
  link: [
    { rel: 'canonical', href: 'https://farlaundry.com/schedule' }
  ]
})

const config = useRuntimeConfig()

// Hall selection
const halls = ref([
  { name: 'Oglesby', value: 0 },
  { name: 'Trelease', value: 1 },
])
const hall = ref(halls.value[0])

// Date range
const startDate = ref<string | null>(null)
const endDate = ref<string | null>(null)
const minStartDate = ref<string | null>(null)

// Frequency
const frequencyDays = ref(3)
const frequencyUnit = ref('days')

// Per-day time preferences
const dayTimePreferences = ref({
  0: { enabled: false, start: 8, end: 22 }, // Sunday
  1: { enabled: true, start: 8, end: 22 },  // Monday
  2: { enabled: true, start: 8, end: 22 },  // Tuesday
  3: { enabled: true, start: 8, end: 22 },  // Wednesday
  4: { enabled: true, start: 8, end: 22 },  // Thursday
  5: { enabled: true, start: 8, end: 22 },  // Friday
  6: { enabled: false, start: 8, end: 22 }, // Saturday
})

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Algorithm preference
const algorithmPreference = ref('balanced')
const algorithmOptions = [
  { title: 'Balanced', value: 'balanced', description: 'Equal priority for washers and dryers' },
  { title: 'Prefer Washers', value: 'washers', description: 'Prioritize washer availability' },
  { title: 'Prefer Dryers', value: 'dryers', description: 'Prioritize dryer availability' },
]

// Swap time dialog
const showSwapDialog = ref(false)
const swapDialogData = ref<any>(null)

// Results
const loading = ref(false)
const schedule = ref<any[]>([])
const summary = ref<any>(null)

// Set minimum start date to today
onMounted(() => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  minStartDate.value = `${year}-${month}-${day}`
  startDate.value = minStartDate.value

  // Set end date to 2 weeks from today
  const twoWeeksLater = new Date(today)
  twoWeeksLater.setDate(twoWeeksLater.getDate() + 14)
  const endYear = twoWeeksLater.getFullYear()
  const endMonth = String(twoWeeksLater.getMonth() + 1).padStart(2, '0')
  const endDay = String(twoWeeksLater.getDate()).padStart(2, '0')

  endDate.value = `${endYear}-${endMonth}-${endDay}`
})

// Computed
const frequencyLabel = computed(() => {
  if (frequencyDays.value === 1) return '1 day'
  if (frequencyDays.value === 7) return '1 week'
  if (frequencyDays.value === 14) return '2 weeks'
  if (frequencyDays.value === 30) return '1 month'
  return `${frequencyDays.value} days`
})

const enabledDays = computed(() => {
  return Object.entries(dayTimePreferences.value)
    .filter(([_, pref]) => pref.enabled)
    .map(([day, _]) => parseInt(day))
})

// Helper function to get/set time range for a day
function getTimeRange(dayIndex: number) {
  const pref = dayTimePreferences.value[dayIndex]
  return [pref.start, pref.end]
}

function setTimeRange(dayIndex: number, range: [number, number]) {
  dayTimePreferences.value[dayIndex].start = range[0]
  dayTimePreferences.value[dayIndex].end = range[1]
}

// Swap time functionality
function openSwapDialog(scheduleItem: any) {
  swapDialogData.value = scheduleItem
  showSwapDialog.value = true
}

function selectAlternativeTime(alternative: string) {
  if (!swapDialogData.value) return

  // Find the schedule item and update it
  const index = schedule.value.findIndex(item => item.date === swapDialogData.value.date)
  if (index !== -1) {
    const scheduleItem = schedule.value[index]
    const oldBestTime = scheduleItem.bestTimeFormatted

    // Parse the alternative time (e.g., "2:30 PM" -> 24-hour format)
    const [time, period] = alternative.split(' ')
    const [hours, minutes] = time.split(':').map(Number)
    let hour24 = hours
    if (period === 'PM' && hours !== 12) hour24 += 12
    if (period === 'AM' && hours === 12) hour24 = 0

    const bestTime = `${String(hour24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

    // Find the scores for the new best time from allSortedTimes
    const newTimeData = scheduleItem.allSortedTimes?.find((t: any) => t.formatted === alternative)
    if (newTimeData) {
      scheduleItem.washersAvailable = newTimeData.washers
      scheduleItem.dryersAvailable = newTimeData.dryers
      scheduleItem.combinedScore = newTimeData.score
    }

    // Update best time
    scheduleItem.bestTime = bestTime
    scheduleItem.bestTimeFormatted = alternative

    // Update alternative times: remove the selected one and add the old best time, maintain sorted order
    if (scheduleItem.allSortedTimes) {
      // Find all times except the newly selected best time
      const availableTimes = scheduleItem.allSortedTimes.filter((t: any) => t.formatted !== alternative)

      // Get top 3 as alternatives
      scheduleItem.alternativeTimes = availableTimes.slice(0, 3).map((t: any) => t.formatted)
    }
  }

  showSwapDialog.value = false
  swapDialogData.value = null
}

async function generateSchedule() {
  if (!startDate.value || !endDate.value) {
    return
  }

  loading.value = true
  schedule.value = []
  summary.value = null

  try {
    // Build time constraints per day
    const timeConstraints: Record<string, string> = {}
    Object.entries(dayTimePreferences.value).forEach(([day, pref]) => {
      if (pref.enabled) {
        timeConstraints[day] = `${pref.start}-${pref.end}`
      }
    })

    // Format dates as YYYY-MM-DD strings to avoid timezone issues
    const formatDateString = (date: any): string => {
      if (!date) return ''
      if (typeof date === 'string') {
        // If already a string, extract just the date part
        const datePart = date.split('T')[0]
        return datePart || ''
      }
      // If it's a Date object, format it as local date
      const d = new Date(date)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    const params = new URLSearchParams({
      startDate: formatDateString(startDate.value),
      endDate: formatDateString(endDate.value),
      frequencyDays: frequencyDays.value.toString(),
      daysOfWeek: enabledDays.value.join(','),
      timeConstraints: JSON.stringify(timeConstraints),
      algorithmPreference: algorithmPreference.value,
    })

    const response = await $fetch(`${config.public.apiBase}/api/schedule/${hall.value.value}?${params}`)
    schedule.value = response.schedule
    summary.value = response.summary
  }
  catch (error) {
    console.error('Error generating schedule:', error)
  }
  finally {
    loading.value = false
  }
}

function exportToCalendar() {
  const events = schedule.value
    .filter(day => day.bestTime !== null)
    .map((day) => {
      const [datePart] = day.date.split('T')
      const [year, month, dayOfMonth] = datePart.split('-').map(Number)
      const [hours, minutes] = day.bestTime.split(':').map(Number)

      return {
        title: `Laundry Time - ${hall.value.name}`,
        description: `Optimal time for laundry. Washers: ${day.washersAvailable} available, Dryers: ${day.dryersAvailable} available`,
        start: [year, month, dayOfMonth, hours, minutes],
        duration: { hours: 2 },
        status: 'CONFIRMED',
        busyStatus: 'BUSY',
      }
    })

  createEvents(events, (error, value) => {
    if (error) {
      console.error('Error creating calendar file:', error)
      return
    }

    const blob = new Blob([value], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'laundry-schedule.ics'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  })
}

function getAvailabilityColor(score: number) {
  if (score >= 10) return 'success'
  if (score >= 7) return 'warning'
  return 'error'
}

function formatTime(hour: number) {
  const period = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12} ${period}`
}

function formatDateFromString(dateStr: string, monthFormat: 'short' | 'long' = 'short') {
  // Parse YYYY-MM-DD without timezone conversion
  const parts = dateStr.split('T')[0].split('-')
  if (parts.length < 3) return ''
  const year = parseInt(parts[0] || '0')
  const month = parseInt(parts[1] || '0')
  const day = parseInt(parts[2] || '0')
  const date = new Date(year, month - 1, day) // month is 0-indexed
  return date.toLocaleDateString('en-US', { month: monthFormat, day: 'numeric' })
}
</script>

<template>
  <div class="schedule-container">
    <!-- Header Section -->
    <div class="header-section">
      <div class="header-content">
        <div class="title-section">
          <h1 class="page-title">
            <span class="title-icon">
              <v-icon size="36" color="deep-purple-accent-2">mdi-calendar-star</v-icon>
            </span>
            Schedule Your Laundry
          </h1>
          <p class="page-subtitle">Plan weeks of laundry with optimal timing</p>
        </div>
      </div>
    </div>

    <!-- Input Section -->
    <div class="input-section">
      <!-- Top row: 3 cards -->
      <div class="input-grid-top-row">
        <!-- Date Range Card -->
        <v-card class="input-card glass-effect" variant="outlined" color="deep-purple-accent-2" rounded="xl">
          <v-card-title class="card-title">
            <v-icon size="20" class="mr-2">mdi-calendar-range</v-icon>
            Date Range
          </v-card-title>
          <v-card-text class="card-content">
            <v-date-input
              v-model="startDate"
              label="Start Date"
              :min="minStartDate"
              color="deep-purple-accent-2"
              variant="outlined"
              density="comfortable"
              class="mb-3"
            ></v-date-input>
            <v-date-input
              v-model="endDate"
              label="End Date"
              :min="startDate"
              color="deep-purple-accent-2"
              variant="outlined"
              density="comfortable"
            ></v-date-input>
          </v-card-text>
        </v-card>

        <!-- Frequency Card -->
        <v-card class="input-card glass-effect" variant="outlined" color="deep-purple-accent-2" rounded="xl">
          <v-card-title class="card-title">
            <v-icon size="20" class="mr-2">mdi-clock-outline</v-icon>
            Frequency
          </v-card-title>
          <v-card-text class="card-content">
            <div class="frequency-label mb-3">Every {{ frequencyLabel }}</div>
            <v-slider
              v-model="frequencyDays"
              :min="1"
              :max="30"
              :step="1"
              color="deep-purple-accent-2"
              thumb-label
              show-ticks="always"
              :ticks="{ 1: '1d', 7: '1w', 14: '2w', 30: '1m' }"
            >
              <template v-slot:thumb-label="{ modelValue }">
                {{ modelValue }}
              </template>
            </v-slider>
            <div class="frequency-presets">
              <v-chip
                size="small"
                @click="frequencyDays = 1"
                :color="frequencyDays === 1 ? 'deep-purple-accent-2' : ''"
                variant="outlined"
              >Daily</v-chip>
              <v-chip
                size="small"
                @click="frequencyDays = 3"
                :color="frequencyDays === 3 ? 'deep-purple-accent-2' : ''"
                variant="outlined"
              >Every 3 days</v-chip>
              <v-chip
                size="small"
                @click="frequencyDays = 7"
                :color="frequencyDays === 7 ? 'deep-purple-accent-2' : ''"
                variant="outlined"
              >Weekly</v-chip>
            </div>
          </v-card-text>
        </v-card>

        <!-- Hall Selection Card -->
        <v-card class="input-card glass-effect" variant="outlined" color="deep-purple-accent-2" rounded="xl">
          <v-card-title class="card-title">
            <v-icon size="20" class="mr-2">mdi-domain</v-icon>
            Hall Selection
          </v-card-title>
          <v-card-text class="card-content">
            <v-btn-toggle
              v-model="hall"
              mandatory
              rounded="xl"
              color="deep-purple-accent-2"
              class="hall-toggle"
            >
              <v-btn
                v-for="h in halls"
                :key="h.value"
                :value="h"
                class="hall-btn"
                variant="outlined"
              >
                <v-icon left size="16" class="mr-2">mdi-home-variant</v-icon>
                {{ h.name }}
              </v-btn>
            </v-btn-toggle>
          </v-card-text>
        </v-card>
      </div>

      <!-- Time Availability Card - Full Width -->
      <div class="input-grid-full-row">
        <v-card class="input-card glass-effect" variant="outlined" color="deep-purple-accent-2" rounded="xl">
          <v-card-title class="card-title">
            <v-icon size="20" class="mr-2">mdi-clock-time-four-outline</v-icon>
            Time Availability
          </v-card-title>
          <v-card-text class="card-content">
            <div class="day-time-inline-container">
              <!-- Day chips above everything -->
              <div class="days-chips-row">
                <div class="chips-spacer"></div>
                <v-chip
                  v-for="(day, index) in dayNamesShort"
                  :key="index"
                  :color="dayTimePreferences[index].enabled ? 'deep-purple-accent-2' : ''"
                  :variant="dayTimePreferences[index].enabled ? 'flat' : 'outlined'"
                  @click="dayTimePreferences[index].enabled = !dayTimePreferences[index].enabled"
                  size="small"
                  class="day-chip"
                >
                  {{ day }}
                </v-chip>
              </div>

              <!-- Sliders row with time axis -->
              <div class="sliders-row">
                <!-- Time axis labels -->
                <div class="time-axis">
                  <div class="time-label" v-for="hour in [0, 6, 12, 18, 23]" :key="hour" :style="{ top: `${(hour / 23) * 100}%` }">
                    {{ formatTime(hour) }}
                  </div>
                </div>

                <!-- Vertical sliders -->
                <div class="days-slider-grid">
                  <div v-for="(day, index) in dayNamesShort" :key="index" class="day-slider-column">
                    <div v-if="dayTimePreferences[index].enabled" class="vertical-slider-container">
                      <v-range-slider
                        :model-value="getTimeRange(index)"
                        @update:model-value="(range) => setTimeRange(index, range as [number, number])"
                        :min="0"
                        :max="23"
                        :step="1"
                        direction="vertical"
                        color="deep-purple-accent-2"
                        track-color="rgba(255, 255, 255, 0.1)"
                        thumb-size="12"
                        hide-details
                        class="vertical-slider"
                      ></v-range-slider>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Time range displays row -->
              <div class="time-ranges-row">
                <div class="ranges-spacer"></div>
                <div v-for="(day, index) in dayNamesShort" :key="index" class="time-range-cell">
                  <div v-if="dayTimePreferences[index].enabled" class="time-range-display">
                    {{ formatTime(dayTimePreferences[index].start) }}-{{ formatTime(dayTimePreferences[index].end) }}
                  </div>
                </div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </div>

      <!-- Algorithm Preference - Full Width -->
      <div class="input-grid-full-row">
        <v-card class="input-card glass-effect" variant="outlined" color="deep-purple-accent-2" rounded="xl">
        <v-card-title class="card-title">
          <v-icon size="20" class="mr-2">mdi-brain</v-icon>
          Algorithm Preference
        </v-card-title>
        <v-card-text class="card-content">
          <v-btn-toggle
            v-model="algorithmPreference"
            mandatory
            rounded="xl"
            color="deep-purple-accent-2"
            class="algorithm-toggle"
          >
            <v-btn
              v-for="option in algorithmOptions"
              :key="option.value"
              :value="option.value"
              class="algorithm-btn"
              variant="outlined"
            >
              <div class="algorithm-btn-content">
                <div class="algorithm-title">{{ option.title }}</div>
                <div class="algorithm-desc">{{ option.description }}</div>
              </div>
            </v-btn>
          </v-btn-toggle>
        </v-card-text>
      </v-card>
      </div>

      <!-- Generate Button -->
      <div class="generate-section">
        <v-btn
          size="x-large"
          color="deep-purple-darken-3"
          rounded="xl"
          @click="generateSchedule"
          :loading="loading"
          class="generate-btn"
          prepend-icon="mdi-calendar-star"
        >
          Generate Schedule
        </v-btn>
      </div>
    </div>

    <!-- Results Section -->
    <div v-if="schedule.length > 0" class="results-section">
      <!-- Summary Card -->
      <v-card v-if="summary" class="summary-card glass-effect" variant="outlined" color="deep-purple-accent-2" rounded="xl">
        <v-card-text class="summary-content">
          <div class="summary-item">
            <span class="summary-label">Total Days</span>
            <span class="summary-value">{{ summary.totalDays }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Avg. Availability</span>
            <span class="summary-value">{{ summary.averageAvailability.toFixed(1) }}</span>
          </div>
        </v-card-text>
      </v-card>

      <!-- Schedule Cards Grid -->
      <div class="schedule-grid">
        <v-card
          v-for="(day, index) in schedule"
          :key="index"
          class="schedule-card glass-effect"
          variant="outlined"
          color="deep-purple-accent-2"
          rounded="xl"
        >
          <v-card-title class="schedule-card-title">
            <div class="schedule-day">{{ day.dayOfWeek }}</div>
            <div class="schedule-date">{{ formatDateFromString(day.date) }}</div>
          </v-card-title>

          <v-card-text class="schedule-card-content">
            <div class="best-time">{{ day.bestTimeFormatted }}</div>

            <div v-if="day.bestTime" class="availability-bars">
              <div class="availability-row">
                <v-icon size="16" color="deep-purple-accent-2">mdi-washing-machine</v-icon>
                <v-progress-linear
                  :model-value="day.washersAvailable"
                  :max="14"
                  :color="getAvailabilityColor(day.washersAvailable)"
                  height="8"
                  rounded
                  class="availability-bar"
                ></v-progress-linear>
                <span class="availability-count">{{ day.washersAvailable }}</span>
              </div>

              <div class="availability-row">
                <v-icon size="16" color="deep-purple-accent-2">mdi-tumble-dryer</v-icon>
                <v-progress-linear
                  :model-value="day.dryersAvailable"
                  :max="15"
                  :color="getAvailabilityColor(day.dryersAvailable)"
                  height="8"
                  rounded
                  class="availability-bar"
                ></v-progress-linear>
                <span class="availability-count">{{ day.dryersAvailable }}</span>
              </div>
            </div>

            <div v-if="day.alternativeTimes && day.alternativeTimes.length > 0" class="alternative-times">
              <span class="alt-label">Alternatives:</span>
              <span class="alt-times">{{ day.alternativeTimes.join(', ') }}</span>
            </div>
          </v-card-text>

          <v-card-actions v-if="day.alternativeTimes && day.alternativeTimes.length > 0">
            <v-btn
              variant="outlined"
              color="deep-purple-accent-2"
              size="small"
              @click="openSwapDialog(day)"
              block
            >
              <v-icon left size="16" class="mr-1">mdi-swap-horizontal</v-icon>
              Swap Time
            </v-btn>
          </v-card-actions>
        </v-card>
      </div>

      <!-- Export Button -->
      <div class="export-section">
        <v-btn
          size="large"
          color="deep-purple-accent-2"
          variant="outlined"
          rounded="xl"
          @click="exportToCalendar"
          class="export-btn"
        >
          <v-icon left class="mr-2">mdi-calendar-export</v-icon>
          Export to Calendar
        </v-btn>
      </div>
    </div>

    <!-- Swap Time Dialog -->
    <v-dialog v-model="showSwapDialog" max-width="700px">
      <v-card color="rgba(18, 18, 18, 0.98)" rounded="xl">
        <v-card-title class="dialog-title">
          <div class="dialog-title-section">
            <v-icon size="28" color="deep-purple-accent-2" class="mr-2">mdi-swap-horizontal</v-icon>
            <span>Select Alternative Time</span>
          </div>
          <v-btn icon="mdi-close" variant="text" @click="showSwapDialog = false"></v-btn>
        </v-card-title>

        <v-card-text v-if="swapDialogData" class="dialog-content">
          <div class="swap-current-info">
            <div class="swap-date">{{ swapDialogData.dayOfWeek }}, {{ formatDateFromString(swapDialogData.date, 'long') }}</div>
            <div class="swap-current-time">Current: {{ swapDialogData.bestTimeFormatted }}</div>
          </div>

          <div class="swap-alternatives-grid">
            <v-card
              v-for="(timeData, index) in (swapDialogData.allSortedTimes || []).filter((t: any) => t.formatted !== swapDialogData.bestTimeFormatted)"
              :key="index"
              class="swap-alt-card glass-effect"
              variant="outlined"
              color="deep-purple-accent-2"
              rounded="lg"
              hover
              @click="selectAlternativeTime(timeData.formatted)"
            >
              <v-card-text class="swap-alt-content">
                <div class="swap-alt-time">{{ timeData.formatted }}</div>
                <div class="swap-alt-details">
                  <div class="swap-detail-row">
                    <v-icon size="14" color="deep-purple-accent-2">mdi-washing-machine</v-icon>
                    <span>{{ timeData.washers }}</span>
                  </div>
                  <div class="swap-detail-row">
                    <v-icon size="14" color="deep-purple-accent-2">mdi-tumble-dryer</v-icon>
                    <span>{{ timeData.dryers }}</span>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </div>
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="deep-purple-accent-2" variant="outlined" @click="showSwapDialog = false">Cancel</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.schedule-container {
  min-height: 100vh;
  background: linear-gradient(135deg, rgba(179, 136, 255, 0.05) 0%, rgba(74, 20, 140, 0.02) 100%);
  padding-bottom: 80px;
}

/* Header Styles */
.header-section {
  padding: 2rem 1rem;
  background: linear-gradient(135deg, rgba(179, 136, 255, 0.1) 0%, rgba(74, 20, 140, 0.05) 100%);
  backdrop-filter: blur(20px);
  margin-bottom: 2rem;
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
}

.title-section {
  text-align: center;
}

.page-title {
  font-family: 'Oxanium', sans-serif;
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.title-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  background: rgba(179, 136, 255, 0.1);
  border-radius: 16px;
  border: 1px solid rgba(179, 136, 255, 0.2);
}

.page-subtitle {
  font-family: 'Oxanium', sans-serif;
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.6);
  margin: 0.5rem 0 0 0;
}

/* Input Section with 2x2 Grid */
.input-section {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.input-grid-top-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.input-grid-full-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.input-card {
  backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.02) !important;
  border: 1px solid rgba(179, 136, 255, 0.2);
}

.card-title {
  font-family: 'Oxanium', sans-serif;
  font-size: 1.1rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
}

.card-content {
  padding: 1.5rem !important;
}

/* Frequency Card */
.frequency-label {
  font-family: 'Oxanium', sans-serif;
  font-size: 1.3rem;
  font-weight: 600;
  color: #B388FF;
  text-align: center;
}

.frequency-presets {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 1rem;
}

/* Hall Toggle */
.hall-toggle {
  width: 100%;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px !important;
  padding: 4px;
}

.hall-btn {
  font-family: 'Oxanium', sans-serif;
  flex: 1;
}

/* Time Availability */
.day-toggles {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

/* Generate Section */
.generate-section {
  display: flex;
  justify-content: center;
  margin: 2rem 0;
}

.generate-btn {
  font-family: 'Oxanium', sans-serif;
  font-size: 1.1rem;
  text-transform: none;
  letter-spacing: 0.5px;
}

/* Results Section */
.results-section {
  max-width: 1200px;
  margin: 2rem auto;
  padding: 0 1rem;
}

.summary-card {
  backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.02) !important;
  border: 1px solid rgba(179, 136, 255, 0.3);
  margin-bottom: 2rem;
}

.summary-content {
  display: flex;
  justify-content: space-around;
  gap: 2rem;
  padding: 1.5rem !important;
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.summary-label {
  font-family: 'Oxanium', sans-serif;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.6);
}

.summary-value {
  font-family: 'Oxanium', sans-serif;
  font-size: 2rem;
  font-weight: 700;
  color: #B388FF;
}

.schedule-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.schedule-card {
  backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.02) !important;
  border: 1px solid rgba(179, 136, 255, 0.2);
  animation: cardEntrance 0.5s ease-out;
}

@keyframes cardEntrance {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.schedule-card-title {
  background: linear-gradient(135deg, rgba(179, 136, 255, 0.15) 0%, rgba(74, 20, 140, 0.1) 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem !important;
}

.schedule-day {
  font-family: 'Oxanium', sans-serif;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

.schedule-date {
  font-family: 'Oxanium', sans-serif;
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
}

.schedule-card-content {
  padding: 1.5rem !important;
}

.best-time {
  font-family: 'Oxanium', sans-serif;
  font-size: 2rem;
  font-weight: 700;
  color: #B388FF;
  text-align: center;
  margin-bottom: 1rem;
}

.availability-bars {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.availability-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.availability-bar {
  flex: 1;
}

.availability-count {
  font-family: 'Oxanium', sans-serif;
  color: rgba(255, 255, 255, 0.8);
  min-width: 30px;
  text-align: right;
  font-weight: 600;
}

.alternative-times {
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 0.85rem;
}

.alt-label {
  color: rgba(255, 255, 255, 0.6);
  display: block;
  margin-bottom: 0.25rem;
}

.alt-times {
  color: rgba(255, 255, 255, 0.8);
}

/* Export Section */
.export-section {
  display: flex;
  justify-content: center;
}

.export-btn {
  font-family: 'Oxanium', sans-serif;
  font-size: 1rem;
  text-transform: none;
  letter-spacing: 0.5px;
}

/* Dialog Styles */
.dialog-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem !important;
  border-bottom: 1px solid rgba(179, 136, 255, 0.2);
}

.dialog-title-section {
  display: flex;
  align-items: center;
  font-family: 'Oxanium', sans-serif;
  font-size: 1.3rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.dialog-content {
  padding: 1.5rem !important;
  max-height: 60vh;
  overflow-y: auto;
}

/* Inline Day Time Selection Styles */
.day-time-inline-container {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem 0;
}

.days-chips-row {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.chips-spacer {
  display: none;
}

.day-chip {
  cursor: pointer;
  min-width: 45px;
  flex: 1;
}

.sliders-row {
  display: flex;
  gap: 1rem;
  min-height: 140px;
  align-items: center;
}

.time-axis {
  display: none;
}

.time-label {
  position: absolute;
  font-family: 'Oxanium', sans-serif;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
  transform: translateY(-50%);
  white-space: nowrap;
}

.days-slider-grid {
  display: flex;
  gap: 0.75rem;
  flex: 1;
  justify-content: space-around;
}

.day-slider-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.vertical-slider-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  height: 140px;
}

.vertical-slider {
  height: 140px !important;
  width: 30px;
}

.time-ranges-row {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-top: 12rem;
}

.ranges-spacer {
  display: none;
}

.time-range-cell {
  flex: 1;
  min-width: 0;
  text-align: center;
}

.time-range-display {
  font-family: 'Oxanium', sans-serif;
  font-size: 0.75rem;
  color: #B388FF;
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
}

.glass-effect {
  backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.05);
}

/* Algorithm Preference Styles */
.algorithm-toggle {
  width: 100%;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.algorithm-btn {
  flex: 1;
  min-width: 200px;
}

.algorithm-btn-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  text-align: center;
}

.algorithm-title {
  font-family: 'Oxanium', sans-serif;
  font-size: 1rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.algorithm-desc {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.2;
}

/* Swap Dialog Styles */
.swap-current-info {
  text-align: center;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: rgba(179, 136, 255, 0.1);
  border-radius: 12px;
  border: 1px solid rgba(179, 136, 255, 0.2);
}

.swap-date {
  font-family: 'Oxanium', sans-serif;
  font-size: 1.2rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 0.5rem;
}

.swap-current-time {
  font-size: 1rem;
  color: #B388FF;
  font-weight: 600;
}

.swap-alternatives-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.swap-alt-card {
  cursor: pointer;
}

.swap-alt-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem !important;
}

.swap-alt-time {
  font-family: 'Oxanium', sans-serif;
  font-size: 1.1rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 0.25rem;
}

.swap-alt-details {
  display: flex;
  gap: 1rem;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
}

.swap-detail-row {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

/* Responsive */
@media (max-width: 768px) {
  .input-grid-top-row {
    grid-template-columns: 1fr;
  }

  .schedule-grid {
    grid-template-columns: 1fr;
  }

  .summary-content {
    flex-direction: column;
    gap: 1rem;
  }

  .days-chips-row {
    flex-wrap: wrap;
  }

  .chips-spacer {
    display: none;
  }

  .day-chip {
    flex: 0 0 calc(25% - 0.75rem);
  }

  .sliders-row {
    min-height: 120px;
  }

  .time-axis {
    display: none;
  }

  .days-slider-grid {
    gap: 0.5rem;
  }

  .vertical-slider-container {
    height: 100%;
  }

  .vertical-slider {
    height: 120px !important;
  }

  .time-ranges-row {
    flex-wrap: wrap;
  }

  .ranges-spacer {
    display: none;
  }

  .time-range-cell {
    flex: 0 0 calc(25% - 0.75rem);
  }

  .time-range-display {
    font-size: 0.6rem;
  }

  .algorithm-toggle {
    flex-direction: column;
  }

  .algorithm-btn {
    min-width: 100%;
  }

  .swap-alternatives-grid {
    grid-template-columns: 1fr;
  }
}
</style>
