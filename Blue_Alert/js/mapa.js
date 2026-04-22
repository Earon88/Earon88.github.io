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

// Cache de datos por año
let dataCache = {};
let filteredLayer = null;
let canopyLayerVisible = true;
let playbackInterval = null;
let isPlaying = false;
let allYearqtrs = []; // Array con todos los trimestres disponibles
let yearqtrToYearMap = new Map(); // Mapa para saber qué año corresponde a cada yearqtr

// Función para cargar un año específico
async function loadYearData(year) {
  if (dataCache[year]) {
    console.log(`Usando caché para año ${year}`);
    return dataCache[year];
  }
  
  showLoadingIndicator(true);
  
  try {
    console.log(`Cargando datos para el año ${year}...`);
    const response = await fetch(`datos/MP_data_${year}.geojson`);
    
    if (!response.ok) {
      throw new Error(`No se pudo cargar el archivo para el año ${year}`);
    }
    
    const data = await response.json();
    dataCache[year] = data;
    console.log(`Año ${year} cargado correctamente. Features: ${data.features.length}`);
    
    return data;
  } catch (error) {
    console.error(`Error cargando año ${year}:`, error);
    return null;
  } finally {
    showLoadingIndicator(false);
  }
}

// Función para obtener todos los años disponibles
async function getAvailableYears() {
  // Puedes ajustar esta lista según tus años
  return [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
}

// Función para construir la lista de trimestres cargando SOLO el primer año
async function buildYearqtrsList() {
  const years = await getAvailableYears();
  const allYearqtrsList = [];
  
  // Cargar el primer año para obtener la estructura
  const firstYear = years[0];
  const firstYearData = await loadYearData(firstYear);
  
  if (!firstYearData || !firstYearData.features) {
    console.error('No se pudieron cargar los datos del primer año');
    return [];
  }
  
  // Obtener los trimestres únicos del primer año
  const quartersInYear = [...new Set(firstYearData.features.map(f => {
    const yearqtr = f.properties.yearqtr;
    // Extraer solo la parte del trimestre (asumiendo formato "2016-Q1" o "2016 Q1")
    if (yearqtr.includes('-')) {
      return yearqtr.split('-')[1];
    } else if (yearqtr.includes(' ')) {
      return yearqtr.split(' ')[1];
    } else {
      // Si es algo como "2016Q1"
      return yearqtr.substring(4);
    }
  }))].sort();
  
  console.log('Trimestres encontrados en el primer año:', quartersInYear);
  
  // Generar todos los yearqtrs para todos los años
  for (const year of years) {
    for (const quarter of quartersInYear) {
      const yearqtr = `${year}-${quarter}`;
      allYearqtrsList.push(yearqtr);
      yearqtrToYearMap.set(yearqtr, year);
    }
  }
  
  console.log(`Total de trimestres generados: ${allYearqtrsList.length}`);
  console.log('Primeros 5 trimestres:', allYearqtrsList.slice(0, 5));
  console.log('Últimos 5 trimestres:', allYearqtrsList.slice(-5));
  
  return allYearqtrsList;
}

// NUEVA FUNCIÓN: Alternativa más simple - construir la lista cargando TODOS los años
// pero solo extrayendo los yearqtrs sin guardar los datos completos
async function buildYearqtrsListAlt() {
  const years = await getAvailableYears();
  const allYearqtrsSet = new Set();
  
  for (const year of years) {
    try {
      // Cargar solo el archivo para extraer los yearqtrs
      const response = await fetch(`datos/MP_data_${year}.geojson`);
      const data = await response.json();
      
      // Extraer yearqtrs únicos de este año
      data.features.forEach(feature => {
        const yearqtr = feature.properties.yearqtr;
        allYearqtrsSet.add(yearqtr);
        yearqtrToYearMap.set(yearqtr, year);
      });
      
      console.log(`Año ${year}: encontrados ${data.features.length} features`);
      
      // No guardamos en caché todavía para no consumir memoria
    } catch (error) {
      console.error(`Error leyendo año ${year}:`, error);
    }
  }
  
  const allYearqtrsList = Array.from(allYearqtrsSet).sort();
  console.log(`Total de trimestres únicos encontrados: ${allYearqtrsList.length}`);
  console.log('Trimestres:', allYearqtrsList);
  
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
  
  // Obtener el año del mapa o del yearqtr
  let year = yearqtrToYearMap.get(yearqtr);
  
  if (!year) {
    // Si no está en el mapa, extraer del string
    if (yearqtr.includes('-')) {
      year = parseInt(yearqtr.split('-')[0]);
    } else if (yearqtr.includes(' ')) {
      year = parseInt(yearqtr.split(' ')[0]);
    } else {
      year = parseInt(yearqtr.substring(0, 4));
    }
    console.log(`Año extraído del trimestre: ${year}`);
  }
  
  // Cargar los datos del año correspondiente
  const yearData = await loadYearData(year);
  
  if (!yearData) {
    console.error(`No se pudieron cargar datos para el año ${year}`);
    return;
  }
  
  // Filtrar características del trimestre específico
  const filteredFeatures = yearData.features.filter(f => f.properties.yearqtr === yearqtr);
  
  console.log(`Encontrados ${filteredFeatures.length} features para ${yearqtr}`);
  
  if (filteredFeatures.length === 0) {
    console.warn(`No se encontraron datos para ${yearqtr}`);
    // Opcional: mostrar un mensaje en el mapa
    return;
  }
  
  // Remover capa anterior
  if (filteredLayer) {
    map.removeLayer(filteredLayer);
  }
  
  // Agregar nueva capa
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
        layer.bindPopup(Object.keys(feature.properties).map(key => {
          return `<b>${key}:</b> ${feature.properties[key]}`;
        }).join('<br />'));
      }
    }
  }).addTo(map);
  
  // Actualizar el indicador del año actual
  updateYearIndicator(year);
}

