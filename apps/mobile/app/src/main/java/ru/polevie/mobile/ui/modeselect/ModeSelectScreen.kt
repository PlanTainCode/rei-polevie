package ru.polevie.mobile.ui.modeselect

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.Landscape
import androidx.compose.material.icons.filled.ShowChart
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import kotlin.OptIn
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.polevie.mobile.ui.components.AppHeader
import ru.polevie.mobile.ui.theme.BgPrimary
import ru.polevie.mobile.ui.theme.BgSecondary
import ru.polevie.mobile.ui.theme.BorderColor
import ru.polevie.mobile.ui.theme.Amber400
import ru.polevie.mobile.ui.theme.Amber500
import ru.polevie.mobile.ui.theme.Cyan400
import ru.polevie.mobile.ui.theme.Cyan500
import ru.polevie.mobile.ui.theme.Primary400
import ru.polevie.mobile.ui.theme.Primary500
import ru.polevie.mobile.ui.theme.TextPrimary
import ru.polevie.mobile.ui.theme.TextSecondary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ModeSelectScreen(
    onNavigateToProjects: () -> Unit,
    onNavigateToMonitorings: () -> Unit,
    onNavigateToGts: () -> Unit,
    onLogout: () -> Unit,
    viewModel: ModeSelectViewModel = hiltViewModel(),
) {
    val isSyncing by viewModel.isSyncing.collectAsState()
    val lastSyncTime by viewModel.lastSyncTime.collectAsState()
    val pendingSyncCount by viewModel.pendingSyncCount.collectAsState()
    val syncError by viewModel.syncError.collectAsState()
    val userDisplayName by viewModel.userDisplayName.collectAsState()

    Column(modifier = Modifier.fillMaxSize().background(BgPrimary)) {
        AppHeader(
            userDisplayName = userDisplayName,
            onLogout = {
                viewModel.logout()
                onLogout()
            },
        )

        PullToRefreshBox(
            isRefreshing = isSyncing,
            onRefresh = { viewModel.refreshSync() },
            modifier = Modifier.fillMaxSize(),
            indicator = { /* скрываем дефолтный индикатор, используем свой ниже */ },
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                if (isSyncing) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(vertical = 8.dp),
                    ) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), color = Primary500)
                        Spacer(modifier = Modifier.size(8.dp))
                        Text("Синхронизация...", color = TextSecondary, style = MaterialTheme.typography.bodySmall)
                    }
                } else if (lastSyncTime != null) {
                    Text(
                        text = "Обновлено: $lastSyncTime",
                        color = TextSecondary,
                        style = MaterialTheme.typography.labelSmall,
                        modifier = Modifier.padding(vertical = 2.dp),
                    )
                }
                syncError?.let { err ->
                    Text(text = err, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.labelSmall)
                }
                if (pendingSyncCount > 0) {
                    Box(
                        modifier = Modifier
                            .padding(vertical = 2.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Primary500.copy(alpha = 0.2f))
                            .padding(horizontal = 10.dp, vertical = 4.dp),
                    ) {
                        Text(text = "Ожидает: $pendingSyncCount", color = Primary400, style = MaterialTheme.typography.labelSmall)
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                Text(
                    text = "Полевые работы",
                    style = MaterialTheme.typography.titleLarge,
                    color = TextPrimary,
                )
                Spacer(modifier = Modifier.height(16.dp))

                // Объекты
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onNavigateToProjects() },
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = BgSecondary),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, BorderColor, RoundedCornerShape(16.dp))
                            .padding(24.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(56.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Primary500.copy(alpha = 0.2f)),
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(
                                    imageVector = Icons.Default.FolderOpen,
                                    contentDescription = null,
                                    modifier = Modifier.size(28.dp),
                                    tint = Primary400,
                                )
                            }
                            Text(
                                text = "Объекты",
                                style = MaterialTheme.typography.titleMedium,
                                color = TextPrimary,
                                textAlign = TextAlign.Center,
                            )
                            Text(
                                text = "Площадки и пробы грунта",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextSecondary,
                                textAlign = TextAlign.Center,
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))

                // Мониторинги
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onNavigateToMonitorings() },
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = BgSecondary),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, BorderColor, RoundedCornerShape(16.dp))
                            .padding(24.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(56.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Cyan500.copy(alpha = 0.2f)),
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(
                                    imageVector = Icons.Default.ShowChart,
                                    contentDescription = null,
                                    modifier = Modifier.size(28.dp),
                                    tint = Cyan400,
                                )
                            }
                            Text(
                                text = "Мониторинги",
                                style = MaterialTheme.typography.titleMedium,
                                color = TextPrimary,
                                textAlign = TextAlign.Center,
                            )
                            Text(
                                text = "Пробы воды и донных отложений",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextSecondary,
                                textAlign = TextAlign.Center,
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))

                // ГТС
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onNavigateToGts() },
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = BgSecondary),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, BorderColor, RoundedCornerShape(16.dp))
                            .padding(24.dp),
                    ) {
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(56.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Amber500.copy(alpha = 0.2f)),
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Landscape,
                                    contentDescription = null,
                                    modifier = Modifier.size(28.dp),
                                    tint = Amber400,
                                )
                            }
                            Text(
                                text = "Мониторинг ГТС",
                                style = MaterialTheme.typography.titleMedium,
                                color = TextPrimary,
                                textAlign = TextAlign.Center,
                            )
                            Text(
                                text = "Гидротехнические сооружения",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextSecondary,
                                textAlign = TextAlign.Center,
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(48.dp))
            }
        }
    }
}
