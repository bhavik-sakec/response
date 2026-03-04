package api.testing.steps;

import api.testing.config.TestConfig;
import io.cucumber.java.en.When;
import io.qameta.allure.Allure;
import io.restassured.RestAssured;
import io.restassured.response.Response;

import java.io.File;

import static io.restassured.RestAssured.given;

/**
 * Step definitions for security, masquerading, and edge case testing.
 */
public class ApiSecuritySteps {

    @When("I upload a file {string} with name {string} and content type {string}")
    public void iUploadFileWithNameAndType(String filePath, String fileName, String contentType) {
        RestAssured.baseURI = TestConfig.BASE_URL;
        Response response = given()
                .multiPart("file", fileName, new File(filePath), contentType)
                .when()
                .post("/api/parse");
        TestContext.setResponse(response);
        Allure.step("Upload " + fileName + " (" + contentType + ") → " + response.getStatusCode());
    }

    @When("I send an XSS payload in parameter {string} to {string}")
    public void iSendXssPayload(String param, String endpoint) {
        RestAssured.baseURI = TestConfig.BASE_URL;
        String xssPayload = "<script>alert(1)</script>";
        Response response = given()
                .multiPart(param, xssPayload)
                .multiPart("file", "dummy.txt", "dummy".getBytes())
                .when()
                .post(endpoint);
        TestContext.setResponse(response);
        Allure.step("XSS test on " + param + " @ " + endpoint + " → " + response.getStatusCode());
    }

    @When("I send a SQL injection payload to {string} with type {string}")
    public void iSendSqlPayload(String endpoint, String typeVal) {
        RestAssured.baseURI = TestConfig.BASE_URL;
        String body = String.format("{\"type\": \"%s\", \"unitsApproved\": 5}", typeVal);
        Response response = given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post(endpoint);
        TestContext.setResponse(response);
        Allure.step("SQLi test on " + endpoint + " → " + response.getStatusCode());
    }
}