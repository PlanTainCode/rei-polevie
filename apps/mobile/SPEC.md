# Полевие Mobile — Техническое задание для Composer

## Контекст проекта

Это Android-приложение (Kotlin + Jetpack Compose) для полевых выездов. Повторяет функционал страницы `/fieldwork` из веб-приложения. Ключевая особенность — **offline-first**: работает без интернета, синхронизирует данные при появлении сети.

### Что уже настроено

Проект в `apps/mobile/` уже содержит полностью рабочую инфраструктуру:

- **Gradle**: проект собирается (`./gradlew assembleLocalDebug`)
- **Hilt**: `PolevieApp.kt` — Application с WorkManager + Hilt
- **Room**: `AppDatabase` + 7 entities + 7 DAOs (projects, platforms, samples, monitorings, monitoring_probes, photos, sync_queue)
- **Retrofit**: `ApiService` + `AuthApiService` — все API-эндпоинты
- **DTO**: все data classes для запросов/ответов API
- **Auth**: `TokenManager` (DataStore) + `AuthInterceptor` (JWT + refresh)
- **Sync**: `SyncWorker` (WorkManager) + `SyncManager` — фоновая синхронизация
- **DI**: `NetworkModule`, `DatabaseModule`, `AppModule`, `SyncModule`
- **Theme**: `PolevieTheme` + цвета (Tailwind-подобная палитра) + типографика Material 3
- **Navigation**: `Routes` объект с маршрутами
- **MainActivity**: заглушка — нужно заменить на навигацию

### Стек

- Kotlin 2.0, Jetpack Compose, Material 3
- Room (SQLite), Retrofit + OkHttp, Hilt, WorkManager
- Coil (изображения), Play Services Location, ExifInterface
- DataStore (токены)

### API

Бэкенд: `BuildConfig.API_BASE_URL` (настроен через flavors).
Авторизация: JWT Bearer в заголовке `Authorization`.

---

## ОБЩИЕ ПРАВИЛА ДЛЯ ВСЕХ ФАЗ

1. **Язык кода**: Kotlin. UI — Jetpack Compose. Стиль — Material 3.
2. **Архитектура**: MVVM. Каждый экран = Screen (Composable) + ViewModel (@HiltViewModel).
3. **Inject**: Все зависимости через конструктор с `@Inject`. ViewModels через `@HiltViewModel`.
4. **Навигация**: Compose Navigation. NavHost в MainActivity.
5. **Данные**: Сначала Room (offline), потом API (при наличии сети). Записи в sync_queue.
6. **Состояние UI**: StateFlow в ViewModel, collectAsStateWithLifecycle() в Composable.
7. **Не создавать новые файлы** сущностей, DAO, API-сервисов, DI — они уже есть.
8. **Файл навигации** `AppNavigation.kt` — уже содержит Routes. Дополнять по необходимости.
9. **Каждый экран** должен адаптироваться под телефоны (320dp-412dp ширина).
10. **Обработка ошибок**: SnackBar при ошибках сети. Нет данных = пустой экран с иконкой и текстом.

---

## ФАЗА 1: Экран логина + поток аутентификации

### Цель
Экран входа по email/пароль. После успешного входа — переход на экран выбора режима.

### Файлы для создания

#### `app/src/main/java/ru/polevie/mobile/ui/login/LoginViewModel.kt`

```kotlin
@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authApiService: AuthApiService,
    private val tokenManager: TokenManager,
) : ViewModel() {
    // Состояния:
    // - email: String
    // - password: String  
    // - isLoading: Boolean
    // - error: String?
    
    // Метод login():
    // 1. Валидация: email не пуст, password не пуст
    // 2. Вызов authApiService.login(LoginRequest(email, password))
    // 3. При успехе: сохранить токены через tokenManager.saveTokens()
    //    + сохранить user через tokenManager.saveUser()
    // 4. При ошибке: показать error
}
```

#### `app/src/main/java/ru/polevie/mobile/ui/login/LoginScreen.kt`

UI:
- Белый фон, вертикальная компоновка по центру
- Заголовок "Полевие" (headlineLarge, цвет primary)
- Подзаголовок "Вход в систему" (bodyLarge, серый)
- Отступ 32dp
- TextField для email (иконка Email, keyboardType = Email)
- TextField для password (иконка Lock, visualTransformation = Password, toggle видимости)
- Отступ 16dp
- Кнопка "Войти" (полноширинная, primary, disabled при isLoading)
- CircularProgressIndicator при загрузке
- Text с ошибкой (красный) при error != null

### Файлы для изменения

#### `MainActivity.kt`
Заменить заглушку на NavHost:

```kotlin
// В setContent:
PolevieTheme {
    val isLoggedIn by tokenManager.isLoggedIn.collectAsState(initial = null)
    
    when (isLoggedIn) {
        null -> { /* splash / loading */ }
        false -> {
            NavHost(navController, startDestination = Routes.LOGIN) {
                composable(Routes.LOGIN) {
                    LoginScreen(onLoginSuccess = {
                        navController.navigate(Routes.MODE_SELECT) {
                            popUpTo(Routes.LOGIN) { inclusive = true }
                        }
                    })
                }
                // ... остальные маршруты добавятся в след. фазах
            }
        }
        true -> {
            NavHost(navController, startDestination = Routes.MODE_SELECT) {
                // все маршруты приложения
            }
        }
    }
}
```

