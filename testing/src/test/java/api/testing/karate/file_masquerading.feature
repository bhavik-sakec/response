@masquerade
Feature: File Masquerading / Content Spoofing Tests (Karate)

  Background:
    * url baseUrl

  @MASK-01
  Scenario: PDF Renamed as MRX File
    * def fakePdf = read('classpath:api/testing/karate/testdata/fake_pdf.txt')
    Given path '/api/parse'
    And multipart file file = { value: '#(fakePdf)', filename: 'MRX_TEST.txt', contentType: 'text/plain' }
    When method post
    Then status 200
    And match response.detectedSchema == 'INVALID'

  @MASK-04
  Scenario: Plain CSV File Uploaded as ACK
    * def csvContent = 'col1,col2,col3\nval1,val2,val3\n'
    Given path '/api/parse'
    And multipart file file = { value: '#(csvContent)', filename: 'TEST.MCMSMN_CLAIMS_ACK.txt', contentType: 'text/plain' }
    When method post
    Then status 200
    And match response.detectedSchema == 'INVALID'

  @MASK-05
  Scenario: ACK File Uploaded to MRX Convert Endpoint
    * def ackFile = read('classpath:api/testing/karate/testdata/sample_ack.txt')
    Given path '/api/convert/mrx-to-ack'
    And multipart file file = { value: '#(ackFile)', filename: 'TEST.MCMSMN_CLAIMS_ACK.txt', contentType: 'text/plain' }
    When method post
    Then assert responseStatus == 200 || responseStatus == 400

  @MASK-08
  Scenario: Empty File with MRX Filename
    Given path '/api/parse'
    And multipart file file = { value: '', filename: 'MRX_TEST.BCBSMN_PRIME_CLAIMS.txt', contentType: 'text/plain' }
    When method post
    Then status 200
    And match response.detectedSchema == 'INVALID'
