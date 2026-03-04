@functional
Feature: Functional Happy Path - Convert MRX to ACK (Karate)

  Background:
    * url baseUrl
    * def mrxFile = read('classpath:api/testing/karate/testdata/sample_mrx.txt')

  @FP-07
  Scenario: Convert MRX to ACK (All Accepted)
    Given path '/api/convert/mrx-to-ack'
    And multipart file file = { value: '#(mrxFile)', filename: 'TEST.BCBSMN_PRIME_CLAIMS_MRX.txt', contentType: 'text/plain' }
    When method post
    Then status 200
    And match response.fileName contains 'TEST.MCMSMN_CLAIMS_ACK_'
    And match response.content contains '#notnull'
    * def lines = response.content.split('\n')
    * def dataLines = karate.filter(lines, function(x){ return x.length > 0 && x.charAt(0) == 'D' })
    # All data lines should have Status 'A'
    * def allAccepted = karate.filter(dataLines, function(x){ return x.substring(1,2) != 'A' })
    And match allAccepted == '#[0]'

  @FP-08
  Scenario: Convert MRX to ACK (With Reject Percentage 30%)
    Given path '/api/convert/mrx-to-ack'
    And multipart file file = { value: '#(mrxFile)', filename: 'TEST.BCBSMN_PRIME_CLAIMS_MRX.txt', contentType: 'text/plain' }
    And multipart field rejectPercentage = '30'
    When method post
    Then status 200
    And match response.content contains '#notnull'

  @FP-09
  Scenario: Convert MRX to ACK (With Reject Count 5)
    Given path '/api/convert/mrx-to-ack'
    And multipart file file = { value: '#(mrxFile)', filename: 'TEST.BCBSMN_PRIME_CLAIMS_MRX.txt', contentType: 'text/plain' }
    And multipart field rejectCount = '5'
    When method post
    Then status 200
    And match response.content contains '#notnull'

  @FP-10
  Scenario: Convert MRX to ACK (Randomize Reject Codes)
    Given path '/api/convert/mrx-to-ack'
    And multipart file file = { value: '#(mrxFile)', filename: 'TEST.BCBSMN_PRIME_CLAIMS_MRX.txt', contentType: 'text/plain' }
    And multipart field rejectPercentage = '50'
    And multipart field randomizeRejectCodes = 'true'
    When method post
    Then status 200
    And match response.content contains '#notnull'

  @FP-11
  Scenario: Convert MRX to ACK (Custom Timestamp)
    Given path '/api/convert/mrx-to-ack'
    And multipart file file = { value: '#(mrxFile)', filename: 'TEST.BCBSMN_PRIME_CLAIMS_MRX.txt', contentType: 'text/plain' }
    And multipart field timestamp = '20260209202425'
    When method post
    Then status 200
    And match response.fileName contains '20260209202425'
