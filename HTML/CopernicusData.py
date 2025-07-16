import copernicusmarine
import xarray as xr
import numpy as np
import pandas as pd

# Dataset 1: Variables fisicas
daily_physics = copernicusmarine.open_dataset(dataset_id="cmems_mod_glo_phy_myint_0.083deg_P1D-m",
                                     username= "eduar.guajardo@gmail.com",
                                     password= "Assamita88",
                                     variables=["thetao", "bottomT", "so", "uo","vo"],
                                     minimum_longitude=-78,
                                     maximum_longitude=-66,
                                     minimum_latitude=-44,
                                     maximum_latitude=-37,
                                     start_datetime="2022-01-01",
                                     end_datetime="2025-01-01",
                                     minimum_depth=0.5,
                                     maximum_depth=50
                                     )
# Lista de variables disponibles
print("Variables disponibles:", list(daily_physics.variables.keys()))
print(daily_physics)

# Dataset 2: Nutrientes (ejemplo: nitrato, fosfato)
daily_nutrients = copernicusmarine.open_dataset(
    dataset_id="cmems_mod_glo_bgc-nut_anfc_0.25deg_P1D-m",
    username="eduar.guajardo@gmail.com",
    password="Assamita88",
    variables=["no3", "po4", "fe", "si"],  # Variables de nutrientes
    minimum_longitude=-78,
    maximum_longitude=-66,
    minimum_latitude=-44,
    maximum_latitude=-37,
    start_datetime="2022-01-01",
    end_datetime="2025-01-01",
    minimum_depth=0.5,
    maximum_depth=50
)
print(daily_nutrients)

# Dataset 3: Fitoplancton (clorofila)
daily_phyto = copernicusmarine.open_dataset(
    dataset_id="cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m",
    username="eduar.guajardo@gmail.com",
    password="Assamita88",
    variables=["chl"],  # Clorofila
    minimum_longitude=-78,
    maximum_longitude=-66,
    minimum_latitude=-44,
    maximum_latitude=-37,
    start_datetime="2022-01-01",
    end_datetime="2025-01-01",
    minimum_depth=0.5,
    maximum_depth=50
)


# Interpolar nutrientes y fitoplancton a 0.083° ---
# Coordenadas de daily_physics como referencia
daily_nutrients_interp = daily_nutrients.interp(
    longitude=daily_physics.longitude,
    latitude=daily_physics.latitude,
    method="linear"  # Interpolación lineal
)

daily_phyto_interp = daily_phyto.interp(
    longitude=daily_physics.longitude,
    latitude=daily_physics.latitude,
    method="linear"
)

# --- 3. Combinar todos los datasets ---
combined_data = xr.merge([
    daily_physics,
    daily_nutrients_interp,
    daily_phyto_interp
])

# --- 4. Promediar la dimensión 'depth'
combined_data_surface = combined_data.mean(dim="depth", keep_attrs=True)

# --- 4. Verificar el resultado ---
print("Dataset:", combined_data_surface)
print("Variables disponibles:", list(combined_data_surface.variables.keys()))

combined_data_surface.to_netcdf("datos_combinados_superficie.nc", 
                               encoding={var: {"zlib": True} for var in combined_data_surface.variables})

# Seleccionar solo las variables numéricas (excluyendo coordenadas y tiempo)
#variables_numericas = ['thetao', 'bottomT', 'so', 'no3', 'po4', 'chl']  # Ajusta según tus variables
#data = df[variables_numericas].dropna()
#print(data)
#data.to_csv("Var_amb.csv")
# Estandarizar los datos (importante para PCA y K-means)
#scaler = StandardScaler()
#data_scaled = scaler.fit_transform(data)