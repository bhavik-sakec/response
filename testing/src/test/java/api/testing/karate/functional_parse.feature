@functional
Feature: Functional Happy Path - Parse Endpoints (Karate)

  Background:
    * url baseUrl
    * def mrxFile = read('classpath:api/testing/karate/testdata/sample_mrx.txt')
    * def ackFile = read('classpath:api/testing/karate/testdata/sample_ack.txt')
    * def respFile = read('classpath:api/testing/karate/testdata/sample_resp.txt')

  @FP-01
  Scenario: Parse MRX File (Multipart)
    Given path '/api/parse'
    And multipart file file = { value: '#(mrxFile)', filename: 'TEST.BCBSMN_PRIME_CLAIMS_MRX.txt', contentType: 'text/plain' }
    When method post
    Then status 200
    And match response.detectedSchema == 'MRX'
    And assert response.summary.total > 0
    And match response.summary.invalid == 0
    And match response.lines[0].type == 'Header'
    And match response.lines[response.lines.length - 1].type == 'Trailer'
    And match response.validationErrors == '#[0]'

  @FP-02
  Scenario: Parse ACK File (Multipart)
    Given path '/api/parse'
    And multipart file file = { value: '#(ackFile)', filename: 'TEST.MCMSMN_CLAIMS_ACK.txt', contentType: 'text/plain' }
    When method post
    Then status 200
    And match response.detectedSchema == 'ACK'
    And assert response.summary.total > 0

  @FP-03
  Scenario: Parse RESP File (Multipart)
    Given path '/api/parse'
    And multipart file file = { value: '#(respFile)', filename: 'TEST.PRIME_BCBSMN_GEN_CLAIMS_RESP.txt', contentType: 'text/plain' }
    When method post
    Then status 200
    And match response.detectedSchema == 'RESP'
    And assert response.summary.total > 0

  @FP-04
  Scenario: Parse MRX Text (Raw Body)
    Given path '/api/parse-text'
    And header Content-Type = 'text/plain'
    And request mrxFile
    When method post
    Then status 200
    And match response.detectedSchema == 'MRX'
    And assert response.summary.total > 0
    And match response.summary.invalid == 0

  @FP-05
  Scenario: Parse ACK Text (Raw Body)
    Given path '/api/parse-text'
    And header Content-Type = 'text/plain'
    And request ackFile
    When method post
    Then status 200
    And match response.detectedSchema == 'ACK'

  @FP-06
  Scenario: Parse RESP Text (Raw Body)
    Given path '/api/parse-text'
    And header Content-Type = 'text/plain'
    And request respFile
    When method post
    Then status 200
    And match response.detectedSchema == 'RESP'
