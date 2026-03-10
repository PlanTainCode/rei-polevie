package ru.polevie.mobile.ui.monitoring

import android.Manifest
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Camera
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Navigation
import androidx.compose.material.icons.filled.Place
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import coil.compose.AsyncImage
import coil.compose.LocalImageLoader
import coil.request.ImageRequest
import androidx.hilt.navigation.compose.hiltViewModel
import ru.polevie.mobile.data.local.entity.MonitoringProbeEntity
import ru.polevie.mobile.data.local.entity.PhotoEntity
import ru.polevie.mobile.data.remote.dto.UpdateProbeRequest
import ru.polevie.mobile.ui.components.BackHeader
import ru.polevie.mobile.ui.samples.CharacteristicChip
import ru.polevie.mobile.ui.theme.Amber400
import ru.polevie.mobile.ui.theme.BgPrimary
import ru.polevie.mobile.ui.theme.BgSecondary
import ru.polevie.mobile.ui.theme.BgTertiary
import ru.polevie.mobile.ui.theme.BorderColor
import ru.polevie.mobile.ui.theme.Emerald400
import ru.polevie.mobile.ui.theme.Primary400
import ru.polevie.mobile.ui.theme.Red400
import ru.polevie.mobile.ui.theme.TextPrimary
import ru.polevie.mobile.ui.theme.TextSecondary
import ru.polevie.mobile.util.LocationUtils
import java.io.File

