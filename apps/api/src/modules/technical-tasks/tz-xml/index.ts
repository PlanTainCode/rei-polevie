/**
 * Публичный вход модуля tz-xml: модель задания на инженерные изыскания,
 * справочники схемы, значения по умолчанию, проверка и сборка XML.
 *
 * Модуль не зависит от Nest и Node — его же использует веб-клиент через alias.
 */

export * from './model';
export * from './dictionaries';
export * from './defaults';
export * from './blocks';
export * from './validate';
export * from './build-xml';
export * from './crc32';
export * from './company';
