package ru.polevie.mobile.ui.photos

import android.Manifest
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
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.Upload
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import coil.compose.LocalImageLoader
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import androidx.hilt.navigation.compose.hiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.File
import ru.polevie.mobile.data.local.entity.PhotoEntity
import ru.polevie.mobile.ui.components.BackHeader
import ru.polevie.mobile.ui.theme.BgPrimary
import ru.polevie.mobile.ui.theme.BgSecondary
import ru.polevie.mobile.ui.theme.BgTertiary
import ru.polevie.mobile.ui.theme.BorderColor
import ru.polevie.mobile.ui.theme.Primary400
import ru.polevie.mobile.ui.theme.TextPrimary
import ru.polevie.mobile.ui.theme.TextSecondary
import ru.polevie.mobile.util.LocationUtils

@Composable
fun PhotosScreen(
    projectId: String,
    onBack: () -> Unit,
    viewModel: PhotosViewModel = hiltViewModel(),
) {
    val context = LocalContext.current
    val photos by viewModel.photos.collectAsState()
    val withoutDesc by viewModel.withoutDescriptionCount.collectAsState()
    val uploadLoading by viewModel.uploadLoading.collectAsState()
    val toastMessage by viewModel.toastMessage.collectAsState()
    val pendingVoice by viewModel.pendingVoiceDescribe.collectAsState()
    val isSyncing by viewModel.refreshing.collectAsState()

    LaunchedEffect(projectId) {
        viewModel.refresh()
    }

    LaunchedEffect(toastMessage) {
        toastMessage?.let { msg ->
            android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_SHORT).show()
            viewModel.clearToast()
        }
    }

    var selectedPhotoId by remember { mutableStateOf<String?>(null) }
    val selectedPhoto = selectedPhotoId?.let { id -> photos.find { it.id == id } }

    var pendingAfterMediaLocation by remember { mutableStateOf<(() -> Unit)?>(null) }
    val mediaLocationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) pendingAfterMediaLocation?.invoke()
        pendingAfterMediaLocation = null
    }

    val pickerLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.GetMultipleContents(),
    ) { uris: List<Uri> ->
        if (uris.isNotEmpty()) viewModel.addPhotos(uris)
    }

    fun launchWithMediaLocation(action: () -> Unit) {
        if (LocationUtils.hasMediaLocationPermission(context)) action()
        else {
            pendingAfterMediaLocation = action
            mediaLocationLauncher.launch(Manifest.permission.ACCESS_MEDIA_LOCATION)
        }
    }

    Column(modifier = Modifier.fillMaxSize().background(BgPrimary)) {
        BackHeader(
            title = "Фотоальбом (${photos.size})",
            onBack = onBack,
            onSync = { viewModel.refresh() },
            isSyncing = isSyncing,
        )

        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            PhotoActionButton(
                icon = Icons.Default.Upload,
                label = "Загрузить фото",
                onClick = { launchWithMediaLocation { pickerLauncher.launch("image/*") } },
                loading = uploadLoading,
                variant = PhotoButtonVariant.Primary,
                modifier = Modifier.fillMaxWidth(),
            )
                if (withoutDesc > 0) {
                PhotoActionButton(
                    icon = Icons.Default.Mic,
                    label = "Описать голосом ($withoutDesc)",
                    onClick = {
                        val ids = photos.filter { it.description.isNullOrBlank() }.map { it.id }
                        if (ids.isNotEmpty()) viewModel.setVoiceDescribePhotoIds(ids)
                    },
                    variant = PhotoButtonVariant.Secondary,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            if (isSyncing) {
                CircularProgressIndicator(
                    modifier = Modifier.padding(8.dp).size(24.dp),
                    color = Primary400,
                )
            }
        }

        if (photos.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    "Нет фото. Нажмите «Загрузить фото».",
                    color = TextSecondary,
                    style = MaterialTheme.typography.bodyLarge,
                )
            }
        } else {
            LazyVerticalGrid(
                columns = GridCells.Fixed(3),
                modifier = Modifier.fillMaxSize(),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            ) {
                items(photos) { photo ->
                    PhotoThumbnail(
                        photo = photo,
                        projectId = projectId,
                        imageLoader = LocalImageLoader.current,
                        onClick = { selectedPhotoId = photo.id },
                    )
                }
            }
        }
    }

    selectedPhoto?.let { photo ->
        FullscreenPhotoDialog(
            photo = photo,
            projectId = projectId,
            onDismiss = { selectedPhotoId = null },
            onUpdateDescription = { desc -> viewModel.updateDescription(photo.id, desc) },
            onVoiceDescribe = { file -> viewModel.voiceDescribe(photo.id, file) },
        )
    }

    val voiceDescribeIds by viewModel.voiceDescribePhotoIds.collectAsState()
    if (voiceDescribeIds.isNotEmpty()) {
        VoiceDescribeOverlay(
            projectId = projectId,
            photoIds = voiceDescribeIds,
            photos = photos,
            onDismiss = { viewModel.clearVoiceDescribePhotoIds() },
            viewModel = viewModel,
        )
    }
}