@Composable
fun MonitoringPointScreen(
    monitoringId: String,
    pointName: String,
    onBack: () -> Unit,
    viewModel: MonitoringPointViewModel = hiltViewModel(),
) {
    val context = LocalContext.current
    val probes by viewModel.probes.collectAsState()
    val photos by viewModel.photos.collectAsState()
    val toastMessage by viewModel.toastMessage.collectAsState()
    val geoLoading by viewModel.geoLoading.collectAsState()
    val exifLoading by viewModel.exifLoading.collectAsState()
    val uploadLoading by viewModel.uploadLoading.collectAsState()

    var manualMode by remember { mutableStateOf<String?>(null) }
    var manualValue by remember { mutableStateOf("") }
    var showDescPicker by remember { mutableStateOf<String?>(null) }
    var selectedPhotoId by remember { mutableStateOf<String?>(null) }
    var showFieldPicker by remember { mutableStateOf<FieldPickerState?>(null) }
    var fieldInputValue by remember { mutableStateOf("") }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted -> if (granted) viewModel.requestLocation() else viewModel.showToast("Доступ к геолокации запрещён") }

    var pendingAfterMediaLocation by remember { mutableStateOf<(() -> Unit)?>(null) }
    val mediaLocationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) pendingAfterMediaLocation?.invoke()
        pendingAfterMediaLocation = null
    }

    val exifLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent(),
    ) { uri: Uri? -> uri?.let { viewModel.applyExifCoordinates(it) } }

    val photoLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.GetMultipleContents(),
    ) { uris: List<Uri> -> viewModel.uploadPhotos(uris) }

    fun launchWithMediaLocation(action: () -> Unit) {
        if (LocationUtils.hasMediaLocationPermission(context)) action()
        else {
            pendingAfterMediaLocation = action
            mediaLocationLauncher.launch(Manifest.permission.ACCESS_MEDIA_LOCATION)
        }
    }

    LaunchedEffect(toastMessage) {
        toastMessage?.let { android.widget.Toast.makeText(context, it, android.widget.Toast.LENGTH_SHORT).show(); viewModel.clearToast() }
    }
    LaunchedEffect(Unit) { viewModel.refresh() }

    val primaryProbe = probes.firstOrNull()
    val hasCoords = !primaryProbe?.latitude.isNullOrBlank() && !primaryProbe?.longitude.isNullOrBlank()
    val mapsUrl = LocationUtils.getYandexMapsUrl(primaryProbe?.latitude, primaryProbe?.longitude)

    Box(modifier = Modifier.fillMaxSize().background(BgPrimary)) {
    Column(modifier = Modifier.fillMaxSize()) {
        BackHeader(title = pointName, onBack = onBack, onSync = { viewModel.refresh() })
        when {
            probes.isEmpty() -> {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Primary400)
                }
            }
            else -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    probes.forEach { probe ->
                        ProbeCard(
                            probe = probe,
                            showDescPicker = showDescPicker == probe.id,
                            onToggleDescPicker = { showDescPicker = if (showDescPicker == probe.id) null else probe.id },
                            onCollect = { viewModel.collectProbe(probe.id) },
                            onSelectDescription = { viewModel.updateProbeField(probe.id, UpdateProbeRequest(description = it)); showDescPicker = null },
                            showFieldPicker = showFieldPicker,
                            fieldInputValue = fieldInputValue,
                            onFieldPicker = { showFieldPicker = it; fieldInputValue = it?.let { s -> when (s.field) {
                                "depth" -> probe.depth ?: ""
                                "temperature" -> probe.temperature ?: ""
                                "note" -> probe.note ?: ""
                                else -> ""
                            } } ?: "" },
                            onFieldInputChange = { fieldInputValue = it },
                            onSaveField = { viewModel.updateProbeField(probe.id, it); showFieldPicker = null },
                        )
                    }

                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = BgSecondary),
                        elevation = CardDefaults.cardElevation(0.dp),
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(Modifier.size(10.dp).clip(RoundedCornerShape(5.dp)).background(if (hasCoords) Emerald400 else Red400))
                                Text("Координаты", style = MaterialTheme.typography.bodyMedium, color = TextPrimary, modifier = Modifier.padding(start = 8.dp))
                            }
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                                Column(Modifier.weight(1f)) {
                                    Text("Широта", style = MaterialTheme.typography.bodySmall, color = TextSecondary)
                                    Text(primaryProbe?.latitude ?: "—", style = MaterialTheme.typography.bodyMedium, color = TextPrimary)
                                }
                                Column(Modifier.weight(1f)) {
                                    Text("Долгота", style = MaterialTheme.typography.bodySmall, color = TextSecondary)
                                    Text(primaryProbe?.longitude ?: "—", style = MaterialTheme.typography.bodyMedium, color = TextPrimary)
                                }
                            }
                            mapsUrl?.let { url ->
                                Row(
                                    modifier = Modifier.padding(top = 8.dp).clickable {
                                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                                    },
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Icon(Icons.Default.Navigation, null, Modifier.size(14.dp), tint = Primary400)
                                    Text("Открыть на карте", style = MaterialTheme.typography.bodySmall, color = Primary400, modifier = Modifier.padding(start = 6.dp))
                                }
                            }
                        }
                    }

                    if (manualMode == "lat" || manualMode == "lon") {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = BgSecondary),
                            elevation = CardDefaults.cardElevation(0.dp),
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(if (manualMode == "lat") "Широта" else "Долгота", style = MaterialTheme.typography.bodyMedium, color = TextPrimary)
                                Text("формат: 55 50.792", style = MaterialTheme.typography.bodySmall, color = TextSecondary)
                                Spacer(Modifier.size(8.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    OutlinedTextField(
                                        value = manualValue,
                                        onValueChange = { manualValue = it },
                                        placeholder = { Text(if (manualMode == "lat") "55 50.792" else "37 39.277") },
                                        modifier = Modifier.weight(1f),
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedBorderColor = BorderColor,
                                            unfocusedBorderColor = BorderColor,
                                            focusedTextColor = TextPrimary,
                                            unfocusedTextColor = TextPrimary,
                                        ),
                                    )
                                    Card(Modifier.clickable {
                                        if (manualValue.isNotBlank()) {
                                            if (manualMode == "lat") viewModel.updateCoordinateLat(manualValue.trim())
                                            else viewModel.updateCoordinateLon(manualValue.trim())
                                            manualMode = null
                                            manualValue = ""
                                        }
                                    }, colors = CardDefaults.cardColors(containerColor = Primary400)) {
                                        Icon(Icons.Default.Check, null, Modifier.padding(8.dp), tint = androidx.compose.ui.graphics.Color.White)
                                    }
                                    Card(Modifier.clickable { manualMode = null; manualValue = "" },
                                        colors = CardDefaults.cardColors(containerColor = BgTertiary)) {
                                        Icon(Icons.Default.Close, null, Modifier.padding(8.dp), tint = TextSecondary)
                                    }
                                }
                            }
                        }
                    }

                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Ввод координат", style = MaterialTheme.typography.labelSmall, color = TextSecondary)
                        MonitoringActionButton(
                            icon = Icons.Default.MyLocation,
                            label = "Моя геолокация",
                            onClick = {
                                if (ru.polevie.mobile.util.LocationUtils.hasLocationPermission(context)) viewModel.requestLocation()
                                else permissionLauncher.launch(android.Manifest.permission.ACCESS_FINE_LOCATION)
                            },
                            loading = geoLoading,
                            variant = true,
                        )
                        MonitoringActionButton(
                            icon = Icons.Default.Camera,
                            label = "Определить по фото (EXIF)",
                            onClick = { launchWithMediaLocation { exifLauncher.launch("image/*") } },
                            loading = exifLoading,
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            MonitoringActionButton(
                                icon = Icons.Default.Edit,
                                label = "Широта",
                                modifier = Modifier.weight(1f),
                                onClick = { manualMode = "lat"; manualValue = "" },
                            )
                            MonitoringActionButton(
                                icon = Icons.Default.Edit,
                                label = "Долгота",
                                modifier = Modifier.weight(1f),
                                onClick = { manualMode = "lon"; manualValue = "" },
                            )
                        }
                    }

                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Фото точки (${photos.size})", style = MaterialTheme.typography.labelSmall, color = TextSecondary)
                        MonitoringActionButton(
                            icon = Icons.Default.Camera,
                            label = "Загрузить фото",
                            onClick = { launchWithMediaLocation { photoLauncher.launch("image/*") } },
                            loading = uploadLoading,
                            variant = true,
                        )
                        if (photos.isNotEmpty()) {
                            LazyVerticalGrid(
                                columns = GridCells.Fixed(3),
                                modifier = Modifier.heightIn(max = 360.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                items(photos, key = { it.id }) { photo ->
                                    Box(
                                        modifier = Modifier
                                            .aspectRatio(1f)
                                            .clip(RoundedCornerShape(8.dp))
                                            .clickable { selectedPhotoId = photo.id },
                                    ) {
                                        val thumbModel: Any = if (photo.localFilePath != null) {
                                            java.io.File(photo.localFilePath!!)
                                        } else {
                                            MonitoringPointViewModel.photoThumbnailUrl(monitoringId, photo.id)
                                        }
                                        AsyncImage(
                                            model = ImageRequest.Builder(LocalContext.current)
                                                .data(thumbModel)
                                                .crossfade(true)
                                                .build(),
                                            contentDescription = null,
                                            imageLoader = LocalImageLoader.current,
                                            modifier = Modifier.fillMaxSize(),
                                            contentScale = ContentScale.Crop,
                                        )
                                        if (photo.description.isNullOrBlank()) {
                                            Icon(
                                                Icons.Default.Mic,
                                                contentDescription = null,
                                                modifier = Modifier
                                                    .align(Alignment.BottomStart)
                                                    .padding(4.dp)
                                                    .size(16.dp),
                                                tint = TextSecondary,
                                            )
                                        }
                                        if (photo.latitude != null && photo.longitude != null) {
                                            Icon(
                                                Icons.Default.Place,
                                                contentDescription = null,
                                                modifier = Modifier
                                                    .align(Alignment.TopEnd)
                                                    .padding(4.dp)
                                                    .size(16.dp),
                                                tint = Primary400,
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Spacer(Modifier.size(96.dp))
                }
            }
        }
    }

        photos.find { it.id == selectedPhotoId }?.let { photo ->
            FullscreenMonitoringPhotoDialog(
                photo = photo,
                monitoringId = monitoringId,
                onDismiss = { selectedPhotoId = null },
                onUpdateDescription = { viewModel.updatePhotoDescription(photo.id, it) },
                onVoiceDescribe = { viewModel.voiceDescribePhoto(photo.id, it) },
            )
        }
    }
}


@Composable
private fun FullscreenMonitoringPhotoDialog(
    photo: PhotoEntity,
    monitoringId: String,
    onDismiss: () -> Unit,
    onUpdateDescription: (String) -> Unit,
    onVoiceDescribe: (File) -> Unit,
) {
    val context = LocalContext.current
    var editText by remember(photo.id) { mutableStateOf(photo.description ?: "") }
    var isEditing by remember(photo.id) { mutableStateOf(false) }
    var isRecording by remember { mutableStateOf(false) }
    var recordingFile by remember { mutableStateOf<File?>(null) }
    val audioRecorder = remember { ru.polevie.mobile.util.AudioRecorderUtil() }

    val recordPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) {
            val file = File(context.cacheDir, "voice_${System.currentTimeMillis()}.m4a")
            if (audioRecorder.start(file)) {
                recordingFile = file
                isRecording = true
            }
        } else {
            android.widget.Toast.makeText(context, "Нет доступа к микрофону", android.widget.Toast.LENGTH_SHORT).show()
        }
    }

    DisposableEffect(Unit) {
        onDispose { audioRecorder.release() }
    }

    val startRecord: () -> Unit = {
        when {
            ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
                android.content.pm.PackageManager.PERMISSION_GRANTED -> {
                val file = File(context.cacheDir, "voice_${System.currentTimeMillis()}.m4a")
                if (audioRecorder.start(file)) {
                    recordingFile = file
                    isRecording = true
                }
            }
            else -> recordPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(androidx.compose.ui.graphics.Color.Black.copy(alpha = 0.95f))
            .windowInsetsPadding(WindowInsets.systemBars),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onDismiss, modifier = Modifier.size(48.dp)) {
                Icon(Icons.Default.Close, contentDescription = "Закрыть", modifier = Modifier.size(28.dp), tint = TextPrimary)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                IconButton(
                    onClick = {
                        if (isRecording) {
                            audioRecorder.stop()
                            audioRecorder.release()
                            recordingFile?.let { onVoiceDescribe(it) }
                            recordingFile = null
                            isRecording = false
                        } else {
                            startRecord()
                        }
                    },
                    modifier = Modifier.size(48.dp),
                ) {
                    Icon(Icons.Default.Mic, contentDescription = "Голосовое описание", modifier = Modifier.size(24.dp), tint = if (isRecording) Primary400 else TextPrimary)
                }
                IconButton(
                    onClick = {
                        isEditing = !isEditing
                        if (!isEditing) onUpdateDescription(editText)
                    },
                    modifier = Modifier.size(48.dp),
                ) {
                    Icon(Icons.Default.Edit, contentDescription = "Редактировать", modifier = Modifier.size(24.dp), tint = TextPrimary)
                }
            }
        }

        val imageModel: Any = if (photo.localFilePath != null) {
            java.io.File(photo.localFilePath!!)
        } else {
            MonitoringPointViewModel.photoOriginalUrl(monitoringId, photo.id)
        }
        AsyncImage(
            model = ImageRequest.Builder(context).data(imageModel).build(),
            contentDescription = null,
            imageLoader = LocalImageLoader.current,
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .clip(RoundedCornerShape(8.dp)),
            contentScale = ContentScale.Fit,
        )

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(start = 24.dp, top = 16.dp, end = 24.dp, bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            if (isEditing) {
                OutlinedTextField(
                    value = editText,
                    onValueChange = { editText = it },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Primary400,
                        unfocusedBorderColor = BorderColor,
                        cursorColor = Primary400,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary,
                    ),
                    minLines = 2,
                    maxLines = 4,
                )
            } else {
                Text(
                    text = photo.description?.ifBlank { "Без описания" } ?: "Без описания",
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (photo.description.isNullOrBlank()) TextSecondary else TextPrimary,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            LocationUtils.getYandexMapsUrl(photo.latitude, photo.longitude)?.let { mapsUrl ->
                Row(
                    modifier = Modifier
                        .clickable { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(mapsUrl))) }
                        .padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Icon(Icons.Default.Place, contentDescription = null, modifier = Modifier.size(16.dp), tint = Primary400)
                    Text("Открыть на карте", style = MaterialTheme.typography.bodySmall, color = Primary400)
                }
            }
        }
    }
}