// Función opcional para mostrar el año actual
function updateYearIndicator(year) {
  let indicator = document.getElementById('current-year-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'current-year-indicator';
    indicator.className = 'absolute top-4 right-4 bg-white bg-opacity-90 px-3 py-1 rounded-lg shadow-md text-sm font-semibold z-10';
    document.querySelector('.relative').appendChild(indicator);
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
      loadYearData(year); // No esperar a que termine
    }
  }
}

// Inicializar la aplicación
async function initialize() {
  showLoadingIndicator(true);
  
  try {
    // Usar la versión alternativa que lee todos los archivos pero no los guarda en caché
    // Esto es más preciso pero puede ser más lento al inicio
    allYearqtrs = await buildYearqtrsListAlt();
    
    if (allYearqtrs.length === 0) {
      console.error('No se encontraron trimestres disponibles');
      return;
    }
    
    const slider = document.getElementById('yearqtr_slider');
    const sliderValue = document.getElementById('slider-value');
    
    // Configurar el slider
    slider.setAttribute('min', 0);
    slider.setAttribute('max', allYearqtrs.length - 1);
    
    // Mostrar el primer trimestre (más antiguo) o el último
    const initialIndex = allYearqtrs.length - 1; // Último trimestre
    slider.value = initialIndex;
    
    const initialYearqtr = allYearqtrs[initialIndex];
    sliderValue.textContent = `Trimestre: ${initialYearqtr}`;
    
    // Cargar y mostrar el trimestre inicial
    await updateMap(initialYearqtr);
    
    // Precargar años adyacentes
    const initialYear = yearqtrToYearMap.get(initialYearqtr) || parseInt(initialYearqtr.substring(0, 4));
    await precacheAdjacentYears(initialYear);
    
    // Event listener para el slider
    slider.addEventListener('input', async function() {
      const index = parseInt(this.value);
      const selectedYearQtr = allYearqtrs[index];
      sliderValue.textContent = `Trimestre: ${selectedYearQtr}`;
      
      if (canopyLayerVisible) {
        await updateMap(selectedYearQtr);
        
        // Precargar años cercanos
        const selectedYear = yearqtrToYearMap.get(selectedYearQtr) || parseInt(selectedYearQtr.substring(0, 4));
        if (selectedYear !== currentYearLoaded) {
          await precacheAdjacentYears(selectedYear);
        }
      }
    });
    
  } catch (error) {
    console.error('Error inicializando la aplicación:', error);
  } finally {
    showLoadingIndicator(false);
  }
}

