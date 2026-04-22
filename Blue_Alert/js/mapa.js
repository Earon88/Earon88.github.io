// Crear mapa centrado
var map = L.map('map').setView([ -35.5, -72.66 ], 8); // Santiago, Chile

// Definir capas base
var satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
  maxZoom: 19
});

var streetsLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19
});

// Añadir capa de calles por defecto
streetsLayer.addTo(map);
document.getElementById('streets-btn').classList.add('active');

// Variables para almacenar los datos del GeoJSON
let geojsonData = null;
let filteredLayer = null;
let canopyLayerVisible = true;
let playbackInterval = null;
let isPlaying = false;
let yearqtrs = [];

// Cargar GeoJSON
fetch('datos/MP_data.geojson')
  .then(response => response.json())
  .then(data => {
    geojsonData = data;
    
    // Obtener valores únicos de trimestre (yearqtr) del GeoJSON
    yearqtrs = [...new Set(data.features.map(f => f.properties.yearqtr))].sort();
    const slider = document.getElementById('yearqtr_slider');
    const sliderValue = document.getElementById('slider-value');
    
    // Configurar el slider
    slider.setAttribute('min', 0);
    slider.setAttribute('max', yearqtrs.length - 1);
    slider.value = yearqtrs.length - 1; // Última posición

     const lastIndex = yearqtrs.length - 1;
     sliderValue.textContent = `Trimestre: ${yearqtrs[lastIndex]}`;
       updateMap(yearqtrs[lastIndex]); // Mostrar último trimestre
    
    // Mostrar el primer trimestre por defecto|
    updateMap(yearqtrs[0]);
    
    // Event listener para el slider
    slider.addEventListener('input', function() {
      const index = parseInt(this.value);
      const selectedYearQtr = yearqtrs[index];
      sliderValue.textContent = `Trimestre: ${selectedYearQtr}`;
      
      // Actualizar el mapa solo si la capa de dosel está visible
      if (canopyLayerVisible) {
        updateMap(selectedYearQtr);
      }
    });
  })
  .catch(error => console.error('Error loading GeoJSON:', error));

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
    // Mostrar la capa
    const slider = document.getElementById('yearqtr_slider');
    const index = parseInt(slider.value);
    updateMap(yearqtrs[index]);
    canopyBtn.classList.add('active');
  } else {
    // Ocultar la capa
    if (filteredLayer) {
      map.removeLayer(filteredLayer);
      filteredLayer = null;
    }
    canopyBtn.classList.remove('active');
  }
}

// Función para reproducir/pausar la animación de trimestres
function togglePlayback() {
  const playBtn = document.getElementById('play-btn');
  const slider = document.getElementById('yearqtr_slider');
  const speedSelect = document.getElementById('speed-select');
  
  if (isPlaying) {
    // Pausar la reproducción
    clearInterval(playbackInterval);
    playBtn.innerHTML = '<i class="fas fa-play text-xs ml-1"></i>';
    isPlaying = false;
  } else {
    // Iniciar la reproducción
    const speed = parseInt(speedSelect.value);
    playbackInterval = setInterval(() => {
      let currentValue = parseInt(slider.value);
      if (currentValue >= yearqtrs.length - 1) {
        currentValue = 0; // Reiniciar al llegar al final
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

// Event listeners para los botones de cambio de capa
document.getElementById('satellite-btn').addEventListener('click', function() {
  changeBaseLayer('satellite');
});

document.getElementById('streets-btn').addEventListener('click', function() {
  changeBaseLayer('streets');
});

// Event listener para el botón de dosel flotante
document.getElementById('canopy-btn').addEventListener('click', function() {
  toggleCanopyLayer();
});

// Event listener para el botón de reproducción
document.getElementById('play-btn').addEventListener('click', function() {
  togglePlayback();
});

// Event listener para cambio de velocidad
document.getElementById('speed-select').addEventListener('change', function() {
  if (isPlaying) {
    // Reiniciar la reproducción con la nueva velocidad
    clearInterval(playbackInterval);
    togglePlayback(); // Esto lo pausará
    togglePlayback(); // Esto lo reiniciará con la nueva velocidad
  }
});

// Función para mostrar/ocultar el panel de capas
document.getElementById('layer-toggle').addEventListener('click', function() {
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


// Función opcional para asignar colores según el área
function getColorBasedOnArea(area) {
  // Ajusta estos valores según tus datos
  if (area > 10000) return '#800026';
  if (area > 5000) return '#BD0026';
  if (area > 2000) return '#E31A1C';
  if (area > 1000) return '#FC4E2A';
  return '#FFEDA0';
}

// Función para actualizar el mapa con un trimestre específico
function updateMap(yearqtr) {
  // Filtrar características
  const filteredFeatures = geojsonData.features.filter(f => f.properties.yearqtr === yearqtr);
  
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
}

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