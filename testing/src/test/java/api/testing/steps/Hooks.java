package api.testing.steps;

import io.cucumber.java.After;
import io.cucumber.java.Before;
import io.cucumber.java.Scenario;
import io.qameta.allure.Allure;

/**
 * Cucumber hooks for setup/teardown with Allure reporting integration.
 */
public class Hooks {

    @Before
    public void beforeScenario(Scenario scenario) {
        Allure.epic("Magellan Response API");
        Allure.feature(scenario.getName());
        for (String tag : scenario.getSourceTagNames()) {
            Allure.label("tag", tag);
        }
    }

    @After
    public void afterScenario(Scenario scenario) {
        if (scenario.isFailed()) {
            Allure.addAttachment("Failure Info",
                    "text/plain",
                    "Scenario FAILED: " + scenario.getName(),
                    ".txt");
        }
    }
}
