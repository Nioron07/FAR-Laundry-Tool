<script setup lang="ts">
const config = useRuntimeConfig()

// Hall selection
const halls = ref([
  { name: 'Oglesby', value: 0 },
  { name: 'Trelease', value: 1 },
])
const hall = ref(halls.value[0])

// Loading state
const loading = ref(false)
const refreshing = ref(false)
const weekLoading = ref(false)
const weekRefreshing = ref(false)

// Chart data - Day forecast
const chartSeries = ref<any[]>([])
const stats = ref<any>(null)
const chartKey = ref(0)

// Chart data - Week forecast
const weekChartSeries = ref<any[]>([])
const weekStats = ref<any>(null)
const weekChartKey = ref(0)

// Heatmap data
const heatmapSeriesWashers = ref<any[]>([])
const heatmapSeriesDryers = ref<any[]>([])
const heatmapKey = ref(0)

// Date picker dialog
const dateDialog = ref(false)
const selectedDate = ref<string | null>(null)
const dateLoading = ref(false)
const dateChartSeries = ref<any[]>([])
const dateChartKey = ref(0)
const minDate = ref<string | null>(null)

// Chart options matching old design
const chartOptions = ref({
  chart: {
    type: 'area',
    height: 400,
    toolbar: {
      show: true,
      tools: {
        download: true,
        selection: true,
        zoom: true,
        zoomin: true,
        zoomout: true,
        pan: true,
        reset: true,
      },
    },
    background: 'transparent',
    zoom: { enabled: true },
    animations: {
      enabled: true,
      easing: 'easeinout',
      speed: 800,
    },
  },
  forecastDataPoints: {
    count: 0, // Will be updated dynamically based on prediction count
  },
  colors: ['#FFB300', '#FF8F00'],
  stroke: {
    curve: 'smooth',
    width: 2,
  },
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.6,
      opacityTo: 0.1,
      stops: [0, 90, 100],
    },
  },
  dataLabels: { enabled: false },
  grid: {
    borderColor: 'rgba(255, 179, 0, 0.2)',
    strokeDashArray: 3,
  },
  xaxis: {
    type: 'datetime',
    labels: {
      style: {
        fontFamily: 'Oxanium',
        fontSize: '10px',
        colors: '#FFB300',
      },
      format: 'hh:mm TT',
      datetimeUTC: false,
    },
    axisBorder: {
      color: 'rgba(255, 179, 0, 0.3)',
    },
    axisTicks: {
      color: 'rgba(255, 179, 0, 0.3)',
    },
  },
  yaxis: {
    min: 0,
    max: 15,
    title: {
      text: 'Available Machines',
      style: {
        fontFamily: 'Oxanium',
        color: '#FFB300',
        fontSize: '14px',
        fontWeight: 600,
      },
    },
    labels: {
      style: {
        fontFamily: 'Oxanium',
        colors: '#FFB300',
        fontSize: '12px',
      },
    },
  },
  legend: {
    fontFamily: 'Oxanium',
    labels: { colors: ['#FFB300', '#FF8F00'] },
    markers: { strokeWidth: 0, size: 8 },
    position: 'top',
  },
  tooltip: {
    theme: 'dark',
    style: { fontFamily: 'Oxanium' },
    x: {
      format: 'dd MMM hh:mm TT',
    },
  },
  annotations: {
    xaxis: [],
  },
  theme: { mode: 'dark' },
})

// Week chart options (similar to day but with different time format)
const weekChartOptions = ref({
  chart: {
    type: 'area',
    height: 400,
    toolbar: {
      show: true,
      tools: {
        download: true,
        selection: true,
        zoom: true,
        zoomin: true,
        zoomout: true,
        pan: true,
        reset: true,
      },
    },
    background: 'transparent',
    zoom: { enabled: true },
    animations: {
      enabled: true,
      easing: 'easeinout',
      speed: 800,
    },
  },
  forecastDataPoints: {
    count: 0,
  },
  colors: ['#FFB300', '#FF8F00'],
  stroke: {
    curve: 'smooth',
    width: 2,
  },
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.6,
      opacityTo: 0.1,
      stops: [0, 90, 100],
    },
  },
  dataLabels: { enabled: false },
  grid: {
    borderColor: 'rgba(255, 179, 0, 0.2)',
    strokeDashArray: 3,
  },
  xaxis: {
    type: 'datetime',
    labels: {
      style: {
        fontFamily: 'Oxanium',
        fontSize: '10px',
        colors: '#FFB300',
      },
      format: 'dd MMM hh:mm TT',
      datetimeUTC: false,
    },
    axisBorder: {
      color: 'rgba(255, 179, 0, 0.3)',
    },
    axisTicks: {
      color: 'rgba(255, 179, 0, 0.3)',
    },
  },
  yaxis: {
    min: 0,
    max: 15,
    title: {
      text: 'Available Machines',
      style: {
        fontFamily: 'Oxanium',
        color: '#FFB300',
        fontSize: '14px',
        fontWeight: 600,
      },
    },
    labels: {
      style: {
        fontFamily: 'Oxanium',
        colors: '#FFB300',
        fontSize: '12px',
      },
    },
  },
  legend: {
    fontFamily: 'Oxanium',
    labels: { colors: ['#FFB300', '#FF8F00'] },
    markers: { strokeWidth: 0, size: 8 },
    position: 'top',
  },
  tooltip: {
    theme: 'dark',
    style: { fontFamily: 'Oxanium' },
    x: {
      format: 'dd MMM hh:mm TT',
    },
  },
  annotations: {
    xaxis: [],
  },
  theme: { mode: 'dark' },
})

