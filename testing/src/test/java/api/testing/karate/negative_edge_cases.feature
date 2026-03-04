@negative
Feature: Negative / Edge Case Tests (Karate)

  Background:
    * url baseUrl

  @NEG-01
  Scenario: Parse Empty File
    Given path '/api/parse'
    And multipart file file = { value: '', filename: 'empty.txt', contentType: 'text/plain' }
    When method post
    Then status 200
    And match response.detectedSchema == 'INVALID'

  @NEG-02
  Scenario: Parse Non-File Content
    Given path '/api/parse-text'
    And header Content-Type = 'text/plain'
    And request 'Hello World, this is not a claim file'
    When method post
    Then status 200
    And match response.detectedSchema == 'INVALID'

  @NEG-03
  Scenario: Parse File with Wrong Line Lengths
    * def badMrx = read('classpath:api/testing/karate/testdata/mrx_bad_length.txt')
    Given path '/api/parse'
    And multipart file file = { value: '#(badMrx)', filename: 'TEST.BCBSMN_PRIME_CLAIMS_MRX.txt', contentType: 'text/plain' }
    When method post
    Then status 200
    And match response.detectedSchema == 'MRX'
    # Lines with length mismatch should be invalid
    * def invalidLines = karate.filter(response.lines, function(x){ return x.valid == false })
    And match invalidLines != '#[0]'

  @NEG-04
  Scenario: Parse File with Invalid Record Indicator
    * def badIndicator = read('classpath:api/testing/karate/testdata/mrx_bad_indicator.txt')
    Given path '/api/parse'
    And multipart file file = { value: '#(badIndicator)', filename: 'TEST.BCBSMN_PRIME_CLAIMS_MRX.txt', contentType: 'text/plain' }
    When method post
    Then status 200
    * def unknowns = karate.filter(response.lines, function(x){ return x.type == 'Unknown' })
    And match unknowns != '#[0]'

  @NEG-09
  Scenario: Parse Multipart Without file Field
    Given path '/api/parse'
    And multipart field dummy = 'no-file-here'
    When method post
    Then status 400

  @NEG-10
  Scenario: Send Non-Multipart to /parse
    Given path '/api/parse'
    And header Content-Type = 'application/json'
    And request { data: 'not-multipart' }
    When method post
    Then status 400

  @NEG-11
  Scenario: Convert MRX to ACK with Non-MRX File
    * def ackFile = read('classpath:api/testing/karate/testdata/sample_ack.txt')
    Given path '/api/convert/mrx-to-ack'
    And multipart file file = { value: '#(ackFile)', filename: 'TEST.MCMSMN_CLAIMS_ACK.txt', contentType: 'text/plain' }
    When method post
    Then assert responseStatus == 200 || responseStatus == 400

  @NEG-12
  Scenario: Timestamp with Insufficient Length
    * def mrxFile = read('classpath:api/testing/karate/testdata/sample_mrx.txt')
    Given path '/api/convert/mrx-to-ack'
    And multipart file file = { value: '#(mrxFile)', filename: 'TEST.BCBSMN_PRIME_CLAIMS_MRX.txt', contentType: 'text/plain' }
    And multipart field timestamp = '123'
    When method post
    Then status 400
