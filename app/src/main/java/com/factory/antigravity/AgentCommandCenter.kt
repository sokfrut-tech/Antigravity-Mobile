package com.factory.antigravity

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext

private enum class CommandScreen(val title: String, val shortTitle: String, val glyph: String) {
    OVERVIEW("Командный центр", "Обзор", "⌂"),
    TASKS("Задачи фабрики", "Задачи", "▤"),
    AGENTS("Команда ИИ", "Агенты", "◈"),
    SESSIONS("Сеансы ИИ", "Сеансы", "◎"),
    PROJECTS("Проекты", "Проекты", "▦"),
    APPROVALS("Разрешения", "Допуск", "✓"),
    ARTIFACTS("Материалы работы", "Файлы", "▧"),
    CONNECTIONS("Подключения", "Связь", "⌁")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun AgentCommandCenterShell() {
    var screenName by rememberSaveable { mutableStateOf(CommandScreen.OVERVIEW.name) }
    var moreExpanded by remember { mutableStateOf(false) }
    var reducedMotion by rememberSaveable { mutableStateOf(false) }
    val screen = CommandScreen.valueOf(screenName)

    MaterialTheme(colorScheme = darkColorScheme(
        primary = Color(0xFF9BFF57), onPrimary = Color(0xFF10210B),
        secondary = Color(0xFFE0AE45), background = Color(0xFF09130F),
        surface = Color(0xFF101D17), surfaceVariant = Color(0xFF1A2A20),
        onSurface = Color(0xFFE9E4D1), onSurfaceVariant = Color(0xFFB8B99E),
        outline = Color(0xFF80633A)
    )) {
        Scaffold(
            modifier = Modifier.fillMaxSize().background(
                Brush.verticalGradient(listOf(Color(0xFF14231B), Color(0xFF09110E), Color(0xFF1B160E)))
            ),
            topBar = {
                TopAppBar(title = {
                    Column {
                        Text("⚡ Antigravity Mobile", fontWeight = FontWeight.Black, fontSize = 17.sp)
                        Text(screen.title.uppercase(), style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.secondary)
                    }
                }, actions = {
                    Text("AI  /  HUB", Modifier.padding(end = 14.dp),
                        color = MaterialTheme.colorScheme.primary, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                })
            },
            bottomBar = {
                Box {
                    NavigationBar(containerColor = Color(0xFF101D17)) {
                        listOf(CommandScreen.OVERVIEW, CommandScreen.TASKS, CommandScreen.AGENTS).forEach { item ->
                            NavigationBarItem(
                                selected = screen == item,
                                onClick = { screenName = item.name },
                                icon = { Text(item.glyph, fontSize = 18.sp) },
                                label = { Text(item.shortTitle, maxLines = 1) }
                            )
                        }
                        NavigationBarItem(
                            selected = screen !in listOf(CommandScreen.OVERVIEW, CommandScreen.TASKS, CommandScreen.AGENTS),
                            onClick = { moreExpanded = true },
                            icon = { Text("⋯", fontSize = 22.sp) },
                            label = { Text("Ещё") }
                        )
                    }
                    DropdownMenu(expanded = moreExpanded, onDismissRequest = { moreExpanded = false },
                        modifier = Modifier.background(Color(0xFF18271E))) {
                        listOf(CommandScreen.SESSIONS, CommandScreen.PROJECTS, CommandScreen.APPROVALS,
                            CommandScreen.ARTIFACTS, CommandScreen.CONNECTIONS).forEach { item ->
                            DropdownMenuItem(
                                text = { Text("${item.glyph}   ${item.title}") },
                                onClick = { screenName = item.name; moreExpanded = false }
                            )
                        }
                    }
                }
            },
            containerColor = Color.Transparent
        ) { padding ->
            AnimatedContent(
                targetState = screen,
                modifier = Modifier.fillMaxSize().padding(padding),
                transitionSpec = {
                    if (reducedMotion) fadeIn(tween(1)) togetherWith fadeOut(tween(1))
                    else (fadeIn(tween(250)) + slideInHorizontally(tween(250)) { it / 7 }) togetherWith
                        (fadeOut(tween(170)) + slideOutHorizontally(tween(170)) { -it / 9 })
                },
                label = "wasteland-screen-transition"
            ) { target ->
                when (target) {
                    CommandScreen.OVERVIEW -> OverviewScreen(
                        { screenName = CommandScreen.TASKS.name },
                        { screenName = CommandScreen.AGENTS.name },
                        { screenName = CommandScreen.CONNECTIONS.name }
                    )
                    CommandScreen.TASKS -> AntigravityApp()
                    CommandScreen.AGENTS -> AgentsScreen()
                    CommandScreen.SESSIONS -> InformationScreen(
                        "Сеансы ИИ",
                        "Отдельные окна общения с каждым агентом, общие обсуждения и передача контекста между ними.",
                        "Сервис сеансов пока не подключён.",
                        listOf("Личные диалоги", "Общие комнаты команды", "Передача задачи другому ИИ", "Единая история и поиск")
                    )
                    CommandScreen.PROJECTS -> InformationScreen(
                        "Проекты", "Каждый проект получит собственную команду агентов, инструкции, доступы и историю задач.",
                        "Пока доступен локальный проект Universal AI Factory.",
                        listOf("Universal AI Factory", "Antigravity Mobile", "Добавление новых проектов")
                    )
                    CommandScreen.APPROVALS -> InformationScreen(
                        "Центр разрешений", "Опасные действия должны останавливаться до твоего подтверждения.",
                        "Активных запросов разрешения пока нет.",
                        listOf("Слияние изменений", "Публикация и развёртывание", "Изменение секретов", "Доступ к инструментам")
                    )
                    CommandScreen.ARTIFACTS -> InformationScreen(
                        "Материалы и результаты", "Отчёты, планы, патчи, скриншоты, журналы проверок и APK будут собраны в одном месте.",
                        "Удалённое хранилище артефактов пока не подключено.",
                        listOf("Планы и отчёты", "Изменения кода", "Скриншоты и записи", "Сборки APK и контрольные суммы")
                    )
                    CommandScreen.CONNECTIONS -> ConnectionsScreen(reducedMotion, { reducedMotion = it }) {
                        screenName = CommandScreen.TASKS.name
                    }
                }
            }
        }
    }
}

@Composable
private fun OverviewScreen(onTasks: () -> Unit, onAgents: () -> Unit, onConnections: () -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("ВАША AI-ФАБРИКА", color = Color(0xFFE0AE45), fontSize = 11.sp, fontWeight = FontWeight.Bold)
        Text("Все агенты. Одна команда.", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Black)
        Text("Ставь цель — координатор распределит работу, специалисты выполнят части задачи, проверяющий оценит результат.",
            color = MaterialTheme.colorScheme.onSurfaceVariant)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            MetricCard("АГЕНТЫ", "Не подключены", "ожидают настройки", Modifier.weight(1f))
            MetricCard("ЗАДАЧИ", "Локально", "Factory API не развёрнут", Modifier.weight(1f))
        }
        StatusPanel("Ядро оркестрации", "Ожидает подключения",
            "Мобильный интерфейс готовит управление. Реальная передача задач включится после развёртывания Factory API и подключения исполнителя.")
        Text("БЫСТРЫЙ ДОСТУП", color = Color(0xFFE0AE45), fontWeight = FontWeight.Bold, fontSize = 11.sp)
        ActionPanel("▤", "Открыть задачи", "Создать задачу или отправить её в фабрику", onTasks)
        ActionPanel("◈", "Команда агентов", "Посмотреть роли и состояние подключений", onAgents)
        ActionPanel("⌁", "Настроить соединение", "Factory API и будущие провайдеры", onConnections)
        Text("ПРАВИЛО ФАБРИКИ: агент считается подключённым только после успешной проверки связи.",
            color = MaterialTheme.colorScheme.secondary, style = MaterialTheme.typography.labelSmall)
    }
}

