package api.testing.selenium;

import io.qameta.allure.Allure;
import io.qameta.allure.Step;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.testng.ITestResult;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Optional;
import org.testng.annotations.Parameters;

import java.io.ByteArrayInputStream;

/**
 * Base class for Selenium + TestNG + Allure tests.
 * Handles browser lifecycle and automatic screenshot-on-failure.
 *
 * Extend this class for any UI / browser-based test.
 */
public class BaseSeleniumTest {

    protected WebDriver driver;

    @Parameters({"browser", "headless"})
    @BeforeMethod(alwaysRun = true)
    @Step("Launch browser")
    public void setUp(@Optional("CHROME") String browser, @Optional("true") String headless) {
        DriverFactory.BrowserType browserType = DriverFactory.BrowserType.valueOf(browser.toUpperCase());
        boolean isHeadless = Boolean.parseBoolean(headless);
        driver = DriverFactory.createDriver(browserType, isHeadless);
    }

    @AfterMethod(alwaysRun = true)
    @Step("Close browser")
    public void tearDown(ITestResult result) {
        // Attach screenshot on failure
        if (result.getStatus() == ITestResult.FAILURE) {
            captureScreenshot("Failure-Screenshot");
        }
        DriverFactory.quitDriver();
    }

    /**
     * Takes a screenshot and attaches it to the Allure report.
     */
    @Step("Capture screenshot: {name}")
    protected void captureScreenshot(String name) {
        if (driver instanceof TakesScreenshot ts) {
            byte[] screenshot = ts.getScreenshotAs(OutputType.BYTES);
            Allure.addAttachment(name, "image/png", new ByteArrayInputStream(screenshot), ".png");
        }
    }
}
