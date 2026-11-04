package com.factory.antigravity

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AgentCommandCenterNavigationTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<MainActivity>()

    @Test
    fun agentsDestinationShowsRealUnconfiguredProviderStates() {
        composeRule.onNodeWithText("Агенты").performClick()
        composeRule.onNodeWithText("Специалисты ИИ").assertIsDisplayed()
        composeRule.onNodeWithText("Worker не подтверждён").assertIsDisplayed()
        composeRule.onNodeWithText("Claude").assertIsDisplayed()
        composeRule.onNodeWithText("Связь между агентами").performScrollTo().assertIsDisplayed()
    }
}