---

## ФАЗА 2: Экран выбора режима + загрузка данных

### Цель
Экран "Объекты / Мониторинги" + начальная синхронизация данных с сервера.

### Файлы для создания

#### `app/src/main/java/ru/polevie/mobile/data/repository/DataSyncRepository.kt`

```kotlin
@Singleton
class DataSyncRepository @Inject constructor(
    private val apiService: ApiService,
    private val projectDao: ProjectDao,
    private val platformDao: PlatformDao,
    private val sampleDao: SampleDao,
    private val monitoringDao: MonitoringDao,
    private val monitoringProbeDao: MonitoringProbeDao,
    private val photoDao: PhotoDao,
) {
    // fetchAllProjects(): загружает все проекты с API и сохраняет в Room
    // fetchAllMonitorings(): загружает все мониторинги с API и сохраняет в Room
    // fetchProjectDetails(projectId): загружает площадки, пробы, фото и сохраняет
    // fetchMonitoringDetails(monitoringId): загружает пробы, фото и сохраняет
    
    // Маппинг DTO -> Entity:
    // ProjectDto -> ProjectEntity (id, name, objectName, objectAddress, status, samplesCount=_count.samples, platformsCount=_count.platforms)
    // PlatformDto -> PlatformEntity
    // SampleDto -> SampleEntity  
    // MonitoringDto -> MonitoringEntity
    // MonitoringProbeDto -> MonitoringProbeEntity
    // PhotoDto -> PhotoEntity
}
```

#### `app/src/main/java/ru/polevie/mobile/ui/modeselect/ModeSelectViewModel.kt`

```kotlin
@HiltViewModel
class ModeSelectViewModel @Inject constructor(
    private val dataSyncRepository: DataSyncRepository,
    private val tokenManager: TokenManager,
    private val syncManager: SyncManager,
) : ViewModel() {
    // Состояния:
    // - isSyncing: Boolean
    // - lastSyncTime: String?
    // - userName: String?
    // - pendingSyncCount: Int (из SyncQueueDao.getPendingCount())
    
    // init: запустить фоновую синхронизацию всех проектов и мониторингов
    // logout(): очистить токены, очистить БД
}
```

#### `app/src/main/java/ru/polevie/mobile/ui/modeselect/ModeSelectScreen.kt`

UI:
- Верхняя панель: имя пользователя слева, кнопка выхода справа
- Индикатор синхронизации (если isSyncing — Loader + "Синхронизация...")
- Бейдж с количеством несинхронизированных изменений (если pendingSyncCount > 0)
- Два больших прямоугольных блока (карточки) по центру:
  1. **"Объекты"** — иконка FolderOpen, подпись "Почва, грунт" → переход на PROJECTS
  2. **"Мониторинги"** — иконка Activity, подпись "Вода, ДО" → переход на MONITORING_LIST
- Карточки: белый фон, скругление 16dp, тень elevation 2dp, padding 24dp
- Внутри: крупная иконка (48dp) сверху, текст заголовка по центру, подзаголовок мелко снизу

---

## ФАЗА 3: Список проектов + карточка проекта

### Файлы для создания

#### `app/src/main/java/ru/polevie/mobile/ui/projects/ProjectsViewModel.kt`

```kotlin
@HiltViewModel  
class ProjectsViewModel @Inject constructor(
    private val projectDao: ProjectDao,
    private val dataSyncRepository: DataSyncRepository,
) : ViewModel() {
    // val projects: StateFlow<List<ProjectEntity>> — из projectDao.getAll()
    // val isLoading: StateFlow<Boolean>
    // fun refresh() — обновить список с API
}
```

#### `app/src/main/java/ru/polevie/mobile/ui/projects/ProjectsScreen.kt`

UI:
- Header: кнопка "Назад" (ChevronLeft), заголовок "Объекты"
- LazyColumn: список проектов
- Каждый элемент (ListItem):
  - Иконка FolderOpen слева (в кружке primary/50)
  - Название проекта (titleMedium, bold)
  - Адрес объекта (bodySmall, серый)
  - Прогресс: "X/Y проб" справа (badge)
  - Шеврон справа (ChevronRight)
- Pull-to-refresh
- Клик → навигация на Routes.project(id)

#### `app/src/main/java/ru/polevie/mobile/ui/projects/ProjectScreen.kt`

```kotlin
// Аргументы: projectId (из навигации)
```

UI:
- Header: "Назад", название проекта
- Карточка с информацией:
  - InfoRow("Адрес", objectAddress)
  - InfoRow("Прогресс", "X из Y проб собрано")
- Две кнопки-карточки:
  1. "Площадки" (иконка Layers) → Routes.platforms(projectId)
  2. "Фотоальбом" (иконка Camera) → Routes.photos(projectId)

