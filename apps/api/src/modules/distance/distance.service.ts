import { Injectable } from '@nestjs/common';

interface Coordinates {
  lat: number;
  lon: number;
}

interface RouteResult {
  distanceKm: number;
  durationMinutes: number;
}

@Injectable()
export class DistanceService {
  // Координаты офиса: ул. Островитянова д.6, Москва
  private readonly OFFICE_COORDS: Coordinates = {
    lat: 55.6443432,
    lon: 37.4906093,
  };

  /**
   * Вычисляет расстояние от офиса до адреса объекта (по маршруту на машине)
   * @param address - адрес объекта
   * @param objectName - название объекта (может содержать более полный адрес)
   * @returns расстояние в км или null если не удалось вычислить
   */
  async getDistanceToAddress(address: string, objectName?: string): Promise<number | null> {
    try {
      // Пробуем разные варианты адреса
      const addressVariants = this.buildAddressVariants(address, objectName);
      
      let objectCoords: Coordinates | null = null;
      
      for (const variant of addressVariants) {
        console.log(`[DistanceService] Пробуем геокодировать: ${variant}`);
        objectCoords = await this.geocodeAddress(variant);
        if (objectCoords) {
          console.log(`[DistanceService] Успешно геокодирован адрес: ${variant}`);
          break;
        }
      }
      
      if (!objectCoords) {
        console.warn(`[DistanceService] Не удалось геокодировать адрес: ${address}`);
        return null;
      }

      // 2. Строим маршрут и получаем расстояние
      const route = await this.getRoute(this.OFFICE_COORDS, objectCoords);
      if (!route) {
        console.warn(`[DistanceService] Не удалось построить маршрут до: ${address}`);
        return null;
      }

      console.log(`[DistanceService] Расстояние до "${address}": ${route.distanceKm} км`);
      return route.distanceKm;
    } catch (error) {
      console.error('[DistanceService] Ошибка при расчёте расстояния:', error);
      return null;
    }
  }

  /**
   * Строит варианты адреса для геокодирования (от более точного к менее точному)
   */
  private buildAddressVariants(address: string, objectName?: string): string[] {
    const variants: string[] = [];
    
    // 1. Пробуем извлечь полный адрес из названия объекта (часто там есть номер дома)
    if (objectName) {
      const addressFromName = this.extractAddressFromObjectName(objectName);
      if (addressFromName) {
        variants.push(addressFromName);
      }
    }
    
    // 2. Оригинальный адрес
    variants.push(address);
    
    // 3. Упрощённый адрес (только улица и город)
    const simplified = this.simplifyAddress(address);
    if (simplified !== address) {
      variants.push(simplified);
    }
    
    return variants;
  }

  /**
   * Извлекает адрес из названия объекта
   * Например: "Жилой дом ... Давыдковская ул., влд.10А" -> "Давыдковская ул., влд.10А, Москва"
   */
  private extractAddressFromObjectName(objectName: string): string | null {
    // Ищем паттерн: улица + номер дома
    const patterns = [
      // "ул. Название, д.XX" или "ул. Название, влд.XX"
      /([А-Яа-яЁё\s-]+(?:ул\.|улица|пер\.|переулок|пр\.|проспект|ш\.|шоссе|бульвар|б-р)[А-Яа-яЁё\s,-]*(?:д\.|дом|влд\.|вл\.|стр\.)\s*[\dА-Яа-я/]+)/i,
      // "Название ул., д.XX"
      /([А-Яа-яЁё\s-]+\s+ул\.[,\s]*(?:д\.|дом|влд\.|вл\.)\s*[\dА-Яа-я/]+)/i,
      // Адрес в скобках после "по адресу:"
      /по адресу[:\s]*([^)]+)/i,
    ];
    
    for (const pattern of patterns) {
      const match = objectName.match(pattern);
      if (match?.[1]) {
        const extracted = match[1].trim().replace(/[,;]+$/, '');
        // Добавляем Москву если не указан город
        if (!extracted.toLowerCase().includes('москв')) {
          return `${extracted}, Москва`;
        }
        return extracted;
      }
    }
    
    return null;
  }

  /**
   * Упрощает адрес для поиска
   */
  private simplifyAddress(address: string): string {
    // Убираем "г.", "р-н" и прочие префиксы
    return address
      .replace(/г\.\s*/gi, '')
      .replace(/р-н\s+[А-Яа-яЁё-]+,?\s*/gi, '')
      .trim();
  }

  /**
   * Геокодирование адреса через Nominatim (OpenStreetMap)
   */
  private async geocodeAddress(address: string): Promise<Coordinates | null> {
    try {
      // Добавляем "Москва" к адресу если не указан город
      const fullAddress = address.toLowerCase().includes('москв') 
        ? address 
        : `${address}, Москва`;

      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('q', fullAddress);
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', '1');
      url.searchParams.set('countrycodes', 'ru');

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'REI-EcoAudit/1.0 (ecological survey application)',
        },
      });

      if (!response.ok) {
        console.warn(`[DistanceService] Nominatim вернул статус ${response.status}`);
        return null;
      }

      const data = await response.json();
      
      if (!Array.isArray(data) || data.length === 0) {
        return null;
      }

      const result = data[0];
      return {
        lat: parseFloat(result.lat),
        lon: parseFloat(result.lon),
      };
    } catch (error) {
      console.error('[DistanceService] Ошибка геокодирования:', error);
      return null;
    }
  }

  /**
   * Построение маршрута через OSRM (Open Source Routing Machine)
   */
  private async getRoute(from: Coordinates, to: Coordinates): Promise<RouteResult | null> {
    try {
      // OSRM публичный сервер (бесплатный, но с ограничениями)
      const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'REI-EcoAudit/1.0 (ecological survey application)',
        },
      });

      if (!response.ok) {
        console.warn(`[DistanceService] OSRM вернул статус ${response.status}`);
        return null;
      }

      const data = await response.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        return null;
      }

      const route = data.routes[0];
      
      return {
        distanceKm: Math.round(route.distance / 100) / 10, // метры в км, округляем до 0.1
        durationMinutes: Math.round(route.duration / 60),
      };
    } catch (error) {
      console.error('[DistanceService] Ошибка построения маршрута:', error);
      return null;
    }
  }
}
