// este js file se llama BA_js
// Cargar GeoJSON
fetch('MP_data.geojson')
  .then(response => response.json())
  .then(data => {
    L.geoJSON(data, {
      style: function (feature) {
        return { color: 'yellow', weight: 1, fillOpacity: 0.5 };
      },
      onEachFeature: function (feature, layer) {
        if (feature.properties) {
          layer.bindPopup(Object.keys(feature.properties).map(key => {
            return key + ': ' + feature.properties[key];
          }).join('<br />'));
        }
      }
    }).addTo(map);
  });

  // Suponiendo que ya cargaste el GeoJSON en una variable llamada 'geojsonData'
const slider = document.getElementById('yearqtr_slider');
const sliderValue = document.getElementById('slider-value');

// Obtener valores únicos de trimestre (yearqtr) del GeoJSON
const yearqtrs = [...new Set(geojsonData.features.map(f => f.properties.yearqtr))].sort();
slider.setAttribute('min', 0);
slider.setAttribute('max', yearqtrs.length - 1);

// Capa para los datos filtrados
let filteredLayer = null;

slider.addEventListener('input', function() {
  const index = parseInt(this.value);
  const selectedYearQtr = yearqtrs[index];
  sliderValue.textContent = `Trimestre: ${selectedYearQtr}`;

  // Filtrar características
  const filteredFeatures = geojsonData.features.filter(f => f.properties.yearqtr === selectedYearQtr);

  // Remover capa anterior
  if (filteredLayer) {
    map.removeLayer(filteredLayer);
  }

  // Agregar nueva capa
  filteredLayer = L.geoJSON({ type: 'FeatureCollection', features: filteredFeatures }, {
    style: { color: 'red', weight: 2, fillOpacity: 0.5 }
  }).addTo(map);
});