#### `app/src/main/java/ru/polevie/mobile/ui/projects/ProjectViewModel.kt`

```kotlin
@HiltViewModel
class ProjectViewModel @Inject constructor(
    private val savedStateHandle: SavedStateHandle,
    private val projectDao: ProjectDao,
    private val sampleDao: SampleDao,
    private val dataSyncRepository: DataSyncRepository,
) : ViewModel() {
    // projectId из savedStateHandle
    // val project: StateFlow<ProjectEntity?>
    // val collectedCount: StateFlow<Int>
    // val totalCount: StateFlow<Int>
    // init: если данных нет в Room — подгрузить с API
}
```

---

## ФАЗА 4: Площадки + карточка площадки (GPS, EXIF, координаты)

### Файлы для создания

#### `app/src/main/java/ru/polevie/mobile/ui/platforms/PlatformsScreen.kt`

UI:
- Header: "Назад", "Площадки"
- LazyColumn: площадки проекта
- ListItem:
  - Иконка MapPin в кружке
  - Метка площадки (label или "ПП-{number}" / "СК-{number}")
  - Подзаголовок: координаты или "Координаты не заданы"
  - Badge с кол-вом проб
  - Зелёная галочка если все пробы собраны
- Клик → Routes.platform(projectId, platformId)

#### `app/src/main/java/ru/polevie/mobile/ui/platforms/PlatformScreen.kt`

UI:
- Header: "Назад", метка площадки
- Секция "Координаты":
  - Если есть: показать широту/долготу + ссылка "Открыть на карте" (intent с URL `https://yandex.ru/maps/?pt={lon},{lat}&z=17&l=map`)
  - Если нет: текст "Координаты не заданы"
  - Три кнопки:
    1. "Моя геолокация" (иконка Crosshair) — использует FusedLocationProviderClient
    2. "Определить по фото (EXIF)" (иконка Camera) — открыть галерею, прочитать EXIF GPS
    3. "Ввести вручную" (иконка Pencil) — два TextField (широта, долгота)
- Секция "Характеристика грунта":
  - Текущая характеристика или "Не задана"
  - Кнопка выбора → PickerDialog с вариантами: глина, суглинок, супесь, песок, торф, ил, гравий, чернозём, насыпной грунт, строительный мусор
- Кнопки действий:
  - "Пробы" → Routes.samples(projectId, platformId)
  - "Отметить все пробы" (зелёная) — если есть неотмеченные пробы
  - "Загрузить фото" — запуск камеры или выбор из галереи

#### `app/src/main/java/ru/polevie/mobile/ui/platforms/PlatformViewModel.kt`

```kotlin
@HiltViewModel
class PlatformViewModel @Inject constructor(
    private val savedStateHandle: SavedStateHandle,
    private val platformDao: PlatformDao,
    private val sampleDao: SampleDao,
    private val syncQueueDao: SyncQueueDao,
    private val dataSyncRepository: DataSyncRepository,
    private val fusedLocationClient: FusedLocationProviderClient,
    private val gson: Gson,
) : ViewModel() {
    // projectId, platformId из savedStateHandle
    // val platform: StateFlow<PlatformEntity?>
    // val samples: StateFlow<List<SampleEntity>>
    
    // updateCoordinates(lat, lon):
    //   1. Обновить в Room: platformDao.updateCoordinates(platformId, lat, lon)
    //   2. Добавить в sync_queue: action="UPDATE_PLATFORM_COORDINATES", 
    //      entityId="$projectId/$platformId", payload=json{latitude, longitude}
    //   3. Вызвать syncManager.triggerImmediate()
    
    // setDescription(description):
    //   1. Обновить в Room
    //   2. Добавить в sync_queue: action="SET_PLATFORM_DESCRIPTION"
    //   3. triggerImmediate()
    
    // collectAllSamples():
    //   1. Room: sampleDao.collectAllByPlatform(platformId)
    //   2. sync_queue: action="COLLECT_PLATFORM_SAMPLES", entityId="$projectId/$platformId"
    //   3. triggerImmediate()
    
    // getCurrentLocation(): использовать fusedLocationClient.lastLocation
    //   Нужно проверить permission ACCESS_FINE_LOCATION
    
    // readExifCoordinates(uri: Uri): прочитать EXIF из фото
    //   Использовать ExifInterface из content resolver input stream
}
```

#### `app/src/main/java/ru/polevie/mobile/util/LocationUtils.kt`

```kotlin
// requestLocationPermission — вспомогательная функция для запроса permission
// getExifCoordinates(context: Context, uri: Uri): Pair<Double, Double>?
//   — открыть InputStream из contentResolver, создать ExifInterface, прочитать latLong
```

---

## ФАЗА 5: Пробы + карточка пробы

### Файлы для создания

#### `app/src/main/java/ru/polevie/mobile/ui/samples/SamplesScreen.kt`

