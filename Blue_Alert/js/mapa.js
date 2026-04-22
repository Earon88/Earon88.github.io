// Crear mapa centrado
var map = L.map('map').setView([ -35.5, -72.66 ], 8);

// Definir capas base
var satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
  maxZoom: 19
});

var streetsLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19
});

streetsLayer.addTo(map);
document.getElementById('streets-btn').classList.add('active');

// Configuración de GitHub
const GITHUB_BASE_URL = 'https://raw.githubusercontent.com/Earon88/Earon88.github.io/main/Blue_Alert/datos';

// Cache de datos por año
let dataCache = {};
let filteredLayer = null;
let canopyLayerVisible = true;
let playbackInterval = null;
let isPlaying = false;
let allYearqtrs = [];
let yearqtrToYearMap = new Map();
let currentYearLoaded = null;

// Función para mostrar mensajes de error
function showErrorMessage(message) {
  let errorDiv = document.getElementById('error-message');
  if (!errorDiv) {
    errorDiv = document.createElement('div');
    errorDiv.id = 'error-message';
    errorDiv.className = 'fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-pulse';
    document.body.appendChild(errorDiv);
  }
  errorDiv.innerHTML = `<i class="fas fa-exclamation-circle mr-2"></i>${message}`;
  errorDiv.style.display = 'block';
  
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000);
}

