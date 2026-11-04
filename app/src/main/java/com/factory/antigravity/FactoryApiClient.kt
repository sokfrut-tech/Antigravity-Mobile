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

internal data class TaskProgressSnapshot(val progressPercent: Int?, val isRunning: Boolean, val status: String?)\n\ninternal data class TaskSubmission(val id: String)\n\ninternal object FactoryApiClient {
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

}
