package com.factory.antigravity

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Small local persistence layer for the offline-first task board.
 * Provider credentials and remote run data must never be stored here.
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
                        add(BoardTask(id, title, details, status))
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
            )
        }
        preferences.edit().putString(KEY_TASKS, array.toString()).apply()
    }

    private companion object {
        const val PREFS_NAME = "antigravity_mobile_tasks"
        const val KEY_TASKS = "tasks_v1"
    }
}
