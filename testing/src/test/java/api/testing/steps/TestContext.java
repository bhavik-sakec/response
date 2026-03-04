package api.testing.steps;

import api.testing.config.TestConfig;
import io.restassured.response.Response;
import io.restassured.specification.RequestSpecification;

/**
 * Shared test context holding state (response, request) and utility methods.
 * This is NOT a step definition class — it has no Cucumber annotations.
 * Step classes use this via composition to share state across steps.
 */
public class TestContext {

    private static Response response;
    private static RequestSpecification request;

    public static Response getResponse() {
        return response;
    }

    public static void setResponse(Response response) {
        TestContext.response = response;
    }

    public static RequestSpecification getRequest() {
        return request;
    }

    public static void setRequest(RequestSpecification request) {
        TestContext.request = request;
    }

    /**
     * Locates a test data file of the given type under the valid or invalid directory.
     */
    public static java.io.File getTestDataFile(String type, boolean valid) {
        String dirPath = TestConfig.TEST_DATA_PATH + (valid ? "/valid-files" : "/invalid-files");
        java.io.File dir = new java.io.File(dirPath);
        if (!dir.exists()) {
            // fallback for local execution if running from different CWD
            dir = new java.io.File("testing/" + dirPath);
        }

        java.io.File[] files = dir.listFiles((d, name) -> name.toUpperCase().contains(type.toUpperCase()));
        if (files != null && files.length > 0) {
            return files[0];
        }
        throw new RuntimeException("Test data file for type '" + type + "' not found in " + dir.getAbsolutePath());
    }
}