private data class FieldPickerState(val probeId: String, val field: String)

@Composable
private fun ProbeCard(
    probe: MonitoringProbeEntity,
    showDescPicker: Boolean,
    onToggleDescPicker: () -> Unit,
    onCollect: () -> Unit,
    onSelectDescription: (String) -> Unit,
    showFieldPicker: FieldPickerState?,
    fieldInputValue: String,
    onFieldPicker: (FieldPickerState?) -> Unit,
    onFieldInputChange: (String) -> Unit,
    onSaveField: (UpdateProbeRequest) -> Unit,
) {
    val isCollected = probe.status == "COLLECTED"
    val typeLabel = if (probe.type == "WATER") "Вода" else "Донные отложения"
    val descriptions = if (probe.type == "WATER") WATER_DESCRIPTIONS else SEDIMENT_DESCRIPTIONS
    val isWater = probe.type == "WATER"
    val isSediment = probe.type == "SEDIMENT"
    val isThisProbe = { fp: FieldPickerState? -> fp != null && fp.probeId == probe.id }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = BgSecondary),
        elevation = CardDefaults.cardElevation(0.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(typeLabel, style = MaterialTheme.typography.titleSmall, color = TextPrimary)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(10.dp).clip(RoundedCornerShape(5.dp)).background(if (isCollected) Emerald400 else Amber400))
                    Text(if (isCollected) "Отобрана" else "Ожидает", style = MaterialTheme.typography.bodySmall, color = TextSecondary, modifier = Modifier.padding(start = 6.dp))
                }
            }
            Spacer(Modifier.size(16.dp))

            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (isWater) {
                FieldBtn("Объём/тара", probe.containerVolume) { onFieldPicker(FieldPickerState(probe.id, "containerVolume")) }
                if (isThisProbe(showFieldPicker) && showFieldPicker?.field == "containerVolume") {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        WATER_VOLUME_OPTIONS.forEach { opt ->
                            Text(opt, modifier = Modifier.fillMaxWidth().clickable {
                                onSaveField(UpdateProbeRequest(containerVolume = opt))
                            }.padding(8.dp), style = MaterialTheme.typography.bodySmall, color = TextPrimary)
                        }
                    }
                }
                FieldBtn("Кол-во ёмкостей", if (probe.containerCount > 0) probe.containerCount.toString() else null) { onFieldPicker(FieldPickerState(probe.id, "containerCount")) }
                if (isThisProbe(showFieldPicker) && showFieldPicker?.field == "containerCount") {
                    WATER_CONTAINER_COUNT_OPTIONS.forEach { opt ->
                        Text(opt, modifier = Modifier.fillMaxWidth().clickable { onSaveField(UpdateProbeRequest(containerCount = opt.toIntOrNull())); onFieldPicker(null) }.padding(8.dp), style = MaterialTheme.typography.bodySmall, color = TextPrimary)
                    }
                }
                FieldBtn("Глубина, м", probe.depth) { onFieldPicker(FieldPickerState(probe.id, "depth")); onFieldInputChange(probe.depth ?: "") }
                if (isThisProbe(showFieldPicker) && showFieldPicker?.field == "depth") FieldInput(fieldInputValue, onFieldInputChange, "0.3") { onSaveField(UpdateProbeRequest(depth = it)); onFieldPicker(null) }
                FieldBtn("Температура, °С", probe.temperature) { onFieldPicker(FieldPickerState(probe.id, "temperature")); onFieldInputChange(probe.temperature ?: "") }
                if (isThisProbe(showFieldPicker) && showFieldPicker?.field == "temperature") FieldInput(fieldInputValue, onFieldInputChange, "15") { onSaveField(UpdateProbeRequest(temperature = it)); onFieldPicker(null) }
            }
            if (isSediment) {
                FieldBtn("Масса/тара", probe.mass) { onFieldPicker(FieldPickerState(probe.id, "mass")) }
                if (isThisProbe(showFieldPicker) && showFieldPicker?.field == "mass") {
                    SEDIMENT_MASS_OPTIONS.forEach { opt ->
                        Text(opt, modifier = Modifier.fillMaxWidth().clickable { onSaveField(UpdateProbeRequest(mass = opt)); onFieldPicker(null) }.padding(8.dp), style = MaterialTheme.typography.bodySmall, color = TextPrimary)
                    }
                }
                FieldBtn("Глубина, м", probe.depth) { onFieldPicker(FieldPickerState(probe.id, "depth")); onFieldInputChange(probe.depth ?: "") }
                if (isThisProbe(showFieldPicker) && showFieldPicker?.field == "depth") FieldInput(fieldInputValue, onFieldInputChange, "0.1") { onSaveField(UpdateProbeRequest(depth = it)); onFieldPicker(null) }
                FieldBtn("Примечание", probe.note) { onFieldPicker(FieldPickerState(probe.id, "note")); onFieldInputChange(probe.note ?: "") }
                if (isThisProbe(showFieldPicker) && showFieldPicker?.field == "note") FieldInput(fieldInputValue, onFieldInputChange, "участок 1") { onSaveField(UpdateProbeRequest(note = it)); onFieldPicker(null) }
            }
            }

            Spacer(Modifier.size(12.dp))
            InfoRow("Характеристика", probe.description ?: "—")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (!isCollected) {
                    Card(
                        onClick = onCollect,
                        modifier = Modifier.weight(1f),
                        colors = CardDefaults.cardColors(containerColor = Emerald400.copy(alpha = 0.9f)),
                    ) {
                        Text(
                            "Отобрать",
                            modifier = Modifier.fillMaxWidth().padding(12.dp),
                            style = MaterialTheme.typography.bodyMedium,
                            color = androidx.compose.ui.graphics.Color.White,
                            textAlign = TextAlign.Center,
                        )
                    }
                }
                Card(
                    onClick = onToggleDescPicker,
                    modifier = Modifier.weight(1f),
                    colors = CardDefaults.cardColors(containerColor = BgTertiary),
                ) {
                    Text(
                        "Характеристика",
                        modifier = Modifier.fillMaxWidth().padding(12.dp),
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextPrimary,
                        textAlign = TextAlign.Center,
                    )
                }
            }
            if (showDescPicker) {
                Spacer(Modifier.size(12.dp))
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    descriptions.forEach { d ->
                        CharacteristicChip(
                            modifier = Modifier.fillMaxWidth(),
                            text = d,
                            isSelected = probe.description == d,
                            onClick = { onSelectDescription(d) },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun FieldBtn(label: String, value: String?, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = TextSecondary)
        Text(value ?: "Указать", style = MaterialTheme.typography.bodyMedium, color = if (value != null) TextPrimary else Primary400)
    }
}

@Composable
private fun FieldInput(value: String, onValueChange: (String) -> Unit, placeholder: String, onSave: (String) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            placeholder = { Text(placeholder) },
            modifier = Modifier.weight(1f),
            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = BorderColor, unfocusedBorderColor = BorderColor, focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary),
        )
        Card(Modifier.clickable { if (value.isNotBlank()) onSave(value.trim()) }, colors = CardDefaults.cardColors(containerColor = Primary400)) {
            Icon(Icons.Default.Check, null, Modifier.padding(8.dp), tint = androidx.compose.ui.graphics.Color.White)
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth()) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = TextSecondary, modifier = Modifier.padding(end = 8.dp))
        Text(value, style = MaterialTheme.typography.bodyMedium, color = TextPrimary)
    }
}

@Composable
private fun MonitoringActionButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    loading: Boolean = false,
    variant: Boolean = false,
) {
    Card(
        modifier = modifier.fillMaxWidth().clickable(enabled = !loading, onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = if (variant) Primary400.copy(alpha = 0.2f) else BgTertiary),
        elevation = CardDefaults.cardElevation(0.dp),
    ) {
        Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            if (loading) CircularProgressIndicator(Modifier.size(24.dp), color = Primary400)
            else Icon(icon, null, Modifier.size(24.dp), tint = if (variant) Primary400 else TextSecondary)
            Text(label, style = MaterialTheme.typography.bodyMedium, color = TextPrimary)
        }
    }
}
