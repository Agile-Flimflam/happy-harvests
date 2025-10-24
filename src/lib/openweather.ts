// Consolidated: re-export server implementation to avoid duplication.
export type { FetchWeatherOptions } from './openweather.server'
export { fetchWeatherByCoords, fetchForecastForDateByCoords } from './openweather.server'