UI:
- Header: "Назад", "Пробы ({метка площадки})"
- Кнопка "Отметить все пробы" сверху (если есть площадка типа ПП)
- Кнопка "Характеристика" — если ПП, показать/изменить характеристику площадки
- LazyColumn: пробы
- ListItem:
  - Иконка Beaker в кружке (зелёный если COLLECTED, серый если PENDING)
  - Шифр пробы (titleMedium)
  - Глубина + характеристика (bodySmall, серый)
  - Статус-badge справа: "Отобрана" (зелёный) / "Ожидает" (серый)
- Клик → Routes.sample(projectId, platformId, sampleId)

#### `app/src/main/java/ru/polevie/mobile/ui/samples/SampleScreen.kt`

UI:
- Header: "Назад", шифр пробы
- Информационные строки:
  - InfoRow("Площадка", метка площадки)
  - InfoRow("Глубина", depthLabel)
  - InfoRow("Масса", mass)
  - InfoRow("Характеристика", description или "Не задана")
  - InfoRow("Статус", status — зелёный для COLLECTED)
- Кнопка выбора характеристики (PickerDialog):
  Варианты: глина, суглинок, супесь, песок, торф, ил, гравий, чернозём, насыпной грунт, строительный мусор
- Кнопка "Отметить как отобранную" (если status != COLLECTED):
  - Зелёная, иконка Check
  - При нажатии: обновить статус в Room + sync_queue (action="COLLECT_SAMPLE", entityId="$projectId/$sampleId")

#### `app/src/main/java/ru/polevie/mobile/ui/samples/SamplesViewModel.kt`

```kotlin
@HiltViewModel
class SamplesViewModel @Inject constructor(
    private val savedStateHandle: SavedStateHandle,
    private val sampleDao: SampleDao,
    private val platformDao: PlatformDao,
    private val syncQueueDao: SyncQueueDao,
    private val syncManager: SyncManager,
    private val gson: Gson,
) : ViewModel() {
    // projectId, platformId из savedStateHandle
    // val samples: StateFlow<List<SampleEntity>>
    // val platform: StateFlow<PlatformEntity?>
    
    // collectSample(sampleId):
    //   1. sampleDao.updateStatus(sampleId, "COLLECTED")
    //   2. sync_queue: action="COLLECT_SAMPLE", entityId="$projectId/$sampleId"
    //   3. syncManager.triggerImmediate()
    
    // updateSampleDescription(sampleId, description):
    //   1. sampleDao.updateDescription(sampleId, description)
    //   2. sync_queue: action="UPDATE_SAMPLE", entityId="$projectId/$sampleId", payload=json{description}
    //   3. syncManager.triggerImmediate()
    
    // collectAllSamples():
    //   1. sampleDao.collectAllByPlatform(platformId)
    //   2. sync_queue: action="COLLECT_PLATFORM_SAMPLES", entityId="$projectId/$platformId"
}
```

---

## ФАЗА 6: Фотоальбом проекта (загрузка, просмотр, голосовое описание)

### Файлы для создания

#### `app/src/main/java/ru/polevie/mobile/ui/photos/PhotosScreen.kt`

UI:
- Header: "Назад", "Фотоальбом"
- Кнопка "Загрузить фото" сверху (иконка Upload)
  - Открывает выбор: "Камера" / "Галерея" (BottomSheet)
  - После выбора фото: сохранить в локальное хранилище приложения, создать запись в PhotoEntity (isUploaded=false), добавить в sync_queue (action="UPLOAD_PROJECT_PHOTO")
- Сетка фото (LazyVerticalGrid, 3 колонки):
  - Thumbnail: если isUploaded — URL `{API_BASE_URL}/projects/{projectId}/photos/{photoId}/thumbnail` (через Coil с Header Authorization)
  - Если не isUploaded — загрузка из localFilePath
  - Внизу миниатюры: иконка описания (если description не пустое)
- Клик по фото → полноэкранный просмотр (диалог/экран):
  - Фото на весь экран (зум жестами)
  - Описание снизу (editable TextField)
  - Кнопка "Сохранить описание" → sync_queue (action="UPDATE_PROJECT_PHOTO")
  - Кнопка "Голосовое описание" (Mic) → запись аудио:
    1. Нажал Mic — запись начинается (MediaRecorder)
    2. Нажал Stop — запись останавливается
    3. Файл сохраняется локально
    4. sync_queue: action="VOICE_DESCRIBE_PROJECT_PHOTO", filePath=путь к аудио

#### `app/src/main/java/ru/polevie/mobile/ui/photos/PhotosViewModel.kt`

