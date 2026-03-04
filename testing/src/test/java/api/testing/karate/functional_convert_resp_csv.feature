@functional
Feature: Functional Happy Path - Convert MRX to RESP and CSV (Karate)

  Background:
    * url baseUrl
    * def mrxFile = read('classpath:api/testing/karate/testdata/sample_mrx.txt')

  @FP-12
  Scenario: Convert MRX to RESP (All Approved / PD)
    Given path '/api/convert/mrx-to-resp'
    And multipart file file = { value: '#(mrxFile)', filename: 'TEST.BCBSMN_PRIME_CLAIMS_MRX.txt', contentType: 'text/plain' }
    When method post
    Then status 200
    And match response.content contains '#notnull'

  @FP-13
  Scenario: Convert MRX to RESP (With Deny Percentage 40%)
    Given path '/api/convert/mrx-to-resp'
    And multipart file file = { value: '#(mrxFile)', filename: 'TEST.BCBSMN_PRIME_CLAIMS_MRX.txt', contentType: 'text/plain' }
    And multipart field denyPercentage = '40'
    When method post
    Then status 200
    And match response.content contains '#notnull'

  @FP-14
  Scenario: Convert MRX to RESP (With Partial Percentage 30%)
    Given path '/api/convert/mrx-to-resp'
    And multipart file file = { value: '#(mrxFile)', filename: 'TEST.BCBSMN_PRIME_CLAIMS_MRX.txt', contentType: 'text/plain' }
    And multipart field partialPercentage = '30'
    When method post
    Then status 200
    And match response.content contains '#notnull'

  @FP-15
  Scenario: Convert MRX to RESP (Combined Deny + Partial)
    Given path '/api/convert/mrx-to-resp'
    And multipart file file = { value: '#(mrxFile)', filename: 'TEST.BCBSMN_PRIME_CLAIMS_MRX.txt', contentType: 'text/plain' }
    And multipart field denyPercentage = '20'
    And multipart field partialPercentage = '30'
    When method post
    Then status 200
    And match response.content contains '#notnull'

  @FP-16
  Scenario: Convert MRX to CSV
    Given path '/api/convert/mrx-to-csv'
    And multipart file file = { value: '#(mrxFile)', filename: 'TEST.BCBSMN_PRIME_CLAIMS_MRX.txt', contentType: 'text/plain' }
    When method post
    Then status 200
    And match response.fileName contains 'TEST.MCMSMN_CLAIMS_EXPORT_'
    And match response.fileName contains '.csv'
    And match response.content contains '#notnull'
