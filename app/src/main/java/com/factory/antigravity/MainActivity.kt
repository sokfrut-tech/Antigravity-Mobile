package com.factory.antigravity

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.geometry.Offset
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import kotlinx.coroutines.launch

internal data class BoardTask(
    val id: Long,
    val title: String,
    val details: String = "",
    val status: TaskStatus = TaskStatus.TODO,
    val progressPercent: Int? = null,
    val isRunning: Boolean = false,
    val remoteTaskId: String? = null
)

internal enum class TaskStatus(val label: String) {
    TODO("Новые"), IN_PROGRESS("В работе"), DONE("Готово");
    fun next() = when (this) {
        TODO -> IN_PROGRESS
        IN_PROGRESS -> DONE
        DONE -> TODO
    }
    fun previous() = when (this) {
        TODO -> DONE
        IN_PROGRESS -> TODO
        DONE -> IN_PROGRESS
    }
}

private val AntigravityDarkColors = darkColorScheme(
    primary = Color(0xFF8BFF4A), onPrimary = Color(0xFF10210B),
    secondary = Color(0xFFE0AE45), onSecondary = Color(0xFF241707),
    background = Color(0xFF09130F), onBackground = Color(0xFFE9E4D1),
    surface = Color(0xFF101D17), onSurface = Color(0xFFE9E4D1),
    surfaceVariant = Color(0xFF1A2A20), onSurfaceVariant = Color(0xFFB8B99E),
    outline = Color(0xFF80633A)
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { AgentCommandCenterShell() }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun AntigravityApp() {
    val context = LocalContext.current
    val storage = remember(context) { TaskStorage(context) }
    val connectionStore = remember(context) { SecureTokenStore(context) }
    val scope = rememberCoroutineScope()
    var showConnectionDialog by rememberSaveable { mutableStateOf(false) }
    var showAddDialog by rememberSaveable { mutableStateOf(false) }
    var connectionStatus by rememberSaveable {
        mutableStateOf(if (connectionStore.baseUrl() != null) "Настройки подключения сохранены" else "Factory API не настроен")
    }

    // Preserve offline-first persistence; do not replace it with demo-only in-memory state.
    val tasks = remember {
        mutableStateListOf<BoardTask>().apply {
            val saved = storage.load()
            if (saved != null) addAll(saved)
            else addAll(listOf(
                BoardTask(1, "Подключить фабрику", "Подготовить мобильное рабочее пространство"),
                BoardTask(2, "Собрать первый APK", "Настроить автоматическую Android-сборку", TaskStatus.IN_PROGRESS),
                BoardTask(3, "Проверить рабочий процесс", "Проверить доску задач и навигацию", TaskStatus.DONE)
            ))
        }
    }
    LaunchedEffect(tasks.toList()) { storage.save(tasks.toList()) }

    // Poll only tasks actually created in Factory. No synthetic progress is generated locally.
    LaunchedEffect(connectionStore, tasks.size) {
        while (true) {
            val baseUrl = connectionStore.baseUrl()
            val token = connectionStore.readToken()
            if (!baseUrl.isNullOrBlank() && !token.isNullOrBlank()) {
                tasks.toList().filter { it.remoteTaskId != null }.forEach { tracked ->
                    runCatching { FactoryApiClient.taskProgress(baseUrl, token, tracked.remoteTaskId!!) }
                        .onSuccess { snapshot ->
                            val index = tasks.indexOfFirst { it.id == tracked.id }
                            if (index >= 0) {
                                val current = tasks[index]
                                tasks[index] = current.copy(
                                    progressPercent = snapshot.progressPercent ?: current.progressPercent,
                                    isRunning = snapshot.isRunning,
                                    status = when (snapshot.status) {
                                        "completed" -> TaskStatus.DONE
                                        "running", "planning", "accepted", "queued", "review" -> TaskStatus.IN_PROGRESS
                                        else -> current.status
                                    }
                                )
                            }
                        }
                }
            }
            kotlinx.coroutines.delay(2500)
        }
    }

    var selectedTab by rememberSaveable { mutableStateOf(TaskStatus.TODO.name) }
    val selectedStatus = TaskStatus.valueOf(selectedTab)
    val statuses = TaskStatus.entries

    MaterialTheme(colorScheme = AntigravityDarkColors) {
        Scaffold(
            modifier = Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF14231B), Color(0xFF09110E), Color(0xFF1B160E)))).drawBehind {
                drawCircle(Color(0xFF8BFF4A).copy(alpha = 0.035f), radius = size.width * 0.72f, center = Offset(size.width * 0.92f, size.height * 0.18f), style = Stroke(width = 2.dp.toPx()))
                drawCircle(Color(0xFFE0AE45).copy(alpha = 0.045f), radius = size.width * 0.48f, center = Offset(size.width * 0.02f, size.height * 0.82f), style = Stroke(width = 1.dp.toPx()))
            },
            topBar = {
                Column {
                    TopAppBar(
                        title = {
                            Column {
                                Text(
                                    "⚡ Antigravity Mobile",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 18.sp,
                                    maxLines = 1,
                                    softWrap = false
                                )
                            }
                        },
                        actions = {
                            TextButton(onClick = { showConnectionDialog = true }) { Text("API") }
                        }
                    )
                    ScrollableTabRow(
                        selectedTabIndex = statuses.indexOf(selectedStatus),
                        edgePadding = 16.dp,
                        containerColor = MaterialTheme.colorScheme.surface
                    ) {
                        statuses.forEach { status ->
                            val count = tasks.count { it.status == status }
                            val label = when (status) {
                                TaskStatus.TODO -> "Новые ($count)"
                                TaskStatus.IN_PROGRESS -> "В работе ($count)"
                                TaskStatus.DONE -> "Готово ($count)"
                            }
                            Tab(
                                selected = selectedStatus == status,
                                onClick = { selectedTab = status.name },
                                text = { Text(label, style = MaterialTheme.typography.bodyMedium, maxLines = 1, softWrap = false) }
                            )
                        }
                    }
                }
            },
            floatingActionButton = {
                FloatingActionButton(onClick = { showAddDialog = true }, containerColor = Color(0xFF8BFF4A), contentColor = Color(0xFF10210B)) { Text("+", fontSize = 26.sp, fontWeight = FontWeight.Black) }
            },
            bottomBar = {
                Surface(color = MaterialTheme.colorScheme.surface) {
                    Text(
                        "v0.3.0 · Задачи сохраняются на устройстве",
                        modifier = Modifier
                            .fillMaxWidth()
                            .navigationBarsPadding()
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.labelSmall,
                        maxLines = 1
                    )
                }
            },
            containerColor = Color.Transparent
        ) { innerPadding ->
            val visibleTasks = tasks.filter { it.status == selectedStatus }
            Column(
                modifier = Modifier.fillMaxSize().padding(innerPadding).padding(horizontal = 16.dp, vertical = 14.dp)
            ) {
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(selectedStatus.label, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                        Text(connectionStatus, style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    TextButton(onClick = {
                        val baseUrl = connectionStore.baseUrl()
                        if (baseUrl.isNullOrBlank()) {
                            connectionStatus = "Сначала укажите адрес Factory API"
                        } else {
                            scope.launch {
                                connectionStatus = "Проверяем соединение…"
                                connectionStatus = runCatching {
                                    FactoryApiClient.health(baseUrl, connectionStore.readToken())
                                }.getOrElse { "Ошибка соединения: " + (it.message ?: "сеть недоступна") }
                            }
                        }
                    }) { Text("Проверить") }
                }
                Spacer(Modifier.height(14.dp))
                if (visibleTasks.isEmpty()) {
                    Surface(
                        modifier = Modifier.fillMaxWidth().weight(1f),
                        shape = RoundedCornerShape(22.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant
                    ) {
                        Column(
                            modifier = Modifier.padding(28.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Text("Здесь пока пусто", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                            Spacer(Modifier.height(6.dp))
                            Text("Добавьте задачу или переместите её с другой вкладки.",
                                color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        contentPadding = PaddingValues(bottom = 24.dp)
                    ) {
                        items(visibleTasks, key = { it.id }) { task ->
                            TaskCard(
                                task = task,
                                onPrevious = {
                                    val index = tasks.indexOfFirst { it.id == task.id }
                                    if (index >= 0) tasks[index] = task.copy(status = task.status.previous())
                                },
                                onNext = {
                                    val index = tasks.indexOfFirst { it.id == task.id }
                                    if (index >= 0) tasks[index] = task.copy(status = task.status.next())
                                },
                                onDelete = { tasks.removeAll { it.id == task.id } },
                                onSend = {
                                    val baseUrl = connectionStore.baseUrl()
                                    val token = connectionStore.readToken()
                                    if (baseUrl.isNullOrBlank() || token.isNullOrBlank()) {
                                        connectionStatus = "Сохраните HTTPS-адрес и bearer token в настройках"
                                    } else {
                                        scope.launch {
                                            connectionStatus = "Отправляем задачу в фабрику…"
                                            val submission = runCatching {
                                                FactoryApiClient.createTask(baseUrl, token, task.id, task.title, task.details)
                                            }
                                            connectionStatus = submission.fold(
                                                onSuccess = { result ->
                                                    val index = tasks.indexOfFirst { it.id == task.id }
                                                    if (index >= 0) tasks[index] = tasks[index].copy(remoteTaskId = result.id)
                                                    "Задача принята фабрикой. Ожидаем события агента."
                                                },
                                                onFailure = { "Не удалось отправить: " + (it.message ?: "ошибка сети") }
                                            )
                                        }
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }
    }

    if (showConnectionDialog) {
        ConnectionSettingsDialog(
            initialUrl = connectionStore.baseUrl().orEmpty(),
            hasSavedToken = connectionStore.hasToken(),
            onDismiss = { showConnectionDialog = false },
            onSave = { baseUrl, token ->
                runCatching { connectionStore.saveConnection(baseUrl, token) }
                    .onSuccess { connectionStatus = "Настройки подключения сохранены"; showConnectionDialog = false }
                    .onFailure { connectionStatus = it.message ?: "Не удалось сохранить настройки" }
            }
        )
    }
    if (showAddDialog) {
        AddTaskDialog(
            onDismiss = { showAddDialog = false },
            onAdd = { title, details ->
                val nextId = (tasks.maxOfOrNull { it.id } ?: 0L) + 1L
                tasks.add(BoardTask(nextId, title, details, TaskStatus.TODO))
                selectedTab = TaskStatus.TODO.name
                showAddDialog = false
            }
        )
    }
}

@Composable
private fun TaskCard(
    task: BoardTask,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
    onDelete: () -> Unit,
    onSend: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth().border(1.dp, Color(0xFF80633A).copy(alpha = 0.85f), RoundedCornerShape(18.dp)),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xE6192A20)),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(task.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = Color(0xFFF0D99B))
                }
                if (task.isRunning || task.progressPercent != null || task.status == TaskStatus.DONE) {
                    Spacer(Modifier.width(10.dp))
                    TaskProgressRing(
                        progress = if (task.status == TaskStatus.DONE) 100 else task.progressPercent ?: 0,
                        isRunning = task.isRunning && task.status != TaskStatus.DONE
                    )
                }
            }
            if (task.details.isNotBlank()) {
                Spacer(Modifier.height(4.dp))
                Text(task.details, style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(Modifier.height(8.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                AssistChip(onClick = onPrevious, modifier = Modifier.weight(1f),
                    label = { Text("← Назад", style = MaterialTheme.typography.labelSmall, maxLines = 1) })
                AssistChip(onClick = onNext, modifier = Modifier.weight(1f),
                    label = {
                        Text(when (task.status) {
                            TaskStatus.TODO -> "В работу →"
                            TaskStatus.IN_PROGRESS -> "Готово →"
                            TaskStatus.DONE -> "Вернуть →"
                        }, style = MaterialTheme.typography.labelSmall, maxLines = 1, softWrap = false)
                    })
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                AssistChip(onClick = onSend, modifier = Modifier.weight(1f),
                    label = { Text("⚡ Фабрика", style = MaterialTheme.typography.labelSmall, maxLines = 1) })
                AssistChip(onClick = onDelete,
                    label = { Text("Удалить", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error, maxLines = 1) })
            }
        }
    }
}

@Composable
private fun TaskProgressRing(progress: Int, isRunning: Boolean) {
    val safeProgress = progress.coerceIn(0, 100)
    val transition = rememberInfiniteTransition(label = "task-progress")
    val rotation = transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1100, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "task-progress-rotation"
    )
    Box(
        modifier = Modifier.size(42.dp),
        contentAlignment = Alignment.Center
    ) {
        if (isRunning) {
            CircularProgressIndicator(
                modifier = Modifier.fillMaxSize().graphicsLayer { rotationZ = rotation.value },
                strokeWidth = 3.dp,
                color = MaterialTheme.colorScheme.primary,
                trackColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.25f)
            )
        } else {
            CircularProgressIndicator(
                progress = { safeProgress / 100f },
                modifier = Modifier.fillMaxSize(),
                strokeWidth = 3.dp,
                color = MaterialTheme.colorScheme.primary,
                trackColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.25f)
            )
        }
        Text(
            "$safeProgress%",
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            fontSize = 9.sp
        )
    }
}

@Composable
private fun ConnectionSettingsDialog(
    initialUrl: String,
    hasSavedToken: Boolean,
    onDismiss: () -> Unit,
    onSave: (String, String) -> Unit
) {
    var baseUrl by rememberSaveable { mutableStateOf(initialUrl) }
    var token by remember { mutableStateOf("") }
    var validationMessage by rememberSaveable { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Подключение к Factory API") },
        text = {
            Column {
                OutlinedTextField(value = baseUrl, onValueChange = { baseUrl = it; validationMessage = "" },
                    label = { Text("HTTPS-адрес API") }, placeholder = { Text("https://your-worker.example.workers.dev") },
                    singleLine = true)
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(value = token, onValueChange = { token = it }, label = { Text("Bearer token") },
                    placeholder = { Text(if (hasSavedToken) "Пусто — оставить сохранённый токен" else "Введите личный токен") },
                    visualTransformation = PasswordVisualTransformation(), singleLine = true)
                Spacer(Modifier.height(8.dp))
                Text("Токен шифруется Android Keystore. Не отправляйте его в чат.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                if (validationMessage.isNotBlank()) Text(validationMessage, color = MaterialTheme.colorScheme.error)
            }
        },
        confirmButton = {
            TextButton(onClick = {
                if (baseUrl.isBlank()) validationMessage = "Укажите HTTPS-адрес API."
                else onSave(baseUrl.trim(), token)
            }) { Text("Сохранить") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } }
    )
}

@Composable
private fun AddTaskDialog(onDismiss: () -> Unit, onAdd: (String, String) -> Unit) {
    var title by rememberSaveable { mutableStateOf("") }
    var details by rememberSaveable { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Новая задача") },
        text = {
            Column {
                OutlinedTextField(value = title, onValueChange = { title = it },
                    label = { Text("Название задачи") }, singleLine = true,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences))
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(value = details, onValueChange = { details = it },
                    label = { Text("Описание (необязательно)") }, minLines = 2,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences))
            }
        },
        confirmButton = {
            TextButton(onClick = { onAdd(title.trim(), details.trim()) }, enabled = title.isNotBlank()) {
                Text("Создать")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } }
    )
}
