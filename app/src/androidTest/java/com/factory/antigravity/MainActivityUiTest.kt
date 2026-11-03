package com.factory.antigravity

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MainActivityUiTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<MainActivity>()

    @Test
    fun userCanOpenConnectionSettingsAndCreateTask() {
        composeRule.onNodeWithText("Antigravity Mobile", substring = true).assertIsDisplayed()

        composeRule.onNodeWithText("Подключение").performClick()
        composeRule.onNodeWithText("Подключение к Factory API").assertIsDisplayed()
        composeRule.onNodeWithText("Отмена").performClick()

        composeRule.onNodeWithText("+").performClick()
        composeRule.onNodeWithText("Новая задача").assertIsDisplayed()
        composeRule.onNodeWithText("Название задачи").performTextInput("Проверка на Android-эмуляторе")
        composeRule.onNodeWithText("Создать").performClick()

        composeRule.onNodeWithText("Проверка на Android-эмуляторе").assertIsDisplayed()
    }
}