@Composable
private fun PhotoThumbnail(
    photo: PhotoEntity,
    projectId: String,
    imageLoader: coil.ImageLoader,
    onClick: () -> Unit,
) {
    val model: Any? = when {
        photo.localFilePath != null -> File(photo.localFilePath!!)
        photo.isUploaded -> PhotosViewModel.thumbnailUrl(projectId, photo.id)
        else -> null
    }
    Box(
        modifier = Modifier
            .aspectRatio(1f)
            .clip(RoundedCornerShape(8.dp))
            .background(BgSecondary)
            .clickable(onClick = onClick),
    ) {
        if (model != null) {
            AsyncImage(
                model = ImageRequest.Builder(LocalContext.current)
                    .data(model)
                    .build(),
                contentDescription = null,
                imageLoader = imageLoader,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
            )
        }
        if (photo.latitude != null && photo.longitude != null) {
            Icon(
                Icons.Default.Place,
                contentDescription = "GPS",
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(4.dp)
                    .size(16.dp),
                tint = Primary400,
            )
        }
        if (photo.description.isNullOrBlank()) {
            Icon(
                Icons.Default.Mic,
                contentDescription = "Без описания",
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(4.dp)
                    .size(16.dp),
                tint = TextSecondary,
            )
        }
    }
}

@Composable
private fun FullscreenPhotoDialog(
    photo: PhotoEntity,
    projectId: String,
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
            androidx.core.content.ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
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
            IconButton(
                onClick = onDismiss,
                modifier = Modifier.size(48.dp),
            ) {
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
                    Icon(
                        Icons.Default.Mic,
                        contentDescription = "Голосовое описание",
                        modifier = Modifier.size(24.dp),
                        tint = if (isRecording) Primary400 else TextPrimary,
                    )
                }
                IconButton(
                    onClick = {
                        isEditing = !isEditing
                        if (!isEditing) onUpdateDescription(editText)
                    },
                    modifier = Modifier.size(48.dp),
                ) {
                    Icon(
                        Icons.Default.Edit,
                        contentDescription = "Редактировать",
                        modifier = Modifier.size(24.dp),
                        tint = TextPrimary,
                    )
                }
            }
        }

        val fullModel: Any? = when {
            photo.localFilePath != null -> File(photo.localFilePath!!)
            photo.isUploaded -> PhotosViewModel.originalUrl(projectId, photo.id)
            else -> null
        }
        if (fullModel != null) {
            AsyncImage(
                model = ImageRequest.Builder(context).data(fullModel).build(),
                contentDescription = null,
                imageLoader = LocalImageLoader.current,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp)
                    .clip(RoundedCornerShape(8.dp)),
                contentScale = ContentScale.Fit,
            )
        }

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
            val mapsUrl = LocationUtils.getYandexMapsUrl(photo.latitude, photo.longitude)
            if (mapsUrl != null) {
                Row(
                    modifier = Modifier
                        .clickable {
                            context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, Uri.parse(mapsUrl)))
                        }
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

private enum class PhotoButtonVariant { Primary, Secondary }

@Composable
private fun PhotoActionButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit,
    loading: Boolean = false,
    variant: PhotoButtonVariant = PhotoButtonVariant.Secondary,
    modifier: Modifier = Modifier,
) {
    val (bgColor, tintColor) = when (variant) {
        PhotoButtonVariant.Primary -> Primary400.copy(alpha = 0.25f) to Primary400
        PhotoButtonVariant.Secondary -> BgTertiary to TextPrimary
    }
    Card(
        modifier = modifier
            .clickable(onClick = onClick, enabled = !loading),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = bgColor),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (loading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    color = tintColor,
                    strokeWidth = 2.dp,
                )
            } else {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    modifier = Modifier.size(24.dp),
                    tint = tintColor,
                )
            }
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium,
                color = TextPrimary,
            )
        }
    }
}

