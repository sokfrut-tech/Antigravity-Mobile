package com.factory.antigravity

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL

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
}
