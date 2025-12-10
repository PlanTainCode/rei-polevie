import { Injectable } from '@nestjs/common';

// Данные для одной точки времени
interface WeatherPoint {
  temperature: number | null;
  windDirection: string | null;
  windSpeed: number | null;
  pressure: number | null;
  humidity: number | null;
  snowDepth: number | null;
}

// Данные для начала и окончания отбора (9:00 и 12:00)
export interface WeatherData {
  temperature: string | null; // "-0.5...0.5"
  wind: string | null; // "СВ, 5.2...С, 6.0"
  pressure: string | null; // "753...755"
  humidity: string | null; // "80...75"
  snowDepth: string | null; // "0...0"
}

interface GeocodingResult {
  latitude: number;
  longitude: number;
  name: string;
}

@Injectable()
export class WeatherService {
  private readonly GEOCODING_API = 'https://geocoding-api.open-meteo.com/v1/search';
  private readonly ARCHIVE_API = 'https://archive-api.open-meteo.com/v1/archive';
  private readonly FORECAST_API = 'https://api.open-meteo.com/v1/forecast';

  /**
   * Получает метеоданные по адресу на указанную дату
   */
  async getWeatherByAddress(address: string, date: Date): Promise<WeatherData | null> {
    try {
      // 1. Геокодируем адрес → координаты
      const coords = await this.geocodeAddress(address);
      if (!coords) {
        console.log(`Weather: Could not geocode address: ${address}`);
        return null;
      }

      console.log(`Weather: Geocoded "${address}" to ${coords.name} (${coords.latitude}, ${coords.longitude})`);

      // 2. Получаем погоду
      const weather = await this.fetchWeather(coords.latitude, coords.longitude, date);
      return weather;
    } catch (error) {
      console.error('Weather: Error fetching weather data:', error);
      return null;
    }
  }

  /**
   * Геокодирует адрес, извлекая город
   */
  private async geocodeAddress(address: string): Promise<GeocodingResult | null> {
    // Извлекаем город из адреса
    const city = this.extractCity(address);
    if (!city) {
      console.log(`Weather: Could not extract city from address: ${address}`);
      return null;
    }

    const url = `${this.GEOCODING_API}?name=${encodeURIComponent(city)}&count=1&language=ru&format=json`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Weather: Geocoding API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data.results || data.results.length === 0) {
      console.log(`Weather: No geocoding results for city: ${city}`);
      return null;
    }