@Composable
private fun VoiceDescribeOverlay(
    projectId: String,
    photoIds: List<String>,
    photos: List<PhotoEntity>,
    onDismiss: () -> Unit,
    viewModel: PhotosViewModel,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var index by remember { mutableStateOf(0) }
    var isRecording by remember { mutableStateOf(false) }
    var isTranscribing by remember { mutableStateOf(false) }
    var lastText by remember { mutableStateOf<String?>(null) }
    var recordingFile by remember { mutableStateOf<File?>(null) }
    val audioRecorder = remember { ru.polevie.mobile.util.AudioRecorderUtil() }

    val currentPhotoId = photoIds.getOrNull(index)
    val currentPhoto = currentPhotoId?.let { id -> photos.find { it.id == id } }
    val total = photoIds.size

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

    fun advance() {
        lastText = null
        if (index + 1 >= total) {
            onDismiss()
        } else {
            index += 1
        }
    }

    fun startRecording() {
        when {
            androidx.core.content.ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
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

    fun stopRecording() {
        if (isRecording) {
            audioRecorder.stop()
            audioRecorder.release()
            recordingFile?.let { file ->
                isTranscribing = true
                scope.launch {
                    viewModel.voiceDescribeSync(currentPhotoId!!, file).onSuccess {
                        lastText = "Описание сохранено"
                        delay(1500)
                        advance()
                    }
                    isTranscribing = false
                }
            }
            recordingFile = null
            isRecording = false
        }
    }

    if (currentPhotoId == null) {
        LaunchedEffect(Unit) { onDismiss() }
    } else {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(BgPrimary)
                .windowInsetsPadding(WindowInsets.systemBars),
        ) {
        BackHeader(
            title = "Описание ${index + 1} из $total",
            onBack = {
                if (isRecording) stopRecording()
                onDismiss()
            },
        )

        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            val dialogModel: Any? = when {
                currentPhoto?.localFilePath != null -> File(currentPhoto!!.localFilePath!!)
                currentPhoto?.isUploaded == true -> PhotosViewModel.originalUrl(projectId, currentPhotoId)
                else -> null
            }
            if (dialogModel != null) {
                AsyncImage(
                    model = ImageRequest.Builder(context).data(dialogModel).build(),
                    contentDescription = null,
                    imageLoader = LocalImageLoader.current,
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .clip(RoundedCornerShape(12.dp)),
                    contentScale = ContentScale.Fit,
                )
            }
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            when {
                isTranscribing -> Text("Распознаю...", style = MaterialTheme.typography.bodyMedium, color = TextSecondary)
                lastText != null -> Text(lastText!!, style = MaterialTheme.typography.bodyMedium, color = Primary400)
                currentPhoto?.description?.isNotBlank() == true -> Text(
                    currentPhoto!!.description!!,
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary,
                )
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(
                onClick = { if (!isRecording && !isTranscribing) advance() },
                modifier = Modifier.size(56.dp),
                enabled = !isRecording && !isTranscribing,
            ) {
                Icon(Icons.Default.SkipNext, contentDescription = "Пропустить", tint = TextSecondary)
            }
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(androidx.compose.foundation.shape.CircleShape)
                    .background(
                        if (isRecording) androidx.compose.ui.graphics.Color(0xFFE53935)
                        else Primary400,
                    )
                    .clickable(enabled = !isTranscribing) {
                        if (isRecording) stopRecording() else startRecording()
                    },
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = if (isRecording) Icons.Default.MicOff else Icons.Default.Mic,
                    contentDescription = null,
                    modifier = Modifier.size(40.dp),
                    tint = androidx.compose.ui.graphics.Color.White,
                )
            }
            IconButton(
                onClick = {
                    if (isRecording) stopRecording()
                    else if (!isTranscribing) onDismiss()
                },
                modifier = Modifier.size(56.dp),
                enabled = !isTranscribing,
            ) {
                Icon(Icons.Default.Check, contentDescription = "Готово", tint = TextSecondary)
            }
        }

        Text(
            text = if (isRecording) "Говорите... Нажмите для остановки" else "Нажмите микрофон и опишите фото",
            style = MaterialTheme.typography.bodySmall,
            color = TextSecondary,
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 24.dp),
        )
        }
    }
}
