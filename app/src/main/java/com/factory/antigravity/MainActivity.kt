package com.factory.antigravity

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch

internal data class BoardTask(
    val id: Long,
    val title: String,
    val details: String = "",
    val status: TaskStatus = TaskStatus.TODO
)

internal enum class TaskStatus(val label: String) {
    TODO("To Do"),
    IN_PROGRESS("In Progress"),
    DONE("Done")
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { AntigravityApp() }
    }
}

@Composable
private fun AntigravityApp() {
    val context = LocalContext.current
    val storage = remember(context) { TaskStorage(context) }
    val connectionStore = remember(context) { SecureTokenStore(context) }
    val coroutineScope = rememberCoroutineScope()
    var showConnectionDialog by rememberSaveable { mutableStateOf(false) }
    var connectionStatus by rememberSaveable {
        mutableStateOf(if (connectionStore.baseUrl() != null) "Connection settings saved" else "Factory API not configured")
    }
    val tasks = remember {
        mutableStateListOf<BoardTask>().apply {
            val saved = storage.load()
            if (saved != null) {
                addAll(saved)
            } else {
                addAll(
                    listOf(
                        BoardTask(1, "Connect the factory", "Prepare the mobile workspace"),
                        BoardTask(2, "Build the first APK", "Set up the automated Android build", TaskStatus.IN_PROGRESS),
                        BoardTask(3, "Plan the next iteration", "Review the Kanban workflow", TaskStatus.DONE)
                    )
                )
            }
        }
    }
    LaunchedEffect(tasks.toList()) {
        storage.save(tasks.toList())
    }
    var selectedStatus by rememberSaveable { mutableStateOf(TaskStatus.TODO.name) }
    var showAddDialog by rememberSaveable { mutableStateOf(false) }
    val currentStatus = TaskStatus.valueOf(selectedStatus)

    MaterialTheme(
        colorScheme = MaterialTheme.colorScheme.copy(
            primary = Color(0xFF4659D8),
            secondary = Color(0xFF6875E5),
            background = Color(0xFFF5F6FA),
            surface = Color.White
        )
    ) {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = MaterialTheme.colorScheme.background
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 20.dp, vertical = 18.dp)
            ) {
                Text(
                    text = "ANTIGRAVITY",
                    color = MaterialTheme.colorScheme.primary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 2.sp
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    text = "Mobile workspace",
                    fontSize = 27.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF171A2B)
                )
                Spacer(Modifier.height(5.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Universal AI Factory · Task board",
                            color = Color(0xFF73778A),
                            fontSize = 14.sp
                        )
                        Text(connectionStatus, color = Color(0xFF85899A), fontSize = 11.sp)
                    }
                    TextButton(onClick = { showConnectionDialog = true }) { Text("Connection") }
                    TextButton(
                        onClick = {
                            val baseUrl = connectionStore.baseUrl()
                            if (baseUrl.isNullOrBlank()) {
                                connectionStatus = "Set the Factory API address first"
                            } else {
                                coroutineScope.launch {
                                    connectionStatus = "Checking Factory API…"
                                    connectionStatus = runCatching {
                                        FactoryApiClient.health(baseUrl, connectionStore.readToken())
                                    }.getOrElse { "Connection failed: ${it.message ?: "network error"}" }
                                }
                            }
                        }
                    ) { Text("Test") }
                }
                Spacer(Modifier.height(22.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    TaskStatus.entries.forEach { status ->
                        val count = tasks.count { it.status == status }
                        val selected = currentStatus == status
                        OutlinedButton(
                            onClick = { selectedStatus = status.name },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(14.dp),
                            contentPadding = androidx.compose.foundation.layout.PaddingValues(
                                horizontal = 4.dp,
                                vertical = 10.dp
                            )
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    text = count.toString(),
                                    fontWeight = FontWeight.Bold,
                                    color = if (selected) MaterialTheme.colorScheme.primary else Color(0xFF6F7385)
                                )
                                Text(
                                    text = when (status) {
                                        TaskStatus.TODO -> "To Do"
                                        TaskStatus.IN_PROGRESS -> "Doing"
                                        TaskStatus.DONE -> "Done"
                                    },
                                    fontSize = 11.sp,
                                    color = if (selected) MaterialTheme.colorScheme.primary else Color(0xFF6F7385)
                                )
                            }
                        }
                    }
                }

                Spacer(Modifier.height(18.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(currentStatus.label, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                        Text(
                            text = "${tasks.count { it.status == currentStatus }} tasks",
                            color = Color(0xFF85899A),
                            fontSize = 13.sp
                        )
                    }
                    Button(
                        onClick = { showAddDialog = true },
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("+ Add task")
                    }
                }
                Spacer(Modifier.height(12.dp))

                val visibleTasks = tasks.filter { it.status == currentStatus }
                if (visibleTasks.isEmpty()) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f)
                            .background(Color.White, RoundedCornerShape(18.dp))
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Text("Nothing here yet", fontWeight = FontWeight.SemiBold)
                        Text("Add a task or move one here.", color = Color(0xFF85899A), fontSize = 13.sp)
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        itemsIndexed(visibleTasks, key = { _, task -> task.id }) { _, task ->
                            TaskCard(
                                task = task,
                                onMove = {
                                    val index = tasks.indexOfFirst { it.id == task.id }
                                    if (index >= 0) {
                                        val next = when (task.status) {
                                            TaskStatus.TODO -> TaskStatus.IN_PROGRESS
                                            TaskStatus.IN_PROGRESS -> TaskStatus.DONE
                                            TaskStatus.DONE -> TaskStatus.TODO
                                        }
                                        tasks[index] = task.copy(status = next)
                                    }
                                },
                                onDelete = { tasks.removeAll { it.id == task.id } },
                                onSend = {
                                    val baseUrl = connectionStore.baseUrl()
                                    val token = connectionStore.readToken()
                                    if (baseUrl.isNullOrBlank() || token.isNullOrBlank()) {
                                        connectionStatus = "Save the HTTPS address and bearer token in Connection settings"
                                    } else {
                                        coroutineScope.launch {
                                            connectionStatus = "Sending task to Factory…"
                                            connectionStatus = runCatching {
                                                FactoryApiClient.createTask(
                                                    baseUrl = baseUrl,
                                                    token = token,
                                                    localTaskId = task.id,
                                                    title = task.title,
                                                    details = task.details
                                                )
                                            }.getOrElse { "Send failed: ${it.message ?: "network error"}" }
                                        }
                                    }
                                }
                            )
                        }
                    }
                }

                Spacer(Modifier.height(12.dp))
                Text(
                    text = "v0.1.0  ·  Local preview",
                    modifier = Modifier.align(Alignment.CenterHorizontally),
                    color = Color(0xFF9A9EAC),
                    fontSize = 11.sp
                )
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
                    .onSuccess {
                        connectionStatus = "Connection settings saved"
                        showConnectionDialog = false
                    }
                    .onFailure {
                        connectionStatus = it.message ?: "Could not save connection settings"
                    }
            }
        )
    }

    if (showAddDialog) {
        AddTaskDialog(
            onDismiss = { showAddDialog = false },
            onAdd = { title, details ->
                val nextId = (tasks.maxOfOrNull { it.id } ?: 0L) + 1L
                tasks.add(BoardTask(nextId, title, details, currentStatus))
                showAddDialog = false
            }
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
        title = { Text("Factory API connection") },
        text = {
            Column {
                OutlinedTextField(
                    value = baseUrl,
                    onValueChange = { baseUrl = it; validationMessage = "" },
                    label = { Text("API HTTPS address") },
                    placeholder = { Text("https://your-worker.example.workers.dev") },
                    singleLine = true
                )
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(
                    value = token,
                    onValueChange = { token = it },
                    label = { Text("Bearer token") },
                    placeholder = { Text(if (hasSavedToken) "Leave empty to keep saved token" else "Paste private token") },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    "The token is encrypted with Android Keystore and is not included in backups. Do not send it in chat.",
                    color = Color(0xFF777C8F),
                    fontSize = 12.sp
                )
                if (validationMessage.isNotBlank()) {
                    Text(validationMessage, color = Color(0xFFB14D5A), fontSize = 12.sp)
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    if (baseUrl.isBlank()) {
                        validationMessage = "Enter the HTTPS API address."
                    } else {
                        onSave(baseUrl.trim(), token)
                    }
                }
            ) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}

@Composable
private fun TaskCard(
    task: BoardTask,
    onMove: () -> Unit,
    onDelete: () -> Unit,
    onSend: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(17.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(task.title, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, color = Color(0xFF202337))
            if (task.details.isNotBlank()) {
                Spacer(Modifier.height(5.dp))
                Text(task.details, color = Color(0xFF777C8F), fontSize = 13.sp)
            }
            Spacer(Modifier.height(13.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.End
            ) {
                TextButton(onClick = onSend) {
                    Text("Send", color = MaterialTheme.colorScheme.primary, fontSize = 12.sp)
                }
                TextButton(onClick = onDelete) {
                    Text("Delete", color = Color(0xFFB14D5A), fontSize = 12.sp)
                }
                Button(onClick = onMove, shape = RoundedCornerShape(10.dp)) {
                    Text(
                        when (task.status) {
                            TaskStatus.TODO -> "Start →"
                            TaskStatus.IN_PROGRESS -> "Complete →"
                            TaskStatus.DONE -> "Reopen ↺"
                        },
                        fontSize = 12.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun AddTaskDialog(
    onDismiss: () -> Unit,
    onAdd: (String, String) -> Unit
) {
    var title by rememberSaveable { mutableStateOf("") }
    var details by rememberSaveable { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New task") },
        text = {
            Column {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Task name") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences)
                )
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(
                    value = details,
                    onValueChange = { details = it },
                    label = { Text("Details (optional)") },
                    minLines = 2,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences)
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { onAdd(title.trim(), details.trim()) }, enabled = title.isNotBlank()) {
                Text("Add")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )
}
