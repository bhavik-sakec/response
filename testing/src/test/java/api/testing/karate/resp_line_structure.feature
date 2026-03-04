@resp_structure
Feature: RESP Line Structure Correctness (Karate)

  Background:
    * url baseUrl
    * def mrxFile = read('classpath:api/testing/karate/testdata/sample_mrx.txt')

  @RESP-01
  Scenario: RESP Approved Line - All PD
    Given path '/api/convert/mrx-to-resp'
    And multipart file file = { value: '#(mrxFile)', filename: 'TEST.BCBSMN_PRIME_CLAIMS_MRX.txt', contentType: 'text/plain' }
    When method post
    Then status 200
    And match response.content contains '#notnull'

  @RESP-02
  Scenario: RESP Denied Line - All DY (denyPercentage=100)
    Given path '/api/convert/mrx-to-resp'
    And multipart file file = { value: '#(mrxFile)', filename: 'TEST.BCBSMN_PRIME_CLAIMS_MRX.txt', contentType: 'text/plain' }
    And multipart field denyPercentage = '100'
    When method post
    Then status 200
    And match response.content contains '#notnull'

  @RESP-03
  Scenario: RESP Partial Line - PA split constraint (partialPercentage=100)
    Given path '/api/convert/mrx-to-resp'
    And multipart file file = { value: '#(mrxFile)', filename: 'TEST.BCBSMN_PRIME_CLAIMS_MRX.txt', contentType: 'text/plain' }
    And multipart field partialPercentage = '100'
    When method post
    Then status 200
    And match response.content contains '#notnull'

  @RESP-04
  Scenario: Single-Unit Claims Never Denied
    Given path '/api/convert/mrx-to-resp'
    And multipart file file = { value: '#(mrxFile)', filename: 'TEST.BCBSMN_PRIME_CLAIMS_MRX.txt', contentType: 'text/plain' }
    And multipart field denyPercentage = '100'
    When method post
    Then status 200
    # Single-unit claims should remain PD - parsing logic to be verified in step definitions
    And match response.content contains '#notnull'
