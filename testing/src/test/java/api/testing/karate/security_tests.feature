@security
Feature: Security Tests (Karate)

  Background:
    * url baseUrl
    * def mrxFile = read('classpath:api/testing/karate/testdata/sample_mrx.txt')

  @SEC-01
  Scenario: XSS in Timestamp Parameter
    Given path '/api/convert/mrx-to-ack'
    And multipart file file = { value: '#(mrxFile)', filename: 'TEST.BCBSMN_PRIME_CLAIMS_MRX.txt', contentType: 'text/plain' }
    And multipart field timestamp = '<script>alert(1)</script>'
    When method post
    Then status 400
    And match response.error contains 'Invalid timestamp format'
    And match response !contains '<script>'

  @SEC-02
  Scenario: Path Traversal in Timestamp Parameter
    Given path '/api/convert/mrx-to-ack'
    And multipart file file = { value: '#(mrxFile)', filename: 'TEST.BCBSMN_PRIME_CLAIMS_MRX.txt', contentType: 'text/plain' }
    And multipart field timestamp = '../../etc/passwd'
    When method post
    Then status 400

  @SEC-03
  Scenario: SQL Injection in Validate Body
    Given path '/api/validate'
    And header Content-Type = 'application/json'
    And request { type: "' OR 1=1 --", unitsApproved: 5 }
    When method post
    Then status 400
    And match response.error contains 'Unknown type'

  @SEC-05
  Scenario: Timestamp Extension Normalization
    Given path '/api/convert/mrx-to-ack'
    And multipart file file = { value: '#(mrxFile)', filename: 'TEST.BCBSMN_PRIME_CLAIMS_MRX.txt', contentType: 'text/plain' }
    And multipart field timestamp = '20260209202425.txt'
    When method post
    Then status 200
    And match response.fileName contains '20260209202425'
    And match response.fileName !contains '.txt.txt'
