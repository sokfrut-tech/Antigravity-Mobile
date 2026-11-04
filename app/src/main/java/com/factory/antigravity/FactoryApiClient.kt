package com.factory.antigravity

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import org.json.JSONArray
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.security.MessageDigest

internal data class TaskProgressSnapshot(val progressPercent: Int?, val isRunning: Boolean, val status: String?)

internal data class TaskSubmission(val id: String)\ninternal data class ProviderAvailability(val id: String, val configured: Boolean, val defaultModel: String)\ninternal data class TaskDispatchResult(val runId: String, val provider: String, val model: String, val status: String, val output: String)

internal object FactoryApiClient {
    suspend fun health(baseUrl: String, token: String?): String = withContext(Dispatchers.IO) {
        val normalized = baseUrl.trim().trimEnd('/')
        val uri = runCatching { URI(normalized) }.getOrNull()
        require(uri != null && uri.scheme == "https" && !uri.host.isNullOrBlank() &&
            uri.userInfo == null && uri.query == null && uri.fragment == null) {
            "Нужен корректный HTTPS-адрес Factory API."
        }

        val connection = (URL("$normalized/v1/health").openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 10_000
            readTimeout = 10_000
            token?.takeIf { it.isNotBlank() }?.let { setRequestProperty("Authorization", "Bearer $it") }
        }
        try {
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (code !in 200..299) {
                val message = runCatching {
                    JSONObject(body).getJSONObject("error").optString("message")
                }.getOrNull().orEmpty()
                throw IOException(if (message.isNotBlank()) message else "Factory API вернул HTTP $code.")
            }
            val status = JSONObject(body).optString("status")
            if (status != "ok") throw IOException("Factory API отвечает, но сообщает о неполной настройке.")
            "Соединение с Factory API успешно."
        } finally {
            connection.disconnect()
        }
    }
    suspend fun createTask(
        baseUrl: String,
        token: String,
        localTaskId: Long,
        title: String,
        details: String
    ): TaskSubmission = withContext(Dispatchers.IO) {
        require(token.isNotBlank()) { "Сначала сохраните bearer token в настройках подключения." }
        val normalized = baseUrl.trim().trimEnd('/')
        val uri = runCatching { URI(normalized) }.getOrNull()
        require(uri != null && uri.scheme == "https" && !uri.host.isNullOrBlank() &&
            uri.userInfo == null && uri.query == null && uri.fragment == null) {
            "Нужен корректный HTTPS-адрес Factory API."
        }

        val taskFingerprint = MessageDigest.getInstance("SHA-256")
            .digest("$title\\n$details".toByteArray(Charsets.UTF_8))
            .take(12)
            .joinToString("") { "%02x".format(it) }
        val idempotencyKey = "mobile-$localTaskId-$taskFingerprint"
        val body = JSONObject()
            .put("title", title)
            .put("brief", details.ifBlank { "Task submitted from Antigravity Mobile." })
            .put("projectId", "antigravity-mobile")
            .put("repository", "sokfrut-tech/Antigravity-Mobile")
            .put("priority", "normal")
            .put("acceptanceCriteria", JSONArray().put("Task is stored and visible in Universal AI Factory."))

        val connection = (URL("$normalized/v1/tasks").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 10_000
            readTimeout = 15_000
            doOutput = true
            setRequestProperty("Authorization", "Bearer $token")
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            setRequestProperty("Idempotency-Key", idempotencyKey)
        }
        try {
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val responseBody = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (code !in 200..299) {
                val message = runCatching {
                    JSONObject(responseBody).getJSONObject("error").optString("message")
                }.getOrNull().orEmpty()
                throw IOException(if (message.isNotBlank()) message else "Factory API вернул HTTP $code.")
            }
            val taskId = JSONObject(responseBody).optString("id")
            if (taskId.isBlank()) throw IOException("Factory API ответил без ID задачи.")
            TaskSubmission(taskId)
        } finally {
            connection.disconnect()
        }
    }



    suspend fun providers(baseUrl: String, token: String): List<ProviderAvailability> = withContext(Dispatchers.IO) {
        val normalized = baseUrl.trim().trimEnd('/')
        val uri = runCatching { URI(normalized) }.getOrNull()
        require(uri != null && uri.scheme == "https" && !uri.host.isNullOrBlank() &&
            uri.userInfo == null && uri.query == null && uri.fragment == null) {
            "Нужен корректный HTTPS-адрес Factory API."
        }
        val connection = (URL("$normalized/v1/providers").openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 10_000
            readTimeout = 10_000
            setRequestProperty("Authorization", "Bearer $token")
        }
        try {
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (code !in 200..299) throw IOException("Не удалось проверить провайдеров (HTTP $code).")
            val array = JSONObject(body).optJSONArray("providers") ?: JSONArray()
            buildList {
                for (i in 0 until array.length()) {
                    val item = array.optJSONObject(i) ?: continue
                    add(ProviderAvailability(item.optString("id"), item.optBoolean("configured"), item.optString("defaultModel")))
                }
            }
        } finally {
            connection.disconnect()
        }
    }

