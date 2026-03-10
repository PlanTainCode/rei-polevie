package ru.polevie.mobile.ui.samples

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Science
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.polevie.mobile.data.local.entity.SampleEntity
import ru.polevie.mobile.ui.components.BackHeader
import ru.polevie.mobile.ui.theme.BgPrimary
import ru.polevie.mobile.ui.theme.BgSecondary
import ru.polevie.mobile.ui.theme.BgTertiary
import ru.polevie.mobile.ui.theme.BorderColor
import ru.polevie.mobile.ui.theme.Emerald400
import ru.polevie.mobile.ui.theme.Primary400
import ru.polevie.mobile.ui.theme.TextPrimary
import ru.polevie.mobile.ui.theme.TextSecondary

private val SOIL_DESCRIPTIONS = listOf(
    "глина",
    "суглинок",
    "супесь",
    "песок",
    "торф",
    "ил",
    "гравий",
    "чернозём",
    "насыпной грунт",
    "строительный мусор",
)

@Composable
fun SamplesScreen(
    onBack: () -> Unit,
    onSampleSelect: (String) -> Unit,
    viewModel: SamplesViewModel = hiltViewModel(),
) {
    val context = LocalContext.current
    val platform by viewModel.platform.collectAsState()
    val samples by viewModel.samples.collectAsState()
    val isPP = viewModel.isPP
    val toastMessage by viewModel.toastMessage.collectAsState()

    var showDescPicker by remember { mutableStateOf(false) }

    LaunchedEffect(toastMessage) {
        toastMessage?.let { msg ->
            android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_SHORT).show()
            viewModel.clearToast()
        }
    }

    LaunchedEffect(viewModel.projectId) {
        if (viewModel.projectId.isNotEmpty()) viewModel.refresh()
    }

    Column(modifier = Modifier.fillMaxSize().background(BgPrimary)) {
        BackHeader(
            title = platform?.label?.let { "$it — пробы" } ?: "Пробы",
            onBack = onBack,
            onSync = { viewModel.refresh() },
        )

        if (samples.isEmpty()) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text("Нет проб", style = MaterialTheme.typography.bodyLarge, color = TextSecondary)
            }
        } else {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (isPP) {
                    val allCollected = samples.all { it.status == "COLLECTED" }
                    if (!allCollected) {
                        SamplesActionButton(
                            icon = Icons.Default.CheckCircle,
                            label = "Отметить все пробы отобранными",
                            onClick = { viewModel.collectAllSamples() },
                            variant = SamplesButtonVariant.Success,
                        )
                    }
                    SamplesActionButton(
                        icon = Icons.Default.Edit,
                        label = "Характеристика: ${samples.firstOrNull()?.description ?: "не указана"}",
                        onClick = { showDescPicker = true },
                        variant = SamplesButtonVariant.Primary,
                    )
                }

                if (showDescPicker) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = BgSecondary),
                        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                "Выберите характеристику:",
                                style = MaterialTheme.typography.bodyMedium,
                                color = TextPrimary,
                                modifier = Modifier.padding(bottom = 12.dp),
                            )
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                SOIL_DESCRIPTIONS.chunked(2).forEach { row ->
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    ) {
                                        row.forEach { desc ->
                                            val isSelected = samples.firstOrNull()?.description == desc
                                            CharacteristicChip(
                                                modifier = Modifier.weight(1f),
                                                text = desc,
                                                isSelected = isSelected,
                                                onClick = {
                                                    viewModel.setPlatformDescription(desc)
                                                    showDescPicker = false
                                                },
                                            )
                                        }
                                    }
                                }
                            }
                            Text(
                                "Отмена",
                                style = MaterialTheme.typography.bodyMedium,
                                color = TextSecondary,
                                modifier = Modifier
                                    .padding(top = 12.dp)
                                    .clickable { showDescPicker = false },
                            )
                        }
                    }
                }

                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(bottom = 96.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(samples, key = { it.id }) { sample ->
                        SampleListItem(
                            sample = sample,
                            onClick = { onSampleSelect(sample.id) },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SampleListItem(sample: SampleEntity, onClick: () -> Unit) {
    val isCollected = sample.status == "COLLECTED"
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = BgSecondary),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, BorderColor, RoundedCornerShape(12.dp))
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = if (isCollected) Icons.Default.Check else Icons.Default.Science,
                contentDescription = null,
                modifier = Modifier.size(24.dp),
                tint = if (isCollected) Emerald400 else TextSecondary,
            )
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 12.dp),
            ) {
                Text(
                    sample.cipher,
                    style = MaterialTheme.typography.titleMedium,
                    color = TextPrimary,
                )
                val subtitle = listOfNotNull(
                    sample.depthLabel,
                    sample.description,
                ).joinToString(" • ")
                if (subtitle.isNotEmpty()) {
                    Text(
                        subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary,
                    )
                }
            }
        }
    }
}

@Composable
internal fun CharacteristicChip(
    modifier: Modifier = Modifier,
    text: String,
    isSelected: Boolean,
    onClick: () -> Unit,
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) Primary400.copy(alpha = 0.3f) else BgTertiary,
        ),
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.bodySmall,
            color = TextPrimary,
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
        )
    }
}

internal enum class SamplesButtonVariant { Primary, Success }

@Composable
internal fun SamplesActionButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit,
    variant: SamplesButtonVariant = SamplesButtonVariant.Primary,
) {
    val bgColor = when (variant) {
        SamplesButtonVariant.Primary -> Primary400.copy(alpha = 0.2f)
        SamplesButtonVariant.Success -> Emerald400.copy(alpha = 0.2f)
    }
    val tintColor = when (variant) {
        SamplesButtonVariant.Primary -> Primary400
        SamplesButtonVariant.Success -> Emerald400
    }
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = bgColor),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Icon(imageVector = icon, contentDescription = null, modifier = Modifier.size(24.dp), tint = tintColor)
            Text(label, style = MaterialTheme.typography.bodyMedium, color = TextPrimary)
        }
    }
}
