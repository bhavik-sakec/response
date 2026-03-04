package api.testing.steps;

import api.testing.config.TestConfig;
import io.cucumber.java.en.When;
import io.cucumber.java.en.And;
import io.qameta.allure.Allure;
import io.restassured.RestAssured;
import io.restassured.response.Response;

import static io.restassured.RestAssured.given;
import static org.testng.Assert.assertEquals;

/**
 * Step definitions for claim validation API endpoints.
 */
public class ApiValidationSteps {

    @When("I validate claim {string} with {int} approved and {int} total units")
    public void iValidateClaimWithStatusAndUnits(String status, int approved, int total) {
        RestAssured.baseURI = TestConfig.BASE_URL;
        String body = String.format(
                "{\"type\": \"STATUS_CHANGE\", \"newStatus\": \"%s\", \"unitsApproved\": %d, \"totalUnits\": %d}",
                status, approved, total);
        Response response = given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/api/validate");
        TestContext.setResponse(response);
        Allure.step("Validate " + status + " claim response → " + response.getStatusCode());
        Allure.addAttachment("Request Body", "application/json", body, ".json");
    }

    @When("I validate partial units with {int} total, {int} approved and {int} denied")
    public void iValidatePartialUnits(int total, int approved, int denied) {
        RestAssured.baseURI = TestConfig.BASE_URL;
        String body = String.format(
                "{\"type\": \"PARTIAL_UNITS\", \"totalUnits\": %d, \"newApproved\": %d, \"newDenied\": %d}", total,
                approved, denied);
        Response response = given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/api/validate");
        TestContext.setResponse(response);
        Allure.step("Validate partial units response → " + response.getStatusCode());
        Allure.addAttachment("Request Body", "application/json", body, ".json");
    }

    @And("the validation should be {string}")
    public void theValidationResultShouldBe(String expectedResult) {
        boolean expected = expectedResult.equalsIgnoreCase("valid");
        boolean actual = TestContext.getResponse().jsonPath().getBoolean("isValid");
        assertEquals(actual, expected, "Validation result mismatch");
    }

    @And("the suggested approved units should be {int}")
    public void theSuggestedApprovedUnitsShouldBe(int value) {
        Response response = TestContext.getResponse();
        int actual = response.jsonPath().get("suggestedApproved") != null
                ? response.jsonPath().getInt("suggestedApproved")
                : response.jsonPath().getInt("correctedApproved");
        assertEquals(actual, value, "Suggested approved units mismatch");
    }

    @And("the suggested denied units should be {int}")
    public void theSuggestedDeniedUnitsShouldBe(int value) {
        Response response = TestContext.getResponse();
        int actual = response.jsonPath().get("suggestedDenied") != null ? response.jsonPath().getInt("suggestedDenied")
                : response.jsonPath().getInt("correctedDenied");
        assertEquals(actual, value, "Suggested denied units mismatch");
    }
}