// Heatmap options
const heatmapOptions = ref({
  chart: {
    type: 'heatmap',
    height: 350,
    toolbar: {
      show: false,
    },
    background: 'transparent',
  },
  plotOptions: {
    heatmap: {
      radius: 4,
      enableShades: true,
      shadeIntensity: 0.5,
      colorScale: {
        ranges: [
          { from: 0, to: 3, color: '#F44336', name: 'Very Low' },
          { from: 4, to: 6, color: '#FF9800', name: 'Low' },
          { from: 7, to: 9, color: '#FFC107', name: 'Medium' },
          { from: 10, to: 12, color: '#8BC34A', name: 'Good' },
          { from: 13, to: 15, color: '#4CAF50', name: 'Excellent' },
        ],
      },
    },
  },
  dataLabels: {
    enabled: true,
    style: {
      colors: ['#fff'],
      fontSize: '11px',
      fontFamily: 'Oxanium',
    },
  },
  xaxis: {
    type: 'category',
    categories: Array.from({ length: 24 }, (_, i) => {
      const hour = i % 12 || 12
      const period = i < 12 ? 'AM' : 'PM'
      return `${hour}${period}`
    }),
    labels: {
      style: {
        fontFamily: 'Oxanium',
        fontSize: '10px',
        colors: '#FFB300',
      },
    },
    axisBorder: {
      color: 'rgba(255, 179, 0, 0.3)',
    },
  },
  yaxis: {
    labels: {
      style: {
        fontFamily: 'Oxanium',
        colors: '#FFB300',
        fontSize: '11px',
      },
    },
  },
  legend: {
    show: true,
    position: 'bottom',
    fontFamily: 'Oxanium',
    labels: {
      colors: '#FFB300',
    },
  },
  tooltip: {
    theme: 'dark',
    style: {
      fontFamily: 'Oxanium',
    },
    y: {
      formatter: (value: number) => `${value} available`,
    },
  },
  theme: { mode: 'dark' },
})

// Date picker chart options (similar to day chart)
const dateChartOptions = ref({
  chart: {
    type: 'area',
    height: 400,
    toolbar: {
      show: true,
      tools: {
        download: true,
        selection: true,
        zoom: true,
        zoomin: true,
        zoomout: true,
        pan: true,
        reset: true,
      },
    },
    background: 'transparent',
    zoom: { enabled: true },
    animations: {
      enabled: true,
      easing: 'easeinout',
      speed: 800,
    },
  },
  forecastDataPoints: {
    count: 0,
  },
  colors: ['#FFB300', '#FF8F00'],
  stroke: {
    curve: 'smooth',
    width: 2,
  },
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.6,
      opacityTo: 0.1,
      stops: [0, 90, 100],
    },
  },
  dataLabels: { enabled: false },
  grid: {
    borderColor: 'rgba(255, 179, 0, 0.2)',
    strokeDashArray: 3,
  },
  xaxis: {
    type: 'datetime',
    labels: {
      style: {
        fontFamily: 'Oxanium',
        fontSize: '10px',
        colors: '#FFB300',
      },
      format: 'hh:mm TT',
      datetimeUTC: false,
    },
    axisBorder: {
      color: 'rgba(255, 179, 0, 0.3)',
    },
    axisTicks: {
      color: 'rgba(255, 179, 0, 0.3)',
    },
  },
  yaxis: {
    min: 0,
    max: 15,
    title: {
      text: 'Available Machines',
      style: {
        fontFamily: 'Oxanium',
        color: '#FFB300',
        fontSize: '14px',
        fontWeight: 600,
      },
    },
    labels: {
      style: {
        fontFamily: 'Oxanium',
        colors: '#FFB300',
        fontSize: '12px',
      },
    },
  },
  legend: {
    fontFamily: 'Oxanium',
    labels: { colors: ['#FFB300', '#FF8F00'] },
    markers: { strokeWidth: 0, size: 8 },
    position: 'top',
  },
  tooltip: {
    theme: 'dark',
    style: { fontFamily: 'Oxanium' },
    x: {
      format: 'dd MMM hh:mm TT',
    },
  },
  annotations: {
    xaxis: [],
  },
  theme: { mode: 'dark' },
})

