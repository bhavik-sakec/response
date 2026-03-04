package api.testing.runners;

import io.cucumber.testng.AbstractTestNGCucumberTests;
import io.cucumber.testng.CucumberOptions;
import org.testng.annotations.DataProvider;

/**
 * Cucumber + TestNG runner.
 * Discovers Cucumber feature files and executes them through TestNG.
 * Allure integration is handled via the cucumber7-jvm plugin.
 *
 * Run with:  mvn test -Dtest=CucumberTestNGRunner
 */
@CucumberOptions(
    features = "src/test/resources/api/testing/cucumber",
    glue = {"api.testing.steps"},
        plugin = {
                "pretty",
                "html:target/cucumber-reports/cucumber.html",
                "json:target/cucumber-reports/cucumber.json",
                "io.qameta.allure.cucumber7jvm.AllureCucumber7Jvm"
        },
        tags = "not @ignore",
    monochrome = true,
    publish = false
)
public class CucumberTestNGRunner extends AbstractTestNGCucumberTests {

    @Override
    @DataProvider(parallel = true)
    public Object[][] scenarios() {
        return super.scenarios();
    }
}
