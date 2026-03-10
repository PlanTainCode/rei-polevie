package ru.polevie.mobile.ui.platforms

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Place
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import kotlin.OptIn
import ru.polevie.mobile.data.local.entity.PlatformEntity
import ru.polevie.mobile.ui.components.BackHeader
import ru.polevie.mobile.ui.theme.BgPrimary
import ru.polevie.mobile.ui.theme.BgSecondary
import ru.polevie.mobile.ui.theme.BorderColor
import ru.polevie.mobile.ui.theme.Emerald400
import ru.polevie.mobile.ui.theme.Primary400
import ru.polevie.mobile.ui.theme.Primary500
import ru.polevie.mobile.ui.theme.TextPrimary
import ru.polevie.mobile.ui.theme.TextSecondary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlatformsScreen(
    projectId: String,
    onBack: () -> Unit,
    onPlatformSelect: (String) -> Unit,
    viewModel: PlatformsViewModel = hiltViewModel(),
) {
    val platforms by viewModel.platforms.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()

    Column(modifier = Modifier.fillMaxSize().background(BgPrimary)) {
        BackHeader(
            title = "Площадки",
            onBack = onBack,
            onSync = { viewModel.refresh() },
            isSyncing = isLoading,
        )

        PullToRefreshBox(
            isRefreshing = isLoading,
            onRefresh = { viewModel.refresh() },
            modifier = Modifier.fillMaxSize(),
            indicator = { },
        ) {
            when {
                isLoading && platforms.isEmpty() -> {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        CircularProgressIndicator(color = Primary500)
                        Text(
                            text = "Загрузка...",
                            color = TextSecondary,
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.padding(top = 16.dp),
                        )
                    }
                }
                platforms.isEmpty() -> {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        Text(
                            text = "Нет площадок",
                            color = TextSecondary,
                            style = MaterialTheme.typography.bodyLarge,
                        )
                    }
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 16.dp),
                        contentPadding = PaddingValues(top = 16.dp, bottom = 96.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(platforms, key = { it.id }) { platform ->
                            PlatformListItem(
                                platform = platform,
                                onClick = { onPlatformSelect(platform.id) },
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PlatformListItem(
    platform: PlatformEntity,
    onClick: () -> Unit,
) {
    val done = platform.samplesTotal > 0 && platform.samplesCollected >= platform.samplesTotal

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
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(
                        if (done) Emerald400.copy(alpha = 0.2f)
                        else Primary500.copy(alpha = 0.2f),
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = if (done) Icons.Default.CheckCircle else Icons.Default.Place,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp),
                    tint = if (done) Emerald400 else Primary400,
                )
            }
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 12.dp),
            ) {
                Text(
                    text = platform.label ?: "${platform.type}-${platform.number}",
                    style = MaterialTheme.typography.titleMedium,
                    color = TextPrimary,
                )
                Text(
                    text = "${platform.samplesCollected}/${platform.samplesTotal} собрано",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary,
                )
            }
            Icon(
                imageVector = Icons.Default.KeyboardArrowRight,
                contentDescription = null,
                tint = TextSecondary,
            )
        }
    }
}