// Fetch forecast data
async function fetchForecast() {
  loading.value = true
  try {
    const response = await $fetch(`${config.public.apiBase}/api/forecast/${hall.value.value}`)

    // Convert timestamps to Central Time consistently
    const parseTimestamp = (timestamp) => {
      const date = new Date(timestamp)
      // Convert to Central Time string then back to Date to normalize
      const centralStr = date.toLocaleString('en-US', { timeZone: 'America/Chicago' })
      return new Date(centralStr).getTime()
    }

    // Prepare data for chart - both washers and dryers on same chart
    const washerHistorical = response.historical.map(item => ({
      x: parseTimestamp(item.timestamp),
      y: item.washers,
    }))

    const washerPredictions = response.predictions.map(item => ({
      x: parseTimestamp(item.timestamp),
      y: item.washers,
    }))

    const dryerHistorical = response.historical.map(item => ({
      x: parseTimestamp(item.timestamp),
      y: item.dryers,
    }))

    const dryerPredictions = response.predictions.map(item => ({
      x: parseTimestamp(item.timestamp),
      y: item.dryers,
    }))

    // Combine historical and predictions into single arrays
    const washerCombined = [...washerHistorical, ...washerPredictions]
    const dryerCombined = [...dryerHistorical, ...dryerPredictions]

    // Update forecast data points count (how many from the end are predictions)
    chartOptions.value.forecastDataPoints.count = washerPredictions.length

    chartSeries.value = [
      {
        name: 'Washers',
        data: washerCombined,
      },
      {
        name: 'Dryers',
        data: dryerCombined,
      },
    ]

    stats.value = response.stats

    // Update x-axis annotations
    updateAnnotations(response)
    chartKey.value++
  }
  catch (error) {
    console.error('Error fetching forecast:', error)
  }
  finally {
    loading.value = false
  }
}

function updateAnnotations(data) {
  const annotations = []

  // Current time annotation - convert to Central Time
  const centralTimeStr = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })
  const centralTime = new Date(centralTimeStr)

  annotations.push({
    x: centralTime.getTime(),
    strokeDashArray: 5,
    borderColor: '#FF5722',
    label: {
      borderColor: '#FF5722',
      style: { color: '#fff', background: '#FF5722', fontFamily: 'Oxanium' },
      text: 'Now',
      orientation: 'horizontal',
    },
  })

  chartOptions.value.annotations.xaxis = annotations
}

async function fetchWeekForecast() {
  weekLoading.value = true
  try {
    const response = await $fetch(`${config.public.apiBase}/api/forecast-week/${hall.value.value}`)

    // Convert timestamps to Central Time consistently
    const parseTimestamp = (timestamp) => {
      const date = new Date(timestamp)
      const centralStr = date.toLocaleString('en-US', { timeZone: 'America/Chicago' })
      return new Date(centralStr).getTime()
    }

    // Prepare data for chart
    const washerHistorical = response.historical.map(item => ({
      x: parseTimestamp(item.timestamp),
      y: item.washers,
    }))

    const washerPredictions = response.predictions.map(item => ({
      x: parseTimestamp(item.timestamp),
      y: item.washers,
    }))

    const dryerHistorical = response.historical.map(item => ({
      x: parseTimestamp(item.timestamp),
      y: item.dryers,
    }))

    const dryerPredictions = response.predictions.map(item => ({
      x: parseTimestamp(item.timestamp),
      y: item.dryers,
    }))

    const washerCombined = [...washerHistorical, ...washerPredictions]
    const dryerCombined = [...dryerHistorical, ...dryerPredictions]

    weekChartOptions.value.forecastDataPoints.count = washerPredictions.length

    weekChartSeries.value = [
      {
        name: 'Washers',
        data: washerCombined,
      },
      {
        name: 'Dryers',
        data: dryerCombined,
      },
    ]

    weekStats.value = response.stats

    // Process heatmap data
    processHeatmapData(response)

    // Update week chart annotations
    updateWeekAnnotations()
    weekChartKey.value++
  }
  catch (error) {
    console.error('Error fetching week forecast:', error)
  }
  finally {
    weekLoading.value = false
  }
}