```kotlin
@HiltViewModel
class PhotosViewModel @Inject constructor(
    private val savedStateHandle: SavedStateHandle,
    private val photoDao: PhotoDao,
    private val syncQueueDao: SyncQueueDao,
    private val syncManager: SyncManager,
    private val gson: Gson,
    @ApplicationContext private val context: Context,
) : ViewModel() {
    // projectId из savedStateHandle
    // val photos: StateFlow<List<PhotoEntity>>
    
    // addPhoto(uri: Uri, latitude: String?, longitude: String?):
    //   1. Скопировать файл из Uri в app internal storage
    //   2. Создать PhotoEntity с временным id (UUID), localFilePath, isUploaded=false
    //   3. Сохранить в Room: photoDao.insert(entity)
    //   4. sync_queue: action="UPLOAD_PROJECT_PHOTO", entityId="$projectId", 
    //      filePath=localPath, payload=json{latitude, longitude}
    //   5. syncManager.triggerImmediate()
    
    // updateDescription(photoId, description):
    //   1. photoDao.updateDescription(photoId, description)
    //   2. sync_queue: action="UPDATE_PROJECT_PHOTO", entityId="$projectId/$photoId"
    //   3. syncManager.triggerImmediate()
    
    // voiceDescribe(photoId, audioFilePath):
    //   1. sync_queue: action="VOICE_DESCRIBE_PROJECT_PHOTO", entityId="$projectId/$photoId", filePath=audioFilePath
    //   2. syncManager.triggerImmediate()
}
```

#### `app/src/main/java/ru/polevie/mobile/util/AudioRecorderUtil.kt`

```kotlin
// Обёртка над MediaRecorder для записи аудио
// start(outputFile: File): начать запись
// stop(): остановить запись
// release(): освободить ресурсы
// Формат: MediaRecorder.OutputFormat.MPEG_4, AudioEncoder.AAC
```

#### `app/src/main/java/ru/polevie/mobile/util/CoilAuthInterceptor.kt`

```kotlin
// OkHttp Interceptor для Coil: добавляет Authorization header к запросам изображений
// Использовать с ImageLoader.Builder().okHttpClient(...)
// Предоставить через DI как ImageLoader
```

Добавить в `AppModule.kt`:
```kotlin
@Provides @Singleton
fun provideImageLoader(@ApplicationContext context: Context, tokenManager: TokenManager): ImageLoader {
    return ImageLoader.Builder(context)
        .okHttpClient {
            OkHttpClient.Builder()
                .addInterceptor { chain ->
                    val token = runBlocking { tokenManager.getAccessToken() }
                    val request = if (token != null) {
                        chain.request().newBuilder()
                            .header("Authorization", "Bearer $token")
                            .build()
                    } else chain.request()
                    chain.proceed(request)
                }
                .build()
        }
        .build()
}
```

---

## ФАЗА 7: Список мониторингов + карточка мониторинга

### Файлы для создания

#### `app/src/main/java/ru/polevie/mobile/ui/monitorings/MonitoringListScreen.kt`

UI:
- Header: "Назад", "Мониторинги"
- LazyColumn: мониторинги
- ListItem:
  - Иконка Activity в кружке
  - Название мониторинга (titleMedium)
  - Адрес объекта (bodySmall, серый)
  - Badge: кол-во проб
- Клик → Routes.monitoring(id)

#### `app/src/main/java/ru/polevie/mobile/ui/monitorings/MonitoringListViewModel.kt`

```kotlin
@HiltViewModel
class MonitoringListViewModel @Inject constructor(
    private val monitoringDao: MonitoringDao,
    private val dataSyncRepository: DataSyncRepository,
) : ViewModel() {
    // val monitorings: StateFlow<List<MonitoringEntity>>
    // val isLoading: StateFlow<Boolean>
    // fun refresh()
}
```

#### `app/src/main/java/ru/polevie/mobile/ui/monitorings/MonitoringScreen.kt`

UI:
- Header: "Назад", название мониторинга
- Карточка:
  - InfoRow("Объект", objectName)
  - InfoRow("Адрес", objectAddress)
  - InfoRow("Пробы", "${probesCount}")
- Кнопка-карточка: "Точки наблюдения" → Routes.monitoringPoints(id)

#### `app/src/main/java/ru/polevie/mobile/ui/monitorings/MonitoringViewModel.kt`

```kotlin
@HiltViewModel
class MonitoringViewModel @Inject constructor(
    private val savedStateHandle: SavedStateHandle,
    private val monitoringDao: MonitoringDao,
    private val monitoringProbeDao: MonitoringProbeDao,
    private val dataSyncRepository: DataSyncRepository,
) : ViewModel()
```

---

## ФАЗА 8: Точки наблюдения + карточка точки

### Файлы для создания

#### `app/src/main/java/ru/polevie/mobile/ui/monitorings/MonitoringPointsScreen.kt`

UI:
- Header: "Назад", "Точки наблюдения"
- LazyColumn: уникальные точки (по полю `name` в MonitoringProbeEntity)
- ListItem:
  - Иконка MapPin в кружке
  - Название точки
  - Кол-во проб: "Вода: X, ДО: Y"
- Клик → Routes.monitoringPoint(monitoringId, pointName)

#### `app/src/main/java/ru/polevie/mobile/ui/monitorings/MonitoringPointScreen.kt`

Это самый сложный экран. Содержит:

**Секция координат** (как у площадки):
- Показать координаты первой пробы точки
- Кнопки: "Моя геолокация", "По фото (EXIF)", "Вручную"
- При обновлении координат: обновить все пробы этой точки

