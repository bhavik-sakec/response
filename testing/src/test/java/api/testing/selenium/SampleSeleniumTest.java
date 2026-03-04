package api.testing.selenium;

import io.qameta.allure.*;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.testng.Assert;
import org.testng.annotations.Test;

/**
 * Sample Selenium + TestNG + Allure test.
 * Demonstrates UI testing against the Magellan Response app.
 */
@Epic("UI Tests")
@Feature("Magellan Response UI")
public class SampleSeleniumTest extends BaseSeleniumTest {

    @Test(description = "Verify application home page loads successfully")
    @Severity(SeverityLevel.BLOCKER)
    @Story("Home Page")
    @Step("Navigate to home page and verify title")
    public void testHomePageLoads() {
        driver.get("http://localhost:3000");

        String title = driver.getTitle();
        Assert.assertNotNull(title, "Page title should not be null");

        captureScreenshot("HomePage-Loaded");
    }

    @Test(description = "Verify file upload element is present on page")
    @Severity(SeverityLevel.CRITICAL)
    @Story("File Upload")
    @Step("Check file upload component exists")
    public void testFileUploadPresent() {
        driver.get("http://localhost:3000");

        WebElement uploadInput = driver.findElement(By.cssSelector("input[type='file']"));
        Assert.assertNotNull(uploadInput, "File upload input should be present");

        captureScreenshot("FileUpload-Present");
    }
}