function processHeatmapData(data) {
  // Combine historical and predictions
  const allData = [...data.historical, ...data.predictions]

  // Parse timestamps to Central Time
  const parseTimestamp = (timestamp) => {
    const date = new Date(timestamp)
    return new Date(date.toLocaleString('en-US', { timeZone: 'America/Chicago' }))
  }

  // Create data structure: { day: { hour: { washers, dryers } } }
  const dataByDayHour = {}

  allData.forEach(item => {
    const date = parseTimestamp(item.timestamp)
    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]
    const hour = date.getHours()

    if (!dataByDayHour[dayName]) {
      dataByDayHour[dayName] = {}
    }

    if (!dataByDayHour[dayName][hour]) {
      dataByDayHour[dayName][hour] = { washers: [], dryers: [] }
    }

    dataByDayHour[dayName][hour].washers.push(item.washers)
    dataByDayHour[dayName][hour].dryers.push(item.dryers)
  })

  // Calculate averages for each day/hour combination
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  // Washers heatmap
  const washersSeries = days.map(day => {
    const hourData = []
    for (let hour = 0; hour < 24; hour++) {
      const values = dataByDayHour[day]?.[hour]?.washers || []
      const avg = values.length > 0
        ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
        : null
      hourData.push(avg)
    }
    return {
      name: day,
      data: hourData,
    }
  })

  // Dryers heatmap
  const dryersSeries = days.map(day => {
    const hourData = []
    for (let hour = 0; hour < 24; hour++) {
      const values = dataByDayHour[day]?.[hour]?.dryers || []
      const avg = values.length > 0
        ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
        : null
      hourData.push(avg)
    }
    return {
      name: day,
      data: hourData,
    }
  })

  heatmapSeriesWashers.value = washersSeries
  heatmapSeriesDryers.value = dryersSeries
  heatmapKey.value++
}

function updateWeekAnnotations() {
  const annotations = []

  // Current time annotation - convert to Central Time
  const centralTimeStr = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })
  const centralTime = new Date(centralTimeStr)

  annotations.push({
    x: centralTime.getTime(),
    strokeDashArray: 5,
    borderColor: '#FF5722',
    label: {
      borderColor: '#FF5722',
      style: { color: '#fff', background: '#FF5722', fontFamily: 'Oxanium' },
      text: 'Now',
      orientation: 'horizontal',
    },
  })

  weekChartOptions.value.annotations.xaxis = annotations
}

async function refreshData() {
  refreshing.value = true
  await fetchForecast()
  refreshing.value = false
}

async function refreshWeekData() {
  weekRefreshing.value = true
  await fetchWeekForecast()
  weekRefreshing.value = false
}

// Date picker functions
function openDatePicker() {
  // Set minimum date to tomorrow
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  const tomorrowStr = tomorrow.toISOString().split('T')[0] || ''
  minDate.value = tomorrowStr

  // Set default selected date to tomorrow
  selectedDate.value = tomorrowStr

  dateDialog.value = true
}

async function fetchDateForecast() {
  if (!selectedDate.value || !hall.value) {
    console.log('No date or hall selected', selectedDate.value, hall.value)
    return
  }

  // Handle different date formats from v-date-picker
  let dateStr: string = selectedDate.value
  const dateValue: any = selectedDate.value

  if (typeof dateValue === 'object') {
    // If it's a Date object
    if (dateValue instanceof Date) {
      const year = dateValue.getFullYear()
      const month = String(dateValue.getMonth() + 1).padStart(2, '0')
      const day = String(dateValue.getDate()).padStart(2, '0')
      dateStr = `${year}-${month}-${day}`
    }
    // If it's an array (some date pickers return arrays)
    else if (Array.isArray(dateValue) && dateValue.length > 0) {
      dateStr = dateValue[0]
    }
  }

  console.log('Fetching forecast for date:', dateStr, 'original:', selectedDate.value)
  dateLoading.value = true
  try {
    const response: any = await $fetch(`${config.public.apiBase}/api/forecast-date/${hall.value.value}/${dateStr}`)

    // Convert timestamps to Central Time consistently
    const parseTimestamp = (timestamp: string) => {
      const date = new Date(timestamp)
      const centralStr = date.toLocaleString('en-US', { timeZone: 'America/Chicago' })
      return new Date(centralStr).getTime()
    }

    // Combine historical and predictions
    const allData = [...response.historical, ...response.predictions]

    const washerData = allData.map((item: any) => ({
      x: parseTimestamp(item.timestamp),
      y: item.washers,
    }))

    const dryerData = allData.map((item: any) => ({
      x: parseTimestamp(item.timestamp),
      y: item.dryers,
    }))

    dateChartOptions.value.forecastDataPoints.count = response.predictions.length

    dateChartSeries.value = [
      {
        name: 'Washers',
        data: washerData,
      },
      {
        name: 'Dryers',
        data: dryerData,
      },
    ]

    dateChartKey.value++
  }
  catch (error) {
    console.error('Error fetching date forecast:', error)
  }
  finally {
    dateLoading.value = false
  }
}