**Секция "Пробы воды"** (фильтр type="WATER"):
Для каждой пробы воды:
- Название пробы
- Поля:
  - "Объём/тара" — PickerDialog: '2 л/Ст.; 1,5 л/ПЭТ', '1,5 л/ПЭТ', '1 л/Ст.', '0,5 л/Ст.'
  - "Кол-во ёмкостей" — PickerDialog: 1-5
  - "Глубина" — текстовое поле
  - "Температура" — текстовое поле
  - "Характеристика" — PickerDialog: прозрачная, слабо мутная, мутная, с осадком, с запахом, окрашенная, с плёнкой на поверхности, с водорослями
- Кнопка "Отметить" (зелёная) → action="COLLECT_MONITORING_PROBE"

**Секция "Пробы ДО"** (фильтр type="SEDIMENT"):
Для каждой пробы ДО:
- Название пробы
- Поля:
  - "Масса/тара" — PickerDialog: '1 кг/ПЭ', '0,5 кг/ПЭ', '2 кг/ПЭ'
  - "Глубина" — текстовое поле
  - "Примечание" — текстовое поле
  - "Характеристика" — PickerDialog: ил, песок, глина, суглинок, торф, гравий, ракушечник, смешанный грунт
- Кнопка "Отметить" (зелёная)

**Секция "Фото"**:
- Кнопка "Загрузить фото" (аналогично Фазе 6, но через API мониторингов)
- Сетка фото точки
- Голосовое описание

#### `app/src/main/java/ru/polevie/mobile/ui/monitorings/MonitoringPointViewModel.kt`

```kotlin
@HiltViewModel
class MonitoringPointViewModel @Inject constructor(
    private val savedStateHandle: SavedStateHandle,
    private val monitoringProbeDao: MonitoringProbeDao,
    private val photoDao: PhotoDao,
    private val syncQueueDao: SyncQueueDao,
    private val syncManager: SyncManager,
    private val fusedLocationClient: FusedLocationProviderClient,
    private val gson: Gson,
    @ApplicationContext private val context: Context,
) : ViewModel() {
    // monitoringId, pointName из savedStateHandle
    // val waterProbes: StateFlow<List<MonitoringProbeEntity>>
    // val sedimentProbes: StateFlow<List<MonitoringProbeEntity>>
    // val photos: StateFlow<List<PhotoEntity>>
    
    // updateProbe(probeId, UpdateProbeRequest):
    //   1. Обновить в Room
    //   2. sync_queue: action="UPDATE_MONITORING_PROBE", entityId="$monitoringId/$probeId"
    //   3. triggerImmediate()
    
    // collectProbe(probeId):
    //   1. monitoringProbeDao.updateStatus(probeId, "COLLECTED")
    //   2. sync_queue: action="COLLECT_MONITORING_PROBE", entityId="$monitoringId/$probeId"
    
    // updateCoordinates(lat, lon): обновить координаты всех проб точки
    //   Для каждой пробы: 
    //     1. monitoringProbeDao.updateProbeFields(probeId, latitude=lat, longitude=lon)
    //     2. sync_queue: action="UPDATE_MONITORING_PROBE"
    
    // addPhoto(uri, probeId, lat, lon): аналогично фазе 6 для мониторингов
    //   sync_queue: action="UPLOAD_MONITORING_PHOTO", entityId="$monitoringId/$probeId"
}
```

---

## ФАЗА 9: Общие UI компоненты

### Файлы для создания

#### `app/src/main/java/ru/polevie/mobile/ui/components/Header.kt`

```kotlin
@Composable
fun Header(
    title: String,
    onBack: (() -> Unit)? = null,
    actions: @Composable RowScope.() -> Unit = {},
)
```
- TopAppBar Material 3
- NavigationIcon = IconButton(ChevronLeft) если onBack != null
- Title по центру
- actions справа

#### `app/src/main/java/ru/polevie/mobile/ui/components/ListItem.kt`

```kotlin
@Composable
fun FieldListItem(
    icon: ImageVector,
    iconTint: Color = MaterialTheme.colorScheme.primary,
    title: String,
    subtitle: String? = null,
    trailing: @Composable (() -> Unit)? = null,
    onClick: () -> Unit,
)
```
- Row с padding 16dp
- Иконка в кружке (40dp) слева
- Column(title + subtitle) по центру с weight(1f)
- trailing справа
- ChevronRight если trailing == null

#### `app/src/main/java/ru/polevie/mobile/ui/components/InfoRow.kt`

```kotlin
@Composable
fun InfoRow(label: String, value: String?)
```
- Row: label (bodyMedium, серый) — value (bodyMedium, чёрный)
- Если value == null: "—" серым курсивом

#### `app/src/main/java/ru/polevie/mobile/ui/components/ActionButton.kt`

```kotlin
@Composable
fun ActionButton(
    text: String,
    icon: ImageVector? = null,
    isLoading: Boolean = false,
    enabled: Boolean = true,
    color: Color = MaterialTheme.colorScheme.primary,
    onClick: () -> Unit,
)
```
- FilledTonalButton, полная ширина
- Icon + Text, или CircularProgressIndicator при isLoading