@Composable
private fun AgentsScreen() {
    val context = LocalContext.current
    val connectionStore = remember(context) { SecureTokenStore(context) }
    var apiStatus by remember { mutableStateOf("Проверка ещё не выполнялась") }
    var providerStates by remember { mutableStateOf<Map<String, ProviderAvailability>>(emptyMap()) }
    var refreshKey by remember { mutableStateOf(0) }

    LaunchedEffect(refreshKey) {
        val baseUrl = connectionStore.baseUrl()
        val token = connectionStore.readToken()
        if (baseUrl.isNullOrBlank() || token.isNullOrBlank()) {
            apiStatus = "Сначала настройте Factory API в разделе «Задачи»"
            providerStates = emptyMap()
        } else {
            apiStatus = "Проверяем Worker и D1…"
            runCatching { FactoryApiClient.health(baseUrl, token) }
                .onSuccess { apiStatus = "Worker + D1 доступны" }
                .onFailure { apiStatus = it.message ?: "Factory API недоступен" }
            runCatching { FactoryApiClient.providers(baseUrl, token) }
                .onSuccess { states -> providerStates = states.associateBy { it.id } }
                .onFailure { providerStates = emptyMap() }
        }
    }
    fun providerLabel(id: String): String = when (providerStates[id]?.configured) {
        true -> "Серверный ключ настроен; доступность проверится при запуске"
        false -> "Ключ не настроен на сервере"
        null -> "Статус неизвестен — проверьте Factory API"
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("КОМАНДА", color = Color(0xFFE0AE45), fontSize = 11.sp, fontWeight = FontWeight.Bold)
        Text("Специалисты ИИ", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Black)
        Text("Координатор выбирает доступного исполнителя. Если ключа нет, приложение не изображает подключение и не запускает фиктивную задачу.",
            color = MaterialTheme.colorScheme.onSurfaceVariant)
        StatusPanel("Factory API", apiStatus, "Проверяется реальный Worker и состояние D1. Ключи провайдеров не передаются в приложение.")
        AgentCard("◈", "Antigravity", "Координатор / диспетчер задач", if (apiStatus == "Worker + D1 доступны") "Factory API доступен" else "Worker не подтверждён")
        AgentCard("✦", "Claude", "Архитектура, анализ и ревью", providerLabel("claude"))
        AgentCard("✧", "Gemini", "Исследования, Android и мультимодальные задачи", providerLabel("gemini"))
        AgentCard("◎", "OpenAI", "Планирование и независимая проверка", providerLabel("openai"))
        AgentCard("＋", "Собственный агент", "Будущий частный агент Universal AI Factory", "Можно добавить позднее")
        StatusPanel("Автоматический выбор", "Gemini → Claude → OpenAI",
            "Выбирается первый настроенный серверный провайдер. При неоднозначном сетевом результате автоматический повтор запрещён.")
        StatusPanel("Связь между агентами", "Одношаговая передача задачи",
            "Полноценный handoff с корреляционным ID, подтверждением, независимым reviewer и общей лентой событий — следующий этап. GitHub ACK не считается ответом модели.")
        TextButton(onClick = { refreshKey++ }) { Text("Обновить состояние подключений") }
    }
}