// Watch for selected date changes
watch(selectedDate, () => {
  if (selectedDate.value && dateDialog.value) {
    fetchDateForecast()
  }
})

// Watch for hall changes
watch(hall, () => {
  fetchForecast()
  fetchWeekForecast()
})

// Initial fetch
onMounted(() => {
  fetchForecast()
  fetchWeekForecast()
})
</script>

<template>
  <div class="forecast-container">
    <!-- Header Section -->
    <div class="header-section">
      <div class="header-content">
        <div class="title-section">
          <h1 class="page-title">
            <span class="title-icon">
              <v-icon size="36" color="amber-accent-2">mdi-chart-timeline-variant</v-icon>
            </span>
            Forecasts
          </h1>
        </div>

        <!-- Hall Selector & Date Picker -->
        <div class="header-controls">
          <v-card
            class="selector-card glass-effect"
            variant="outlined"
            color="amber-accent-2"
            rounded="xl"
            elevation="4"
          >
            <v-card-text class="selector-content">
              <div class="selector-label">
                <v-icon size="18" color="amber-accent-2" class="mr-2">mdi-domain</v-icon>
                <span>Hall Selection</span>
              </div>
              <v-btn-toggle
                v-model="hall"
                mandatory
                rounded="xl"
                color="amber-accent-2"
                class="modern-toggle"
              >
                <v-btn
                  v-for="h in halls"
                  :key="h.value"
                  :value="h"
                  class="toggle-btn"
                  variant="outlined"
                >
                  <v-icon left size="16" class="mr-2">mdi-home-variant</v-icon>
                  {{ h.name }}
                </v-btn>
              </v-btn-toggle>
            </v-card-text>
          </v-card>

          <v-btn
            color="amber-accent-2"
            variant="outlined"
            size="large"
            rounded="xl"
            class="date-picker-btn"
            @click="openDatePicker"
          >
            <v-icon left class="mr-2">mdi-calendar-range</v-icon>
            Pick Date
          </v-btn>
        </div>
      </div>
    </div>

    <!-- Main Chart Section -->
    <div class="charts-section">
      <div class="chart-container full-width">
        <v-card
          class="chart-card glass-effect"
          variant="outlined"
          color="amber-accent-2"
          rounded="xl"
          elevation="6"
        >
          <div class="chart-header">
            <div class="chart-title-section">
              <div class="chart-icon">
                <v-icon size="24" color="amber-accent-2">mdi-calendar-today</v-icon>
              </div>
              <div>
                <h3 class="chart-title">Today's Forecast</h3>
                <p class="chart-subtitle">Historical data and predictions for the rest of the day</p>
              </div>
            </div>
            <div class="chart-actions">
              <v-btn
                variant="outlined"
                color="amber-accent-2"
                size="small"
                icon="mdi-refresh"
                @click="refreshData"
                :loading="refreshing"
                class="refresh-btn"
              ></v-btn>
            </div>
          </div>

          <div v-if="loading" class="loading-container">
            <v-progress-circular
              indeterminate
              color="amber-accent-2"
              size="64"
              width="6"
            ></v-progress-circular>
            <p class="loading-text">Generating forecast...</p>
          </div>

          <div v-else class="chart-wrapper">
            <apexchart
              type="area"
              :series="chartSeries"
              :options="chartOptions"
              width="100%"
              height="400"
              :key="chartKey"
            />
          </div>
        </v-card>
      </div>

      <!-- Week Forecast Chart -->
      <div class="chart-container full-width" style="margin-top: 2rem;">
        <v-card
          class="chart-card glass-effect"
          variant="outlined"
          color="amber-accent-2"
          rounded="xl"
          elevation="6"
        >
          <div class="chart-header">
            <div class="chart-title-section">
              <div class="chart-icon">
                <v-icon size="24" color="amber-accent-2">mdi-calendar-week</v-icon>
              </div>
              <div>
                <h3 class="chart-title">Week Forecast</h3>
                <p class="chart-subtitle">Historical data from Monday and predictions until Sunday</p>
              </div>
            </div>
            <div class="chart-actions">
              <v-btn
                variant="outlined"
                color="amber-accent-2"
                size="small"
                icon="mdi-refresh"
                @click="refreshWeekData"
                :loading="weekRefreshing"
                class="refresh-btn"
              ></v-btn>
            </div>
          </div>

          <div v-if="weekLoading" class="loading-container">
            <v-progress-circular
              indeterminate
              color="amber-accent-2"
              size="64"
              width="6"
            ></v-progress-circular>
            <p class="loading-text">Generating week forecast...</p>
          </div>

          <div v-else class="chart-wrapper">
            <apexchart
              type="area"
              :series="weekChartSeries"
              :options="weekChartOptions"
              width="100%"
              height="400"
              :key="weekChartKey"
            />
          </div>
        </v-card>
      </div>

      <!-- Heatmaps -->
      <div class="heatmap-grid" style="margin-top: 2rem;">
        <!-- Washers Heatmap -->
        <div class="chart-container">
          <v-card
            class="chart-card glass-effect"
            variant="outlined"
            color="amber-accent-2"
            rounded="xl"
            elevation="6"
          >
            <div class="chart-header">
              <div class="chart-title-section">
                <div class="chart-icon">
                  <v-icon size="24" color="amber-accent-2">mdi-washing-machine</v-icon>
                </div>
                <div>
                  <h3 class="chart-title">Washers Availability Heatmap</h3>
                  <p class="chart-subtitle">Average availability by day and hour</p>
                </div>
              </div>
            </div>

            <div v-if="weekLoading" class="loading-container">
              <v-progress-circular
                indeterminate
                color="amber-accent-2"
                size="64"
                width="6"
              ></v-progress-circular>
            </div>

            <div v-else class="chart-wrapper">
              <apexchart
                type="heatmap"
                :series="heatmapSeriesWashers"
                :options="heatmapOptions"
                width="100%"
                height="350"
                :key="`washers-${heatmapKey}`"
              />
            </div>
          </v-card>
        </div>

        <!-- Dryers Heatmap -->
        <div class="chart-container">
          <v-card
            class="chart-card glass-effect"
            variant="outlined"
            color="amber-accent-2"
            rounded="xl"
            elevation="6"
          >
            <div class="chart-header">
              <div class="chart-title-section">
                <div class="chart-icon">
                  <v-icon size="24" color="amber-accent-2">mdi-tumble-dryer</v-icon>
                </div>
                <div>
                  <h3 class="chart-title">Dryers Availability Heatmap</h3>
                  <p class="chart-subtitle">Average availability by day and hour</p>
                </div>
              </div>
            </div>

            <div v-if="weekLoading" class="loading-container">
              <v-progress-circular
                indeterminate
                color="amber-accent-2"
                size="64"
                width="6"
              ></v-progress-circular>
            </div>

            <div v-else class="chart-wrapper">
              <apexchart
                type="heatmap"
                :series="heatmapSeriesDryers"
                :options="heatmapOptions"
                width="100%"
                height="350"
                :key="`dryers-${heatmapKey}`"
              />
            </div>
          </v-card>
        </div>
      </div>
    </div>

    <!-- Date Picker Dialog -->
    <v-dialog
      v-model="dateDialog"
      max-width="1500px"
      scrollable
    >
      <v-card
        class="date-dialog-card"
        color="rgba(18, 18, 18, 0.98)"
      >
        <v-card-title class="date-dialog-title">
          <div class="dialog-title-section">
            <div class="dialog-icon-wrapper">
              <v-icon size="32" color="amber-accent-2">mdi-calendar-range</v-icon>
            </div>
            <div>
              <h2 class="dialog-title-text">Custom Date Forecast</h2>
              <p class="dialog-subtitle-text">Select a date to view predicted availability</p>
            </div>
          </div>
          <v-btn
            icon="mdi-close"
            variant="text"
            color="amber-accent-2"
            @click="dateDialog = false"
          ></v-btn>
        </v-card-title>

        <v-card-text class="date-dialog-content">
          <div class="dialog-layout">
            <!-- Left Side: Date Picker -->
            <div class="date-picker-container">
              <v-date-picker
                v-model="selectedDate"
                :min="minDate"
                color="amber-accent-2"
                header-color="amber-accent-2"
                show-adjacent-months
                class="custom-date-picker"
                elevation="0"
              ></v-date-picker>
            </div>

            <!-- Right Side: Chart -->
            <div class="chart-container-dialog">
              <div v-if="!selectedDate" class="empty-state">
                <v-icon size="80" color="rgba(255, 179, 0, 0.3)">mdi-calendar-clock</v-icon>
                <p class="empty-state-text">Select a date to view forecast</p>
              </div>

              <div v-else-if="dateLoading" class="loading-container-dialog">
                <v-progress-circular
                  indeterminate
                  color="amber-accent-2"
                  size="64"
                  width="6"
                ></v-progress-circular>
                <p class="loading-text">Generating forecast...</p>
              </div>

              <div v-else-if="dateChartSeries.length > 0" class="chart-content">
                <div class="selected-date-badge">
                  <v-icon color="amber-accent-2" size="20" class="mr-2">mdi-calendar-check</v-icon>
                  <span class="date-text">{{ new Date(selectedDate || '').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }}</span>
                </div>
                <apexchart
                  type="area"
                  :series="dateChartSeries"
                  :options="dateChartOptions"
                  width="100%"
                  height="365"
                  :key="dateChartKey"
                />
              </div>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.forecast-container {
  min-height: 100vh;
  background: linear-gradient(135deg, rgba(255, 179, 0, 0.05) 0%, rgba(255, 143, 0, 0.02) 100%);
  position: relative;
  padding-bottom: 80px;
}

