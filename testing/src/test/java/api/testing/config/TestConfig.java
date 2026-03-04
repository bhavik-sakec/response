package api.testing.config;

/**
 * Central configuration for test execution.
 * Values can be overridden via system properties or environment variables.
 */
public class TestConfig {

    public static final String BASE_URL = System.getProperty("base.url", "http://localhost:8080");
    public static final String BROWSER = System.getProperty("browser", "CHROME");
    public static final boolean HEADLESS = Boolean.parseBoolean(System.getProperty("headless", "true"));
    public static final int TIMEOUT_SECONDS = Integer.parseInt(System.getProperty("timeout", "10"));
    public static final String TEST_DATA_PATH = System.getProperty("test.data.path", "../test-data");

    private TestConfig() {
        // utility class
    }
}
