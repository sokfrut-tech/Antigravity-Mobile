package com.factory.antigravity

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

class TaskStorageTest {
    private lateinit var context: Context
    private lateinit var storage: TaskStorage

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .clear()
            .commit()
        storage = TaskStorage(context)
    }

    @After
    fun tearDown() {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .clear()
            .commit()
    }

    @Test
    fun savesAndRestoresAllTaskFields() {
        val tasks = listOf(
            BoardTask(10L, "Connect factory", "API setup", TaskStatus.IN_PROGRESS),
            BoardTask(11L, "Review build", "Check APK", TaskStatus.DONE)
        )

        storage.save(tasks)

        assertEquals(tasks, storage.load())
    }

    @Test
    fun intentionallyEmptyBoardRemainsEmpty() {
        storage.save(emptyList())

        assertEquals(emptyList<BoardTask>(), storage.load())
    }

    @Test
    fun missingSavedValueIsDifferentFromAnEmptyBoard() {
        assertEquals(null, storage.load())
    }

    @Test
    fun malformedJsonDoesNotCrashAndReturnsEmptyBoard() {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_TASKS, "{not-json")
            .commit()

        assertEquals(emptyList<BoardTask>(), storage.load())
    }

    @Test
    fun unknownStatusIsIgnoredSafely() {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(
                KEY_TASKS,
                """[{"id":12,"title":"Unknown status","details":"","status":"ARCHIVED"}]"""
            )
            .commit()

        assertEquals(emptyList<BoardTask>(), storage.load())
    }

    private companion object {
        const val PREFS_NAME = "antigravity_mobile_tasks"
        const val KEY_TASKS = "tasks_v1"
    }
}