/* Header Styles */
.header-section {
  padding: 2rem 1rem;
  background: linear-gradient(135deg, rgba(255, 179, 0, 0.1) 0%, rgba(255, 143, 0, 0.05) 100%);
  backdrop-filter: blur(20px);
  margin-bottom: 1rem;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
}

.title-section {
  flex: 1;
}

.page-title {
  font-family: 'Oxanium', sans-serif;
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.title-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  background: rgba(255, 179, 0, 0.1);
  border-radius: 16px;
  border: 1px solid rgba(255, 179, 0, 0.2);
}

.page-subtitle {
  font-family: 'Oxanium', sans-serif;
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.6);
  margin: 0.5rem 0 0 0;
}

/* Header Controls */
.header-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-shrink: 0;
}

.date-picker-btn {
  font-family: 'Oxanium', sans-serif;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0.5px;
  backdrop-filter: blur(20px);
  background: rgba(255, 179, 0, 0.1) !important;
  border: 1px solid rgba(255, 179, 0, 0.3);
}

.selector-card {
  backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 179, 0, 0.3);
}

.selector-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
}

.selector-label {
  display: flex;
  align-items: center;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
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
  text-transform: none;
  letter-spacing: 0.5px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Charts Section */
.charts-section {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 1rem 2rem 1rem;
}

/* Heatmap Grid */
.heatmap-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}