    const result = data.results[0];
    return {
      latitude: result.latitude,
      longitude: result.longitude,
      name: result.name,
    };
  }

  /**
   * Извлекает название города из адреса
   */
  private extractCity(address: string): string | null {
    if (!address) return null;

    // Паттерны для извлечения города
    const patterns = [
      /г\.?\s*([А-Яа-яЁё-]+)/i, // г. Москва, г Москва
      /город\s+([А-Яа-яЁё-]+)/i, // город Москва
      /^([А-Яа-яЁё-]+),/i, // Москва, ул. ...
      /(?:Московская|Ленинградская|Свердловская|Новосибирская|Самарская|Ростовская|Нижегородская|Челябинская|Волгоградская|Краснодарский|Красноярский)\s*(?:обл\.?|область|край)/i,
    ];

    for (const pattern of patterns) {
      const match = address.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Известные города напрямую
    const knownCities = [
      'Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань',
      'Нижний Новгород', 'Челябинск', 'Самара', 'Омск', 'Ростов-на-Дону',
      'Уфа', 'Красноярск', 'Воронеж', 'Пермь', 'Волгоград', 'Краснодар',
      'Саратов', 'Тюмень', 'Тольятти', 'Ижевск', 'Барнаул', 'Ульяновск',
      'Иркутск', 'Хабаровск', 'Ярославль', 'Владивосток', 'Махачкала',
      'Томск', 'Оренбург', 'Кемерово', 'Новокузнецк', 'Рязань', 'Астрахань',
      'Пенза', 'Липецк', 'Тула', 'Киров', 'Чебоксары', 'Калининград',
      'Брянск', 'Курск', 'Иваново', 'Магнитогорск', 'Белгород', 'Сочи',
    ];

    const lowerAddress = address.toLowerCase();
    for (const city of knownCities) {
      if (lowerAddress.includes(city.toLowerCase())) {
        return city;
      }
    }

    // Пробуем первое слово адреса как город
    const firstWord = address.split(/[,\s]/)[0];
    if (firstWord && firstWord.length > 2 && /^[А-Яа-яЁё-]+$/.test(firstWord)) {
      return firstWord;
    }

    return null;
  }

  /**
   * Получает погоду на указанную дату
   */
  private async fetchWeather(lat: number, lon: number, date: Date): Promise<WeatherData> {
    const dateStr = this.formatDate(date);
    const now = new Date();
    const isHistorical = date < now;

    let url: string;
    if (isHistorical) {
      // Исторические данные
      url = `${this.ARCHIVE_API}?latitude=${lat}&longitude=${lon}&start_date=${dateStr}&end_date=${dateStr}&hourly=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,snow_depth&timezone=auto`;
    } else {
      // Прогноз (до 16 дней вперёд)
      url = `${this.FORECAST_API}?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,snow_depth&start_date=${dateStr}&end_date=${dateStr}&timezone=auto`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Weather: API error: ${response.status}`);
      return this.emptyWeather();
    }

    const data = await response.json();
    return this.parseWeatherData(data);
  }

  /**
   * Парсит данные погоды для 9:00 и 12:00, форматирует как "начало...окончание"
   */
  private parseWeatherData(data: any): WeatherData {
    const hourly = data.hourly;
    if (!hourly) {
      return this.emptyWeather();
    }

    // Индексы для 9:00 и 12:00
    const morning = this.extractWeatherPoint(hourly, 9);
    const noon = this.extractWeatherPoint(hourly, 12);

    return {
      temperature: this.formatRange(morning.temperature, noon.temperature),
      wind: this.formatWindRange(morning, noon),
      pressure: this.formatRange(morning.pressure, noon.pressure),
      humidity: this.formatRange(morning.humidity, noon.humidity),
      snowDepth: this.formatRange(morning.snowDepth, noon.snowDepth),
    };
  }

  /**
   * Извлекает данные погоды для конкретного часа
   */
  private extractWeatherPoint(hourly: any, hour: number): WeatherPoint {
    const temperature = hourly.temperature_2m?.[hour] ?? null;
    const humidity = hourly.relative_humidity_2m?.[hour] ?? null;
    const windSpeed = hourly.wind_speed_10m?.[hour] ?? null;
    const windDegrees = hourly.wind_direction_10m?.[hour] ?? null;
    const snowDepth = hourly.snow_depth?.[hour] ?? null;
    
    // Давление: API возвращает в гПа, конвертируем в мм рт.ст.
    const pressureHpa = hourly.surface_pressure?.[hour] ?? null;
    const pressure = pressureHpa !== null ? Math.round(pressureHpa * 0.75006) : null;

    // Конвертируем градусы ветра в направление
    const windDirection = windDegrees !== null ? this.degreesToDirection(windDegrees) : null;

    return {
      temperature: temperature !== null ? Math.round(temperature * 10) / 10 : null,
      windDirection,
      windSpeed: windSpeed !== null ? Math.round(windSpeed * 10) / 10 : null,
      pressure,
      humidity: humidity !== null ? Math.round(humidity) : null,
      snowDepth: snowDepth !== null ? Math.round(snowDepth * 100) / 100 : null,
    };
  }

  /**
   * Форматирует диапазон значений как "начало...окончание"
   */
  private formatRange(start: number | null, end: number | null): string | null {
    if (start === null && end === null) return null;
    if (start === null) return String(end);
    if (end === null) return String(start);
    return `${start}...${end}`;
  }

  /**
   * Форматирует диапазон ветра как "СВ, 5.2...С, 6.0"
   */
  private formatWindRange(morning: WeatherPoint, noon: WeatherPoint): string | null {
    const formatWind = (dir: string | null, speed: number | null): string | null => {
      if (dir === null && speed === null) return null;
      const parts: string[] = [];
      if (dir) parts.push(dir);
      if (speed !== null) parts.push(String(speed));
      return parts.join(', ');
    };

    const morningWind = formatWind(morning.windDirection, morning.windSpeed);
    const noonWind = formatWind(noon.windDirection, noon.windSpeed);

    if (!morningWind && !noonWind) return null;
    if (!morningWind) return noonWind;
    if (!noonWind) return morningWind;
    return `${morningWind}...${noonWind}`;
  }

  /**
   * Конвертирует градусы в направление ветра
   */
  private degreesToDirection(degrees: number): string {
    const directions = ['С', 'ССВ', 'СВ', 'ВСВ', 'В', 'ВЮВ', 'ЮВ', 'ЮЮВ', 'Ю', 'ЮЮЗ', 'ЮЗ', 'ЗЮЗ', 'З', 'ЗСЗ', 'СЗ', 'ССЗ'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private emptyWeather(): WeatherData {
    return {
      temperature: null,
      wind: null,
      pressure: null,
      humidity: null,
      snowDepth: null,
    };
  }
}