    suspend fun dispatchTask(
        baseUrl: String,
        token: String,
        remoteTaskId: String,
        localTaskId: Long,
        title: String,
        details: String
    ): TaskDispatchResult = withContext(Dispatchers.IO) {
        val normalized = baseUrl.trim().trimEnd('/')
        val uri = runCatching { URI(normalized) }.getOrNull()
        require(uri != null && uri.scheme == "https" && !uri.host.isNullOrBlank() &&
            uri.userInfo == null && uri.query == null && uri.fragment == null) {
            "Нужен корректный HTTPS-адрес Factory API."
        }
        val safeId = remoteTaskId.takeIf { it.matches(Regex("[0-9a-fA-F-]{36}")) }
            ?: throw IOException("Некорректный ID задачи Factory.")
        val fingerprint = MessageDigest.getInstance("SHA-256")
            .digest("$title\\n$details".toByteArray(Charsets.UTF_8))
            .take(12).joinToString("") { "%02x".format(it) }
        val runKey = "mobile-run-$localTaskId-$fingerprint"
        val body = JSONObject().put("runKey", runKey).put("provider", "auto").put("role", "implementer")
        val connection = (URL("$normalized/v1/tasks/$safeId/dispatch").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 10_000
            readTimeout = 40_000
            doOutput = true
            setRequestProperty("Authorization", "Bearer $token")
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
        }
        try {
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val code = connection.responseCode
            val stream = if (code in 200..299 || code == 202) connection.inputStream else connection.errorStream
            val responseBody = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            val response = runCatching { JSONObject(responseBody) }.getOrNull() ?: JSONObject()
            if (code !in 200..299 || code == 202) {
                val message = response.optJSONObject("error")?.optString("message").orEmpty()
                val status = response.optString("status")
                throw IOException(when {
                    status == "outcome_unknown" -> "Ответ агента пока неизвестен. Повторный запуск заблокирован во избежание дублирования."
                    message.isNotBlank() -> message
                    else -> "Фабрика вернула HTTP $code."
                })
            }
            val output = response.optString("output")
            if (output.isBlank()) throw IOException("Фабрика не вернула текстовый результат.")
            TaskDispatchResult(
                runId = response.optString("runId"),
                provider = response.optString("provider"),
                model = response.optString("model"),
                status = response.optString("status"),
                output = output
            )
        } finally {
            connection.disconnect()
        }
    }

    internal suspend fun taskProgress(baseUrl: String, token: String, remoteTaskId: String): TaskProgressSnapshot =
        withContext(Dispatchers.IO) {
            val normalized = baseUrl.trim().trimEnd('/')
            val uri = runCatching { URI(normalized) }.getOrNull()
            require(uri != null && uri.scheme == "https" && !uri.host.isNullOrBlank() &&
                uri.userInfo == null && uri.query == null && uri.fragment == null) {
                "Нужен корректный HTTPS-адрес Factory API."
            }
            val safeId = remoteTaskId.takeIf { it.matches(Regex("[0-9a-fA-F-]{36}")) }
                ?: throw IOException("Некорректный ID задачи Factory.")
            val connection = (URL("$normalized/v1/tasks/$safeId/events?limit=100").openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 8_000
                readTimeout = 8_000
                setRequestProperty("Authorization", "Bearer $token")
            }
            try {
                val code = connection.responseCode
                val stream = if (code in 200..299) connection.inputStream else connection.errorStream
                val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
                if (code !in 200..299) throw IOException("Не удалось получить прогресс задачи (HTTP $code).")
                val events = JSONArray(body)
                var progress: Int? = null
                var status: String? = null
                for (i in 0 until events.length()) {
                    val event = events.optJSONObject(i) ?: continue
                    val data = event.optJSONObject("data") ?: JSONObject()
                    if (data.has("progressPercent")) progress = data.optInt("progressPercent").coerceIn(0, 100)
                    if (data.has("status")) status = data.optString("status")
                    when (event.optString("type")) {
                        "completed" -> { progress = 100; status = "completed" }
                        "failed" -> status = "failed"
                    }
                }
                TaskProgressSnapshot(
                    progressPercent = progress,
                    isRunning = status in setOf("queued", "accepted", "planning", "running", "review"),
                    status = status
                )
            } finally {
                connection.disconnect()
            }
        }

}