#### `app/src/main/java/ru/polevie/mobile/ui/components/PickerDialog.kt`

```kotlin
@Composable
fun PickerDialog(
    title: String,
    options: List<String>,
    selectedOption: String?,
    onSelect: (String) -> Unit,
    onDismiss: () -> Unit,
)
```
- AlertDialog с LazyColumn
- Каждый option — TextButton с RadioButton
- Выбранный отмечен

#### `app/src/main/java/ru/polevie/mobile/ui/components/EmptyState.kt`

```kotlin
@Composable
fun EmptyState(icon: ImageVector, message: String)
```
- Box fillMaxSize, contentAlignment Center
- Column: иконка (64dp, серая) + текст (bodyLarge, серый)

#### `app/src/main/java/ru/polevie/mobile/ui/components/SyncStatusBar.kt`

```kotlin
@Composable
fun SyncStatusBar(pendingCount: Int, isSyncing: Boolean)
```
- Если pendingCount > 0 или isSyncing:
  - Плашка сверху экрана (yellow50 фон, yellow600 текст)
  - "Ожидает синхронизации: N" или "Синхронизация..."

---

## ФАЗА 10: Полная навигация в MainActivity

### Изменения в `MainActivity.kt`

Собрать все экраны в NavHost:

```kotlin
NavHost(navController, startDestination = startDest) {
    composable(Routes.LOGIN) { LoginScreen(onLoginSuccess = { ... }) }
    composable(Routes.MODE_SELECT) { ModeSelectScreen(navController) }
    composable(Routes.PROJECTS) { ProjectsScreen(navController) }
    composable(Routes.PROJECT) { ProjectScreen(navController) }
    composable(Routes.PLATFORMS) { PlatformsScreen(navController) }
    composable(Routes.PLATFORM) { PlatformScreen(navController) }
    composable(Routes.SAMPLES) { SamplesScreen(navController) }
    composable(Routes.SAMPLE) { SampleScreen(navController) }
    composable(Routes.PHOTOS) { PhotosScreen(navController) }
    composable(Routes.MONITORING_LIST) { MonitoringListScreen(navController) }
    composable(Routes.MONITORING) { MonitoringScreen(navController) }
    composable(Routes.MONITORING_POINTS) { MonitoringPointsScreen(navController) }
    composable(Routes.MONITORING_POINT) { MonitoringPointScreen(navController) }
}
```

Каждый composable получает аргументы из route через navBackStackEntry.arguments.

---

## ФАЗА 11: Финальная полировка

### Задачи

1. **Обработка ошибок**: SnackbarHost в каждом Scaffold. При ошибках сети — показ сообщения. При ошибках Room — fallback.

2. **Permission handling**: Создать утилиту для запроса разрешений (камера, геолокация, запись аудио). Использовать `rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission())`.

3. **Pull-to-refresh** на экранах списков: используя `pullToRefresh` модификатор из Material 3.

4. **Индикатор сети**: В TopAppBar или внизу: красная плашка "Нет подключения к интернету" когда нет сети. Использовать ConnectivityManager.

5. **Splash screen**: Добавить тему splash через `core-splashscreen`.

6. **Logout**: На экране ModeSelect — кнопка выхода. При выходе: очистить TokenManager, очистить все таблицы Room, навигировать на Login.

---

## КОНСТАНТЫ ДЛЯ СПРАВКИ

```kotlin
val SOIL_DESCRIPTIONS = listOf(
    "глина", "суглинок", "супесь", "песок", "торф",
    "ил", "гравий", "чернозём", "насыпной грунт", "строительный мусор"
)

val WATER_DESCRIPTIONS = listOf(
    "прозрачная", "слабо мутная", "мутная", "с осадком",
    "с запахом", "окрашенная", "с плёнкой на поверхности", "с водорослями"
)

val SEDIMENT_DESCRIPTIONS = listOf(
    "ил", "песок", "глина", "суглинок", "торф",
    "гравий", "ракушечник", "смешанный грунт"
)

val WATER_VOLUME_OPTIONS = listOf(
    "2 л/Ст.; 1,5 л/ПЭТ", "1,5 л/ПЭТ", "1 л/Ст.", "0,5 л/Ст."
)

val WATER_CONTAINER_COUNT_OPTIONS = listOf("1", "2", "3", "4", "5")

val SEDIMENT_MASS_OPTIONS = listOf("1 кг/ПЭ", "0,5 кг/ПЭ", "2 кг/ПЭ")
```

---

## СТРУКТУРА ФАЙЛОВ (итоговая)