// Función para cambiar entre capas base
function changeBaseLayer(layerType) {
  if (layerType === 'satellite') {
    map.removeLayer(streetsLayer);
    satelliteLayer.addTo(map);
    document.getElementById('satellite-btn').classList.add('active');
    document.getElementById('streets-btn').classList.remove('active');
  } else {
    map.removeLayer(satelliteLayer);
    streetsLayer.addTo(map);
    document.getElementById('streets-btn').classList.add('active');
    document.getElementById('satellite-btn').classList.remove('active');
  }
}

// Función para mostrar/ocultar la capa de dosel flotante
function toggleCanopyLayer() {
  canopyLayerVisible = !canopyLayerVisible;
  const canopyBtn = document.getElementById('canopy-btn');
  
  if (canopyLayerVisible) {
    const slider = document.getElementById('yearqtr_slider');
    const index = parseInt(slider.value);
    if (allYearqtrs[index]) {
      updateMap(allYearqtrs[index]);
    }
    canopyBtn.classList.add('active');
  } else {
    if (filteredLayer) {
      map.removeLayer(filteredLayer);
      filteredLayer = null;
    }
    canopyBtn.classList.remove('active');
  }
}

// Función para reproducir/pausar la animación
function togglePlayback() {
  const playBtn = document.getElementById('play-btn');
  const slider = document.getElementById('yearqtr_slider');
  const speedSelect = document.getElementById('speed-select');
  
  if (isPlaying) {
    clearInterval(playbackInterval);
    playBtn.innerHTML = '<i class="fas fa-play text-xs ml-1"></i>';
    isPlaying = false;
  } else {
    const speed = parseInt(speedSelect.value);
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
    
    playBtn.innerHTML = '<i class="fas fa-pause text-xs"></i>';
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

// Event listeners
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
  
  if (layerPanel.classList.contains('hidden')) {
    layerPanel.classList.remove('hidden');
    chevron.classList.remove('fa-chevron-down');
    chevron.classList.add('fa-chevron-up');
  } else {
    layerPanel.classList.add('hidden');
    chevron.classList.remove('fa-chevron-up');
    chevron.classList.add('fa-chevron-down');
  }
});

// Iniciar la aplicación
initialize();

// Modal de bienvenida (mantén tu código existente)
document.addEventListener('DOMContentLoaded', function() {
  // ... tu código del modal aquí ...
});

// Mostrar modal de bienvenida al cargar la página
document.addEventListener('DOMContentLoaded', function() {
  const modal = document.getElementById('welcome-modal');
  const closeButton = document.getElementById('close-modal');
  const acceptButton = document.getElementById('accept-modal');
  const showAtStartupCheckbox = document.getElementById('welcome-show-at-startup');
  const toggleBg = document.querySelector('.toggle-bg');
  const toggleDot = document.querySelector('.toggle-dot');
  
  // Cargar preferencia del usuario
  let showWelcome = localStorage.getItem('showWelcome');
  if (showWelcome === null) {
    showWelcome = true;
    localStorage.setItem('showWelcome', 'true');
  } else {
    showWelcome = showWelcome === 'true';
  }
  
  // Configurar estado inicial del interruptor
  showAtStartupCheckbox.checked = showWelcome;
  if (showWelcome) {
    toggleBg.classList.add('bg-teal-500');
    toggleDot.classList.add('transform', 'translate-x-4');
  } else {
    toggleBg.classList.add('bg-gray-300');
  }
  
  // Mostrar modal solo si está activado
  if (showWelcome) {
    setTimeout(() => {
      modal.classList.remove('hidden');
    }, 1000);
  }
  
  // Configurar evento de cierre
  function closeModal() {
    modal.classList.add('hidden');
    localStorage.setItem('showWelcome', showAtStartupCheckbox.checked.toString());
  }
  
  closeButton.addEventListener('click', closeModal);
  acceptButton.addEventListener('click', closeModal);
  
  // Cerrar modal al hacer clic fuera del contenido
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      closeModal();
    }
  });
  
  // Configurar interruptor
  showAtStartupCheckbox.addEventListener('change', function() {
    if (this.checked) {
      toggleBg.classList.remove('bg-gray-300');
      toggleBg.classList.add('bg-teal-500');
      toggleDot.classList.add('transform', 'translate-x-4');
    } else {
      toggleBg.classList.remove('bg-teal-500');
      toggleBg.classList.add('bg-gray-300');
      toggleDot.classList.remove('transform', 'translate-x-4');
    }
  });
});
