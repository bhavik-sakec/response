package api.testing.steps;

import api.testing.config.TestConfig;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.qameta.allure.Allure;
import io.restassured.RestAssured;
import io.restassured.response.Response;

import static io.restassured.RestAssured.given;
import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertTrue;

/**
 * Common step definitions for health check, status assertions, and response validation.
 * Uses TestContext for shared state — do NOT extend this class.
 */
public class ApiBaseSteps {

    @Given("the API is available")
    public void theApiIsAvailable() {
        RestAssured.baseURI = TestConfig.BASE_URL;
        TestContext.setRequest(given());
        Allure.step("API base URL set to: " + TestConfig.BASE_URL);
    }

    @Given("the system is UP")
    public void theSystemIsUp() {
        theApiIsAvailable();
        Response response = given()
                .when()
                .get("/api/health");
        TestContext.setResponse(response);
        assertEquals(response.getStatusCode(), 200, "Service is not UP");
    }

    @Then("the response status code should be {int}")
    public void theResponseStatusCodeShouldBe(int statusCode) {
        Response response = TestContext.getResponse();
        assertEquals(response.getStatusCode(), statusCode,
                "Expected status " + statusCode + " but got " + response.getStatusCode());
        Allure.addAttachment("Response Body", "application/json", response.getBody().asString(), ".json");
    }

    @Then("the response body should contain {string}")
    public void theResponseBodyShouldContain(String text) {
        Response response = TestContext.getResponse();
        assertTrue(response.getBody().asString().contains(text),
                "Response should contain: " + text);
    }

    @Then("the response should contain {string}: {string}")
    public void theResponseShouldContainKeyValue(String key, String value) {
        String body = TestContext.getResponse().getBody().asString();
        assertTrue(body.contains("\"" + key + "\"") && body.contains(value),
                "Response should contain " + key + ": " + value);
    }

    @Then("the error message should contain {string}")
    public void theErrorMessageShouldContain(String text) {
        String body = TestContext.getResponse().getBody().asString();
        assertTrue(body.toLowerCase().contains(text.toLowerCase()),
                "Error message should contain: " + text);
    }

    @Then("the detected schema should be {string}")
    public void theDetectedSchemaShouldBe(String schema) {
        String detectedSchema = TestContext.getResponse().jsonPath().getString("detectedSchema");
        assertEquals(detectedSchema, schema, "Detected schema mismatch");
    }

    @Then("the summary {string} should be {int}")
    public void theSummaryShouldBe(String field, int value) {
        Response response = TestContext.getResponse();
        int actual = response.jsonPath().get("summary." + field) != null
                ? response.jsonPath().getInt("summary." + field)
                : response.jsonPath().getInt(field); // fallback
        assertEquals(actual, value, "Summary mismatch for " + field);
    }

    @Then("the summary {string} should be greater than {int}")
    public void theSummaryShouldBeGreaterThan(String field, int value) {
        int actual = TestContext.getResponse().jsonPath().getInt("summary." + field);
        assertTrue(actual > value, "summary." + field + " should be > " + value + " but was " + actual);
    }

    @Then("validation errors should be empty")
    public void validationErrorsShouldBeEmpty() {
        Object errors = TestContext.getResponse().jsonPath().get("validationErrors");
        assertTrue(errors == null || ((java.util.List<?>) errors).isEmpty(),
                "Validation errors should be empty");
    }
}