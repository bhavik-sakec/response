package api.testing.steps;

import api.testing.config.TestConfig;
import io.cucumber.java.en.When;
import io.qameta.allure.Allure;
import io.restassured.RestAssured;
import io.restassured.response.Response;

import java.io.File;

import static io.restassured.RestAssured.given;

/**
 * Step definitions for parsing files and text content.
 */
public class ApiParsingSteps {

    @When("I send a GET request to {string}")
    public void iSendAGetRequestTo(String endpoint) {
        RestAssured.baseURI = TestConfig.BASE_URL;
        Response response = given()
                .when()
                .get(endpoint);
        TestContext.setResponse(response);
        Allure.step("GET " + endpoint + " → " + response.getStatusCode());
    }

    @When("I send a POST request to {string} with body:")
    public void iSendAPostRequestWithBody(String endpoint, String body) {
        RestAssured.baseURI = TestConfig.BASE_URL;
        Response response = given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post(endpoint);
        TestContext.setResponse(response);
        Allure.step("POST " + endpoint + " → " + response.getStatusCode());
        Allure.addAttachment("Request Body", "application/json", body, ".json");
    }

    @When("I send a POST request to {string} with JSON content type")
    public void iSendPostWithJsonContentType(String endpoint) {
        RestAssured.baseURI = TestConfig.BASE_URL;
        Response response = given()
                .header("Content-Type", "application/json")
                .body("{}")
                .when()
                .post(endpoint);
        TestContext.setResponse(response);
        Allure.step("POST (JSON) " + endpoint + " → " + response.getStatusCode());
    }

    @When("I send a POST request to {string} with multipart but no {string} part")
    public void iSendPostMultipartNoFile(String endpoint, String fieldName) {
        RestAssured.baseURI = TestConfig.BASE_URL;
        Response response = given()
                .multiPart("dummy", "no-file")
                .when()
                .post(endpoint);
        TestContext.setResponse(response);
        Allure.step("POST (multipart, missing " + fieldName + ") " + endpoint + " → " + response.getStatusCode());
    }

    @When("I upload a valid {string} file to {string}")
    public void iUploadAValidFileTo(String fileType, String endpoint) {
        RestAssured.baseURI = TestConfig.BASE_URL;
        File file = TestContext.getTestDataFile(fileType, true);
        Response response = given()
                .multiPart("file", file)
                .when()
                .post(endpoint);
        TestContext.setResponse(response);
        Allure.step("Upload " + fileType + " to " + endpoint + " → " + response.getStatusCode());
    }

    @When("I upload a valid {string} file to {string} with parameter {string}")
    public void iUploadAValidFileWithParam(String fileType, String endpoint, String param) {
        RestAssured.baseURI = TestConfig.BASE_URL;
        File file = TestContext.getTestDataFile(fileType, true);
        String[] parts = param.split("=");
        Response response = given()
                .multiPart("file", file)
                .multiPart(parts[0], parts[1])
                .when()
                .post(endpoint);
        TestContext.setResponse(response);
        Allure.step("Upload " + fileType + " to " + endpoint + " with " + param + " → " + response.getStatusCode());
    }

    @When("I upload an empty file to {string}")
    public void iUploadAnEmptyFileTo(String endpoint) {
        RestAssured.baseURI = TestConfig.BASE_URL;
        Response response = given()
                .multiPart("file", "empty.txt", new byte[0])
                .when()
                .post(endpoint);
        TestContext.setResponse(response);
        Allure.step("Upload empty file to " + endpoint + " → " + response.getStatusCode());
    }

    @When("I send a POST request with plain text body:")
    public void iSendAPostRequestWithPlainText(String text) {
        RestAssured.baseURI = TestConfig.BASE_URL;
        Response response = given()
                .header("Content-Type", "text/plain")
                .body(text)
                .when()
                .post("/api/parse-text");
        TestContext.setResponse(response);
        Allure.step("Parse text response → " + response.getStatusCode());
    }

    @When("I send text {string} to {string}")
    public void iSendTextTo(String text, String endpoint) {
        RestAssured.baseURI = TestConfig.BASE_URL;
        Response response = given()
                .header("Content-Type", "text/plain")
                .body(text)
                .when()
                .post(endpoint);
        TestContext.setResponse(response);
        Allure.step("POST text to " + endpoint + " → " + response.getStatusCode());
    }

    @When("I send raw text content of a valid {string} file to {string}")
    public void iSendRawTextContentTo(String fileType, String endpoint) {
        RestAssured.baseURI = TestConfig.BASE_URL;
        File file = TestContext.getTestDataFile(fileType, true);
        Response response = given()
                .header("Content-Type", "text/plain")
                .body(file)
                .when()
                .post(endpoint);
        TestContext.setResponse(response);
        Allure.step("POST raw text (" + fileType + ") to " + endpoint + " → " + response.getStatusCode());
    }
}