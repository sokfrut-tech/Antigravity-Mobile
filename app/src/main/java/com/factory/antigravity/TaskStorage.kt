package com.factory.antigravity

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Small local persistence layer for the offline-first task board.
 * Provider credentials and secret metadata must never be stored here. Bounded agent output\n * is a user-visible local artifact and is persisted with its task.
 */
internal class TaskStorage(context: Context) {
    private val preferences = context.applicationContext.getSharedPreferences(
        PREFS_NAME,
        Context.MODE_PRIVATE
    )

    fun load(): List<BoardTask>? {
        val raw = preferences.getString(KEY_TASKS, null) ?: return null
        return try {
            val array = JSONArray(raw)
            buildList {
                for (index in 0 until array.length()) {
                    val item = array.optJSONObject(index) ?: continue
                    val id = item.optLong("id", -1L)
                    val title = item.optString("title").trim()
                    val details = item.optString("details")
                    val statusName = item.optString("status")
                    val status = runCatching { TaskStatus.valueOf(statusName) }.getOrNull()
                    if (id > 0L && title.isNotBlank() && status != null) {
                        val progress = if (item.has("progressPercent") && !item.isNull("progressPercent")) item.optInt("progressPercent").coerceIn(0, 100) else null
                        add(BoardTask(id, title, details, status, progressPercent = progress, isRunning = false, remoteTaskId = item.optString("remoteTaskId").takeIf { it.isNotBlank() }, remoteRunId = item.optString("remoteRunId").takeIf { it.isNotBlank() }, agentOutput = item.optString("agentOutput").takeIf { it.isNotBlank() }))
                    }
                }
            }
        } catch (_: Exception) {
            // A malformed local cache should not prevent the app from opening.
            emptyList()
        }
    }

    fun save(tasks: List<BoardTask>) {
        val array = JSONArray()
        tasks.forEach { task ->
            array.put(
                JSONObject()
                    .put("id", task.id)
                    .put("title", task.title)
                    .put("details", task.details)
                    .put("status", task.status.name)
                    .put("progressPercent", task.progressPercent)
                    .put("remoteTaskId", task.remoteTaskId)
                    .put("remoteRunId", task.remoteRunId)
                    .put("agentOutput", task.agentOutput)
            )
        }
        preferences.edit().putString(KEY_TASKS, array.toString()).apply()
    }

    private companion object {
        const val PREFS_NAME = "antigravity_mobile_tasks"
        const val KEY_TASKS = "tasks_v1"
    }
}