```
app/src/main/java/ru/polevie/mobile/
├── PolevieApp.kt                          ✅ (готов)
├── MainActivity.kt                        ✅ (есть, нужна доработка)
├── di/
│   ├── AppModule.kt                       ✅ (готов, нужно добавить ImageLoader)
│   ├── DatabaseModule.kt                  ✅ (готов)
│   ├── NetworkModule.kt                   ✅ (готов)
│   └── SyncModule.kt                      ✅ (готов)
├── data/
│   ├── local/
│   │   ├── AppDatabase.kt                 ✅ (готов)
│   │   ├── dao/ (7 файлов)               ✅ (готовы)
│   │   └── entity/ (7 файлов)            ✅ (готовы)
│   ├── remote/
│   │   ├── ApiService.kt                  ✅ (готов)
│   │   ├── AuthApiService.kt              ✅ (готов)
│   │   ├── AuthInterceptor.kt             ✅ (готов)
│   │   ├── TokenManager.kt                ✅ (готов)
│   │   └── dto/ (3 файла)               ✅ (готовы)
│   └── repository/
│       └── DataSyncRepository.kt          🔨 ФАЗА 2
├── sync/
│   ├── SyncWorker.kt                      ✅ (готов)
│   └── SyncManager.kt                     ✅ (готов)
├── ui/
│   ├── theme/ (3 файла)                  ✅ (готовы)
│   ├── navigation/
│   │   └── AppNavigation.kt              ✅ (готов)
│   ├── login/
│   │   ├── LoginScreen.kt                 🔨 ФАЗА 1
│   │   └── LoginViewModel.kt             🔨 ФАЗА 1
│   ├── modeselect/
│   │   ├── ModeSelectScreen.kt            🔨 ФАЗА 2
│   │   └── ModeSelectViewModel.kt         🔨 ФАЗА 2
│   ├── projects/
│   │   ├── ProjectsScreen.kt             🔨 ФАЗА 3
│   │   ├── ProjectsViewModel.kt          🔨 ФАЗА 3
│   │   ├── ProjectScreen.kt              🔨 ФАЗА 3
│   │   └── ProjectViewModel.kt           🔨 ФАЗА 3
│   ├── platforms/
│   │   ├── PlatformsScreen.kt            🔨 ФАЗА 4
│   │   ├── PlatformScreen.kt             🔨 ФАЗА 4
│   │   └── PlatformViewModel.kt          🔨 ФАЗА 4
│   ├── samples/
│   │   ├── SamplesScreen.kt              🔨 ФАЗА 5
│   │   ├── SampleScreen.kt               🔨 ФАЗА 5
│   │   └── SamplesViewModel.kt           🔨 ФАЗА 5
│   ├── photos/
│   │   ├── PhotosScreen.kt               🔨 ФАЗА 6
│   │   └── PhotosViewModel.kt            🔨 ФАЗА 6
│   ├── monitorings/
│   │   ├── MonitoringListScreen.kt        🔨 ФАЗА 7
│   │   ├── MonitoringListViewModel.kt     🔨 ФАЗА 7
│   │   ├── MonitoringScreen.kt            🔨 ФАЗА 7
│   │   ├── MonitoringViewModel.kt         🔨 ФАЗА 7
│   │   ├── MonitoringPointsScreen.kt      🔨 ФАЗА 8
│   │   ├── MonitoringPointScreen.kt       🔨 ФАЗА 8
│   │   └── MonitoringPointViewModel.kt    🔨 ФАЗА 8
│   └── components/
│       ├── Header.kt                      🔨 ФАЗА 9
│       ├── ListItem.kt                    🔨 ФАЗА 9
│       ├── InfoRow.kt                     🔨 ФАЗА 9
│       ├── ActionButton.kt               🔨 ФАЗА 9
│       ├── PickerDialog.kt               🔨 ФАЗА 9
│       ├── EmptyState.kt                  🔨 ФАЗА 9
│       └── SyncStatusBar.kt              🔨 ФАЗА 9
└── util/
    ├── LocationUtils.kt                   🔨 ФАЗА 4
    ├── AudioRecorderUtil.kt               🔨 ФАЗА 6
    └── CoilAuthInterceptor.kt             🔨 ФАЗА 6
```

---

## РЕКОМЕНДУЕМЫЙ ПОРЯДОК ВЫПОЛНЕНИЯ ФАЗ

**Важно**: Фазу 9 (общие компоненты) лучше делать ПЕРВОЙ, так как все остальные фазы используют эти компоненты.

1. **Фаза 9** → Общие компоненты (Header, ListItem, InfoRow и т.д.)
2. **Фаза 1** → Логин
3. **Фаза 2** → Выбор режима + DataSyncRepository
4. **Фаза 3** → Проекты
5. **Фаза 4** → Площадки
6. **Фаза 5** → Пробы
7. **Фаза 6** → Фотоальбом
8. **Фаза 7** → Мониторинги
9. **Фаза 8** → Точки наблюдения
10. **Фаза 10** → Навигация
11. **Фаза 11** → Полировка

---

## СБОРКА И ТЕСТИРОВАНИЕ

```bash
# Из папки apps/mobile/
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools

# Сборка (local — для локального API)
./gradlew assembleLocalDebug

# Сборка (prod — для rei-polevie-pro.ru)
./gradlew assembleProdDebug

# Установка на подключенный телефон
./deploy.sh local debug

# APK будет в:
# app/build/outputs/apk/local/debug/app-local-debug.apk
```
