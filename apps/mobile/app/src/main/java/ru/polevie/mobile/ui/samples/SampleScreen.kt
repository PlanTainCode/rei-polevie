package ru.polevie.mobile.ui.samples

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
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
    "глина", "суглинок", "супесь", "песок", "торф", "ил",
    "гравий", "чернозём", "насыпной грунт", "строительный мусор",
)

@Composable
fun SampleScreen(
    sampleId: String,
    onBack: () -> Unit,
    viewModel: SamplesViewModel = hiltViewModel(),
) {
    val context = LocalContext.current
    val platform by viewModel.platform.collectAsState()
    val samples by viewModel.samples.collectAsState()
    val toastMessage by viewModel.toastMessage.collectAsState()

    val sample = samples.find { it.id == sampleId }
    val isPP = viewModel.isPP

    var showDescPicker by remember { mutableStateOf(false) }
    val scrollState = rememberScrollState()

    LaunchedEffect(toastMessage) {
        toastMessage?.let { msg ->
            android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_SHORT).show()
            viewModel.clearToast()
        }
    }

    LaunchedEffect(viewModel.projectId) {
        if (viewModel.projectId.isNotEmpty()) viewModel.refresh()
    }

    val isCollected = sample?.status == "COLLECTED"
    val allCollected = if (isPP) samples.all { it.status == "COLLECTED" } else isCollected

    Column(modifier = Modifier.fillMaxSize().background(BgPrimary)) {
        BackHeader(
            title = sample?.cipher ?: "Проба",
            onBack = onBack,
        )
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
        ) {
            if (sample == null) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator()
                }
            } else {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .align(Alignment.TopStart)
                        .verticalScroll(scrollState),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = BgSecondary),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, BorderColor, RoundedCornerShape(12.dp))
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    InfoRow("Площадка", platform?.label ?: "")
                    InfoRow("Глубина", sample.depthLabel ?: "—")
                    InfoRow("Масса", sample.mass ?: "—")
                    InfoRow("Характеристика", sample.description ?: "—")
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(10.dp)
                                .clip(RoundedCornerShape(5.dp))
                                .background(if (isCollected) Emerald400 else androidx.compose.ui.graphics.Color(0xFFFFB74D)),
                        )
                        Text(
                            if (isCollected) "Отобрана" else "Ожидает",
                            style = MaterialTheme.typography.bodyMedium,
                            color = TextPrimary,
                            modifier = Modifier.padding(start = 8.dp),
                        )
                    }
                    if (isPP) {
                        Text(
                            "ПП — действия применяются ко всем пробам площадки",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondary,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                }
            }

            SamplesActionButton(
                icon = Icons.Default.Edit,
                label = "Характеристика",
                onClick = { showDescPicker = true },
                variant = SamplesButtonVariant.Primary,
            )

            if (!allCollected) {
                SamplesActionButton(
                    icon = Icons.Default.CheckCircle,
                    label = if (isPP) "Отметить всю площадку отобранной" else "Отметить отобранной",
                    onClick = { viewModel.collectSample(sample.id) },
                    variant = SamplesButtonVariant.Success,
                )
            }

            if (showDescPicker) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = BgSecondary),
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            "Выберите характеристику${if (isPP) " (для всей площадки)" else ""}:",
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
                                        val isSelected = sample.description == desc
                                        CharacteristicChip(
                                            modifier = Modifier.weight(1f),
                                            text = desc,
                                            isSelected = isSelected,
                                            onClick = {
                                                viewModel.updateSampleDescription(sample.id, desc)
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
                }
            }
        }
    }
}


@Composable
private fun InfoRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth()) {
        Text(
            label,
            style = MaterialTheme.typography.bodySmall,
            color = TextSecondary,
            modifier = Modifier.padding(end = 8.dp),
        )
        Text(value, style = MaterialTheme.typography.bodyMedium, color = TextPrimary)
    }
}
