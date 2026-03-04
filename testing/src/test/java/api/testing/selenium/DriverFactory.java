package api.testing.selenium;

import io.github.bonigarcia.wdm.WebDriverManager;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.edge.EdgeDriver;
import org.openqa.selenium.edge.EdgeOptions;
import org.openqa.selenium.firefox.FirefoxDriver;
import org.openqa.selenium.firefox.FirefoxOptions;

import java.time.Duration;

/**
 * Factory class for creating and managing WebDriver instances.
 * Supports Chrome, Firefox, and Edge browsers.
 * Uses WebDriverManager for automatic driver binary management.
 */
public class DriverFactory {

    private static final ThreadLocal<WebDriver> driver = new ThreadLocal<>();

    public enum BrowserType {
        CHROME, FIREFOX, EDGE
    }

    /**
     * Initializes a WebDriver for the specified browser.
     * Default: Chrome headless.
     */
    public static WebDriver createDriver(BrowserType browser, boolean headless) {
        WebDriver webDriver;

        switch (browser) {
            case FIREFOX -> {
                WebDriverManager.firefoxdriver().setup();
                FirefoxOptions firefoxOptions = new FirefoxOptions();
                if (headless) firefoxOptions.addArguments("--headless");
                webDriver = new FirefoxDriver(firefoxOptions);
            }
            case EDGE -> {
                WebDriverManager.edgedriver().setup();
                EdgeOptions edgeOptions = new EdgeOptions();
                if (headless) edgeOptions.addArguments("--headless");
                webDriver = new EdgeDriver(edgeOptions);
            }
            default -> {
                WebDriverManager.chromedriver().setup();
                ChromeOptions chromeOptions = new ChromeOptions();
                if (headless) chromeOptions.addArguments("--headless=new");
                chromeOptions.addArguments("--no-sandbox");
                chromeOptions.addArguments("--disable-dev-shm-usage");
                chromeOptions.addArguments("--window-size=1920,1080");
                webDriver = new ChromeDriver(chromeOptions);
            }
        }

        webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
        webDriver.manage().timeouts().pageLoadTimeout(Duration.ofSeconds(30));
        webDriver.manage().window().maximize();

        driver.set(webDriver);
        return webDriver;
    }

    /**
     * Convenience overload – defaults to headless Chrome.
     */
    public static WebDriver createDriver() {
        return createDriver(BrowserType.CHROME, true);
    }

    /**
     * Returns the current thread's WebDriver instance.
     */
    public static WebDriver getDriver() {
        return driver.get();
    }

    /**
     * Quits the driver and cleans up the ThreadLocal.
     */
    public static void quitDriver() {
        WebDriver d = driver.get();
        if (d != null) {
            d.quit();
            driver.remove();
        }
    }
}