.chart-container {
  width: 100%;
}

.chart-container.full-width {
  width: 100%;
}

.chart-card {
  backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.02) !important;
  border: 1px solid rgba(255, 179, 0, 0.2);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 1.5rem 1rem 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.chart-title-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.chart-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: rgba(255, 179, 0, 0.1);
  border-radius: 12px;
  border: 1px solid rgba(255, 179, 0, 0.2);
}

.chart-title {
  font-family: 'Oxanium', sans-serif;
  font-size: 1.25rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
}

.chart-subtitle {
  font-family: 'Oxanium', sans-serif;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.6);
  margin: 0.25rem 0 0 0;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 1rem;
}

.loading-text {
  color: rgba(255, 255, 255, 0.6);
  font-family: 'Oxanium', sans-serif;
  font-size: 1.1rem;
}

.chart-wrapper {
  padding: 0 1rem 1rem 1rem;
}

/* Glass effect utility */
.glass-effect {
  backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.05);
}

/* Responsive Design */
@media (max-width: 900px) {
  .heatmap-grid {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    text-align: center;
    gap: 1.5rem;
  }

  .title-icon {
    width: 48px;
    height: 48px;
  }

  .title-icon .v-icon {
    font-size: 28px !important;
  }

  .page-title {
    font-size: clamp(1.75rem, 5vw, 2.5rem);
  }

  .charts-section {
    padding: 0 0.5rem 2rem 0.5rem;
  }

  .chart-header {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }

  .chart-icon {
    width: 40px;
    height: 40px;
  }

  .chart-icon .v-icon {
    font-size: 20px !important;
  }

  .chart-title {
    font-size: 1.1rem;
  }

  .chart-subtitle {
    font-size: 0.8rem;
  }

  .header-controls {
    flex-direction: column;
    width: 100%;
  }

  .selector-card {
    width: 100%;
  }

  .date-picker-btn {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .header-section {
    padding: 1.5rem 0.75rem;
  }

  .title-icon {
    width: 40px;
    height: 40px;
  }

  .title-icon .v-icon {
    font-size: 24px !important;
  }

  .page-title {
    font-size: 1.75rem;
  }

  .charts-section {
    padding: 0 0.25rem 1.5rem 0.25rem;
  }

  .chart-header {
    padding: 1rem;
  }

  .chart-icon {
    width: 36px;
    height: 36px;
  }

  .chart-icon .v-icon {
    font-size: 18px !important;
  }

  .chart-title {
    font-size: 1rem;
  }

  .chart-subtitle {
    font-size: 0.75rem;
  }

  .chart-wrapper {
    padding: 0 0.5rem 0.5rem 0.5rem;
  }

  .selector-content {
    padding: 1rem;
    gap: 0.75rem;
  }
}

/* Date Dialog Styles */
.date-dialog-card {
  backdrop-filter: blur(30px);
  border: 1px solid rgba(255, 179, 0, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.date-dialog-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2rem 2rem 1.5rem 2rem;
  border-bottom: 1px solid rgba(255, 179, 0, 0.2);
  background: linear-gradient(135deg, rgba(255, 179, 0, 0.05) 0%, transparent 100%);
}

.dialog-title-section {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.dialog-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  background: rgba(255, 179, 0, 0.15);
  border-radius: 16px;
  border: 1px solid rgba(255, 179, 0, 0.3);
}

.dialog-title-text {
  font-family: 'Oxanium', sans-serif;
  font-size: 1.75rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  margin: 0;
  line-height: 1.2;
}

.dialog-subtitle-text {
  font-family: 'Oxanium', sans-serif;
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.6);
  margin: 0.25rem 0 0 0;
  line-height: 1.3;
}

.date-dialog-content {
  padding: 2rem !important;
}

.dialog-layout {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 2rem;
  min-height: 500px;
}

.date-picker-container {
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.custom-date-picker {
  background: rgba(255, 255, 255, 0.03) !important;
  border-radius: 16px;
  border: 1px solid rgba(255, 179, 0, 0.2);
  overflow: hidden;
}

.chart-container-dialog {
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 179, 0, 0.15);
  border-radius: 16px;
  padding: 1.5rem;
  min-height: 500px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 1rem;
}

.empty-state-text {
  font-family: 'Oxanium', sans-serif;
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
}

.loading-container-dialog {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 1.5rem;
}

.chart-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
}