@Composable
private fun ConnectionsScreen(reducedMotion: Boolean, onReducedMotionChange: (Boolean) -> Unit, onOpenTasks: () -> Unit) {
    val context = LocalContext.current
    val connectionStore = remember(context) { SecureTokenStore(context) }
    var apiStatus by remember { mutableStateOf("Проверка ещё не выполнялась") }
    var providerStatus by remember { mutableStateOf("Статус неизвестен") }
    var refreshKey by remember { mutableStateOf(0) }

    LaunchedEffect(refreshKey) {
        val baseUrl = connectionStore.baseUrl()
        val token = connectionStore.readToken()
        if (baseUrl.isNullOrBlank() || token.isNullOrBlank()) {
            apiStatus = "Адрес API или токен не настроен"
            providerStatus = "Настройте Factory API, чтобы проверить ключи"
        } else {
            apiStatus = "Проверяем Worker и D1…"
            runCatching { FactoryApiClient.health(baseUrl, token) }
                .onSuccess { apiStatus = "Worker + D1 доступны" }
                .onFailure { apiStatus = it.message ?: "Factory API недоступен" }
            runCatching { FactoryApiClient.providers(baseUrl, token) }
                .onSuccess { providers ->
                    val ready = providers.filter { it.configured }.map { it.id }
                    providerStatus = if (ready.isEmpty()) "Серверные ключи провайдеров не настроены"
                    else "Настроены ключи: " + ready.joinToString(", ")
                }
                .onFailure { providerStatus = "Не удалось прочитать конфигурацию провайдеров" }
        }
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("ИНФРАСТРУКТУРА", color = Color(0xFFE0AE45), fontSize = 11.sp, fontWeight = FontWeight.Bold)
        Text("Подключения", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Black)
        StatusPanel("Factory API", apiStatus, "Проверяется реальный Worker и база D1. Секреты не передаются в приложение.")
        StatusPanel("Claude / Gemini / OpenAI", providerStatus,
            "Наличие ключа не подтверждает его действительность. Она проверяется при реальном запуске задачи.")
        StatusPanel("GitHub", "Через серверный адаптер",
            "Inbox/outbox остаётся проверяемым каналом обмена, но не заменяет подтверждение агента.")
        TextButton(onClick = { refreshKey++ }) { Text("Проверить подключения сейчас") }
        Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF18271E))) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("ЭФФЕКТЫ И ПЕРЕХОДЫ", fontWeight = FontWeight.Bold, color = Color(0xFFE0AE45))
                Text("Короткий сдвиг и плавное появление экранов в стиле игрового интерфейса.")
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Уменьшить анимацию", modifier = Modifier.weight(1f))
                    Switch(checked = reducedMotion, onCheckedChange = onReducedMotionChange)
                }
            }
        }
        AssistChip(onClick = onOpenTasks, label = { Text("Открыть настройки API в задачах") })
    }
}

