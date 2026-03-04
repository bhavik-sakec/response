package api.testing.steps;

import api.testing.config.TestConfig;
import io.cucumber.java.en.When;
import io.qameta.allure.Allure;
import io.restassured.RestAssured;
import io.restassured.response.Response;

import java.io.File;

import static io.restassured.RestAssured.given;

/**
 * Step definitions for converting MRX files to ACK, RESP, or CSV formats.
 */
public class ApiConversionSteps {

    @When("I convert a valid {string} file to {string}")
    public void iConvertAValidFileTo(String sourceFormat, String targetFormat) {
        RestAssured.baseURI = TestConfig.BASE_URL;
        String endpoint = "/api/convert/" + sourceFormat.toLowerCase() + "-to-" + targetFormat.toLowerCase();
        File file = TestContext.getTestDataFile(sourceFormat, true);
        Response response = given()
                .multiPart("file", file)
                .when()
                .post(endpoint);
        TestContext.setResponse(response);
        Allure.step("Convert " + sourceFormat + " to " + targetFormat + " → " + response.getStatusCode());
    }

    @When("I convert a valid MRX file to {string} with timestamp {string}")
    public void iConvertMrxWithTimestamp(String targetFormat, String timestamp) {
        RestAssured.baseURI = TestConfig.BASE_URL;
        String endpoint = "/api/convert/mrx-to-" + targetFormat.toLowerCase();
        File file = TestContext.getTestDataFile("MRX", true);
        Response response = given()
                .multiPart("file", file)
                .multiPart("timestamp", timestamp)
                .when()
                .post(endpoint);
        TestContext.setResponse(response);
        Allure.step(
                "Convert MRX to " + targetFormat + " with timestamp " + timestamp + " → " + response.getStatusCode());
    }
}