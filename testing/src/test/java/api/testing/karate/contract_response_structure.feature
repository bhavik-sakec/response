@contract
Feature: Contract / Response Structure Tests (Karate)

  Background:
    * url baseUrl
    * def mrxFile = read('classpath:api/testing/karate/testdata/sample_mrx.txt')

  @CTR-01
  Scenario: Parse Response Fields Structure
    Given path '/api/parse'
    And multipart file file = { value: '#(mrxFile)', filename: 'TEST.BCBSMN_PRIME_CLAIMS_MRX.txt', contentType: 'text/plain' }
    When method post
    Then status 200
    And match response == { lines: '#array', summary: '#object', detectedSchema: '#string', validationErrors: '##array' }
    And match each response.lines contains { type: '#string', lineNumber: '#number' }
    And match response.summary contains { total: '#number' }

  @CTR-02
  Scenario: Convert Response Fields Structure
    Given path '/api/convert/mrx-to-ack'
    And multipart file file = { value: '#(mrxFile)', filename: 'TEST.BCBSMN_PRIME_CLAIMS_MRX.txt', contentType: 'text/plain' }
    When method post
    Then status 200
    And match response == { content: '#string', fileName: '#string' }