// Función para cargar un año específico desde GitHub
async function loadYearData(year) {
  if (dataCache[year]) {
    console.log(`Usando caché para año ${year}`);
    return dataCache[year];
  }
  
  showLoadingIndicator(true);
  
  try {
    const url = `${GITHUB_BASE_URL}/MP_data_${year}.geojson`;
    console.log(`Cargando datos desde: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`No se pudo cargar el archivo para el año ${year}. Status: ${response.status}`);
    }
    
    const data = await response.json();
    dataCache[year] = data;
    console.log(`Año ${year} cargado correctamente. Features: ${data.features.length}`);
    
    return data;
  } catch (error) {
    console.error(`Error cargando año ${year}:`, error);
    showErrorMessage(`No se pudo cargar los datos del año ${year}. Verifica tu conexión.`);
    return null;
  } finally {
    showLoadingIndicator(false);
  }
}

// Función para obtener todos los años disponibles
async function getAvailableYears() {
  // Intentar obtener años desde un archivo de configuración en GitHub
  try {
    const url = `${GITHUB_BASE_URL}/years.json`;
    console.log(`Intentando cargar configuración de años desde: ${url}`);
    const response = await fetch(url);
    
    if (response.ok) {
      const config = await response.json();
      if (config.years && Array.isArray(config.years)) {
        console.log('Años cargados desde configuración:', config.years);
        return config.years;
      }
    }
  } catch (error) {
    console.warn('No se pudo cargar years.json, usando lista hardcodeada');
  }
  
  // Lista hardcodeada como fallback
  return [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
}

// Función para construir la lista de trimestres (versión optimizada)
async function buildYearqtrsList() {
  const years = await getAvailableYears();
  const allYearqtrsSet = new Set();
  
  showLoadingIndicator(true);
  
  for (const year of years) {
    try {
      const url = `${GITHUB_BASE_URL}/MP_data_${year}.geojson`;
      console.log(`Leyendo año ${year} para extraer trimestres...`);
      
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`No se pudo leer el año ${year}`);
        continue;
      }
      
      const data = await response.json();
      
      data.features.forEach(feature => {
        const yearqtr = feature.properties.yearqtr;
        if (yearqtr) {
          allYearqtrsSet.add(yearqtr);
          yearqtrToYearMap.set(yearqtr, year);
        }
      });
      
      console.log(`Año ${year}: encontrados ${data.features.length} features`);
      
    } catch (error) {
      console.error(`Error leyendo año ${year}:`, error);
    }
  }
  
  const allYearqtrsList = Array.from(allYearqtrsSet).sort();
  console.log(`Total de trimestres únicos encontrados: ${allYearqtrsList.length}`);
  console.log('Primeros 5 trimestres:', allYearqtrsList.slice(0, 5));
  console.log('Últimos 5 trimestres:', allYearqtrsList.slice(-5));
  
  showLoadingIndicator(false);
  return allYearqtrsList;
}

// Función para mostrar/ocultar indicador de carga
function showLoadingIndicator(show) {
  let loader = document.getElementById('loading-indicator');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'loading-indicator';
    loader.innerHTML = `
      <div class="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black bg-opacity-75 text-white px-4 py-2 rounded-lg z-50 flex items-center gap-2">
        <i class="fas fa-spinner fa-spin"></i>
        <span>Cargando datos...</span>
      </div>
    `;
    document.body.appendChild(loader);
  }
  loader.style.display = show ? 'flex' : 'none';
}

// Función para actualizar el mapa con un trimestre específico
async function updateMap(yearqtr) {
  if (!yearqtr) {
    console.error('yearqtr es undefined o null');
    return;
  }
  
  console.log(`Buscando datos para trimestre: ${yearqtr}`);
  
  let year = yearqtrToYearMap.get(yearqtr);
  
  if (!year) {
    if (yearqtr.includes('-')) {
      year = parseInt(yearqtr.split('-')[0]);
    } else if (yearqtr.includes(' ')) {
      year = parseInt(yearqtr.split(' ')[0]);
    } else {
      year = parseInt(yearqtr.substring(0, 4));
    }
    console.log(`Año extraído del trimestre: ${year}`);
  }
  
  if (isNaN(year)) {
    console.error('No se pudo determinar el año para:', yearqtr);
    return;
  }
  
  const yearData = await loadYearData(year);
  
  if (!yearData) {
    console.error(`No se pudieron cargar datos para el año ${year}`);
    return;
  }
  
  const filteredFeatures = yearData.features.filter(f => f.properties.yearqtr === yearqtr);
  
  console.log(`Encontrados ${filteredFeatures.length} features para ${yearqtr}`);
  
  if (filteredFeatures.length === 0) {
    console.warn(`No se encontraron datos para ${yearqtr}`);
    return;
  }
  
  if (filteredLayer) {
    map.removeLayer(filteredLayer);
  }
  
  filteredLayer = L.geoJSON({ type: 'FeatureCollection', features: filteredFeatures }, {
    style: function(feature) {
      return { 
        color: 'red', 
        weight: 2, 
        fillOpacity: 0.5,
        fillColor: getColorBasedOnArea(feature.properties.area)
      };
    },
    onEachFeature: function(feature, layer) {
      if (feature.properties) {
        const popupContent = Object.entries(feature.properties)
          .map(([key, value]) => `<b>${key}:</b> ${value}`)
          .join('<br />');
        layer.bindPopup(popupContent);
      }
    }
  }).addTo(map);
  
  updateYearIndicator(year);
  currentYearLoaded = year;
}

// Función para mostrar el año actual
function updateYearIndicator(year) {
  let indicator = document.getElementById('current-year-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'current-year-indicator';
    indicator.className = 'absolute top-4 right-4 bg-white bg-opacity-90 px-3 py-1 rounded-lg shadow-md text-sm font-semibold z-10';
    const mapContainer = document.getElementById('map');
    if (mapContainer && mapContainer.parentElement) {
      mapContainer.parentElement.style.position = 'relative';
      mapContainer.parentElement.appendChild(indicator);
    }
  }
  indicator.innerHTML = `<i class="fas fa-calendar-alt mr-1"></i>Año: ${year}`;
}

// Función para precargar años adyacentes
async function precacheAdjacentYears(currentYear) {
  const years = await getAvailableYears();
  const currentIndex = years.indexOf(currentYear);
  
  const adjacentYears = [];
  if (currentIndex > 0) adjacentYears.push(years[currentIndex - 1]);
  if (currentIndex < years.length - 1) adjacentYears.push(years[currentIndex + 1]);
  
  for (const year of adjacentYears) {
    if (!dataCache[year]) {
      console.log(`Precargando año ${year}...`);
      loadYearData(year);
    }
  }
}

// Inicializar la aplicación
async function initialize() {
  showLoadingIndicator(true);
  
  try {
    allYearqtrs = await buildYearqtrsList();
    
    if (allYearqtrs.length === 0) {
      console.error('No se encontraron trimestres disponibles');
      showErrorMessage('No se pudieron cargar los datos. Verifica tu conexión a Internet.');
      return;
    }
    
    const slider = document.getElementById('yearqtr_slider');
    const sliderValue = document.getElementById('slider-value');
    
    if (!slider || !sliderValue) {
      console.error('No se encontraron los elementos del slider');
      return;
    }
    
    slider.setAttribute('min', 0);
    slider.setAttribute('max', allYearqtrs.length - 1);
    
    const initialIndex = allYearqtrs.length - 1;
    slider.value = initialIndex;
    
    const initialYearqtr = allYearqtrs[initialIndex];
    sliderValue.textContent = `Trimestre: ${initialYearqtr}`;
    
    await updateMap(initialYearqtr);
    
    const initialYear = yearqtrToYearMap.get(initialYearqtr) || parseInt(initialYearqtr.substring(0, 4));
    await precacheAdjacentYears(initialYear);
    
    slider.addEventListener('input', async function() {
      const index = parseInt(this.value);
      const selectedYearQtr = allYearqtrs[index];
      sliderValue.textContent = `Trimestre: ${selectedYearQtr}`;
      
      if (canopyLayerVisible) {
        await updateMap(selectedYearQtr);
        
        const selectedYear = yearqtrToYearMap.get(selectedYearQtr) || parseInt(selectedYearQtr.substring(0, 4));
        if (selectedYear !== currentYearLoaded) {
          await precacheAdjacentYears(selectedYear);
        }
      }
    });
    
  } catch (error) {
    console.error('Error inicializando la aplicación:', error);
    showErrorMessage('Error al inicializar el mapa. Revisa la consola para más detalles.');
  } finally {
    showLoadingIndicator(false);
  }
}

// Función para cambiar entre capas base
function changeBaseLayer(layerType) {
  if (layerType === 'satellite') {
    map.removeLayer(streetsLayer);
    satelliteLayer.addTo(map);
    document.getElementById('satellite-btn')?.classList.add('active');
    document.getElementById('streets-btn')?.classList.remove('active');
  } else {
    map.removeLayer(satelliteLayer);
    streetsLayer.addTo(map);
    document.getElementById('streets-btn')?.classList.add('active');
    document.getElementById('satellite-btn')?.classList.remove('active');
  }
}

// Función para mostrar/ocultar la capa de dosel flotante
function toggleCanopyLayer() {
  canopyLayerVisible = !canopyLayerVisible;
  const canopyBtn = document.getElementById('canopy-btn');
  
  if (canopyLayerVisible) {
    const slider = document.getElementById('yearqtr_slider');
    if (slider) {
      const index = parseInt(slider.value);
      if (allYearqtrs[index]) {
        updateMap(allYearqtrs[index]);
      }
    }
    canopyBtn?.classList.add('active');
  } else {
    if (filteredLayer) {
      map.removeLayer(filteredLayer);
      filteredLayer = null;
    }
    canopyBtn?.classList.remove('active');
  }
}

// Función para reproducir/pausar la animación
function togglePlayback() {
  const playBtn = document.getElementById('play-btn');
  const slider = document.getElementById('yearqtr_slider');
  const speedSelect = document.getElementById('speed-select');
  
  if (!slider) return;
  
  if (isPlaying) {
    clearInterval(playbackInterval);
    if (playBtn) playBtn.innerHTML = '<i class="fas fa-play text-xs ml-1"></i>';
    isPlaying = false;
  } else {
    const speed = speedSelect ? parseInt(speedSelect.value) : 1000;
    playbackInterval = setInterval(() => {
      let currentValue = parseInt(slider.value);
      if (currentValue >= allYearqtrs.length - 1) {
        currentValue = 0;
      } else {
        currentValue++;
      }
      slider.value = currentValue;
      slider.dispatchEvent(new Event('input'));
    }, speed);
    
    if (playBtn) playBtn.innerHTML = '<i class="fas fa-pause text-xs"></i>';
    isPlaying = true;
  }
}

// Función para asignar colores según el área
function getColorBasedOnArea(area) {
  if (area > 10000) return '#800026';
  if (area > 5000) return '#BD0026';
  if (area > 2000) return '#E31A1C';
  if (area > 1000) return '#FC4E2A';
  return '#FFEDA0';
}

// Event listeners con verificación de existencia
document.getElementById('satellite-btn')?.addEventListener('click', () => changeBaseLayer('satellite'));
document.getElementById('streets-btn')?.addEventListener('click', () => changeBaseLayer('streets'));
document.getElementById('canopy-btn')?.addEventListener('click', () => toggleCanopyLayer());
document.getElementById('play-btn')?.addEventListener('click', () => togglePlayback());

document.getElementById('speed-select')?.addEventListener('change', function() {
  if (isPlaying) {
    clearInterval(playbackInterval);
    togglePlayback();
    togglePlayback();
  }
});

document.getElementById('layer-toggle')?.addEventListener('click', function() {
  const layerPanel = document.getElementById('layer-panel');
  const chevron = document.getElementById('layer-chevron');
  
  if (layerPanel && chevron) {
    if (layerPanel.classList.contains('hidden')) {
      layerPanel.classList.remove('hidden');
      chevron.classList.remove('fa-chevron-down');
      chevron.classList.add('fa-chevron-up');
    } else {
      layerPanel.classList.add('hidden');
      chevron.classList.remove('fa-chevron-up');
      chevron.classList.add('fa-chevron-down');
    }
  }
});

// Iniciar la aplicación
initialize();

// Modal de bienvenida
document.addEventListener('DOMContentLoaded', function() {
  const modal = document.getElementById('welcome-modal');
  const closeButton = document.getElementById('close-modal');
  const acceptButton = document.getElementById('accept-modal');
  const showAtStartupCheckbox = document.getElementById('welcome-show-at-startup');
  const toggleBg = document.querySelector('.toggle-bg');
  const toggleDot = document.querySelector('.toggle-dot');
  
  if (!modal) return;
  
  let showWelcome = localStorage.getItem('showWelcome');
  if (showWelcome === null) {
    showWelcome = true;
    localStorage.setItem('showWelcome', 'true');
  } else {
    showWelcome = showWelcome === 'true';
  }
  
  if (showAtStartupCheckbox) {
    showAtStartupCheckbox.checked = showWelcome;
  }
  
  if (showWelcome && toggleBg && toggleDot) {
    toggleBg.classList.add('bg-teal-500');
    toggleDot.classList.add('transform', 'translate-x-4');
  } else if (toggleBg) {
    toggleBg.classList.add('bg-gray-300');
  }
  
  if (showWelcome) {
    setTimeout(() => {
      if (modal) modal.classList.remove('hidden');
    }, 1000);
  }
  
  function closeModal() {
    if (modal) modal.classList.add('hidden');
    if (showAtStartupCheckbox) {
      localStorage.setItem('showWelcome', showAtStartupCheckbox.checked.toString());
    }
  }
  
  closeButton?.addEventListener('click', closeModal);
  acceptButton?.addEventListener('click', closeModal);
  
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      closeModal();
    }
  });
  
  showAtStartupCheckbox?.addEventListener('change', function() {
    if (toggleBg && toggleDot) {
      if (this.checked) {
        toggleBg.classList.remove('bg-gray-300');
        toggleBg.classList.add('bg-teal-500');
        toggleDot.classList.add('transform', 'translate-x-4');
      } else {
        toggleBg.classList.remove('bg-teal-500');
        toggleBg.classList.add('bg-gray-300');
        toggleDot.classList.remove('transform', 'translate-x-4');
      }
    }
  });
});