.selected-date-badge {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  padding: 0.75rem 1.25rem;
  background: linear-gradient(135deg, rgba(255, 179, 0, 0.2) 0%, rgba(255, 179, 0, 0.1) 100%);
  border-radius: 12px;
  font-family: 'Oxanium', sans-serif;
  font-size: 1rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(255, 179, 0, 0.3);
}

.date-text {
  color: rgba(255, 255, 255, 0.95);
}

@media (max-width: 1024px) {
  .dialog-layout {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .date-picker-container {
    justify-content: center;
  }

  .chart-container-dialog {
    min-height: 400px;
  }
}

@media (max-width: 768px) {
  .date-dialog-title {
    padding: 1.5rem 1rem 1rem 1rem;
  }

  .dialog-icon-wrapper {
    width: 48px;
    height: 48px;
  }

  .dialog-icon-wrapper .v-icon {
    font-size: 24px !important;
  }

  .dialog-title-text {
    font-size: 1.5rem;
  }

  .dialog-subtitle-text {
    font-size: 0.85rem;
  }

  .date-dialog-content {
    padding: 1rem !important;
  }

  .dialog-layout {
    gap: 1rem;
  }
}

@media (max-width: 480px) {
  .date-dialog-title {
    padding: 1rem;
  }

  .dialog-title-section {
    gap: 0.75rem;
  }

  .dialog-icon-wrapper {
    width: 40px;
    height: 40px;
  }

  .dialog-icon-wrapper .v-icon {
    font-size: 20px !important;
  }

  .dialog-title-text {
    font-size: 1.25rem;
  }

  .dialog-subtitle-text {
    font-size: 0.8rem;
  }

  .selected-date-badge {
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
  }

  .selected-date-badge .v-icon {
    font-size: 16px !important;
  }
}
</style>