@Composable
private fun InformationScreen(title: String, description: String, status: String, features: List<String>) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("РАБОЧЕЕ ПРОСТРАНСТВО", color = Color(0xFFE0AE45), fontSize = 11.sp, fontWeight = FontWeight.Bold)
        Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Black)
        Text(description, color = MaterialTheme.colorScheme.onSurfaceVariant)
        StatusPanel(title, "Подготовлено к интеграции", status)
        features.forEachIndexed { index, feature ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF192A20))
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("${index + 1}", color = Color(0xFF9BFF57), fontWeight = FontWeight.Bold)
                    Text(feature, color = MaterialTheme.colorScheme.onSurface)
                }
            }
        }
    }
}

@Composable
private fun MetricCard(label: String, value: String, detail: String, modifier: Modifier = Modifier) {
    Card(modifier, shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = Color(0xFF192A20))) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(label, color = Color(0xFFE0AE45), fontSize = 10.sp, fontWeight = FontWeight.Bold)
            Text(value, fontSize = 21.sp, fontWeight = FontWeight.Black)
            Text(detail, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun StatusPanel(title: String, status: String, detail: String) {
    Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xE6192A20))) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(title, fontWeight = FontWeight.Bold, color = Color(0xFFF0D99B))
            Text(status, color = MaterialTheme.colorScheme.secondary, fontWeight = FontWeight.SemiBold)
            Text(detail, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
        }
    }
}

@Composable
private fun AgentCard(glyph: String, name: String, role: String, status: String) {
    Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF192A20))) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.size(42.dp).background(Color(0xFF293B2B), RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center) {
                Text(glyph, fontSize = 20.sp, color = Color(0xFF9BFF57))
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(name, fontWeight = FontWeight.Bold)
                Text(role, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                Text(status, color = Color(0xFFE0AE45), style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}

@Composable
private fun ActionPanel(glyph: String, title: String, detail: String, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF192A20))) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(glyph, fontSize = 19.sp, color = Color(0xFF9BFF57))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(title, fontWeight = FontWeight.Bold)
                Text(detail, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            }
            Text("›", color = Color(0xFFE0AE45), fontSize = 24.sp)
        }
    }
}
