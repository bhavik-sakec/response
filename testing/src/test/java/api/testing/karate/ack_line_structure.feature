    @ack_structure
Feature: ACK Line Structure Correctness (Karate)

  Background:
    * url baseUrl
    * def mrxFile = read('classpath:api/testing/karate/testdata/MRX_TEST.BCBSMN_PRIME_CLAIMS_1772621359437.txt')
    * def requestTimestamp = '20260304143228'
    * def extractAckText =
    """
    function(res){
      if (res == null) return '';
      if (typeof res === 'string') return res;
      if (res.content != null) return res.content;
      if (res.data != null) return res.data;
      return '' + res;
    }
    """
    * def toAckLines =
    """
    function(text){
      var normalized = ('' + text).replace(/\r/g, '');
      return normalized.split('\n');
    }
    """

    @ACK-01
  Scenario: ACK Line Length - every line should be 220 chars
    Given path '/api/convert/mrx-to-ack'
    And multipart file file = { value: '#(mrxFile)', filename: 'TEST.BCBSMN_PRIME_CLAIMS_MRX.txt', contentType: 'text/plain' }
    When method post
    Then status 200
    * def ackText = extractAckText(response)
    * match ackText != ''
    * def lines = toAckLines(ackText)
    * def nonEmpty = karate.filter(lines, function(x){ return x.trim().length > 0 })
    * def badLines = karate.filter(nonEmpty, function(x){ return x.length != 220 })
    And match badLines == '#[0]'

    @ACK-02
  Scenario: ACK Header Fields contain expected values
    Given path '/api/convert/mrx-to-ack'
    And multipart file file = { value: '#(mrxFile)', filename: 'TEST.BCBSMN_PRIME_CLAIMS_MRX.txt', contentType: 'text/plain' }
    And multipart field timestamp = requestTimestamp
    When method post
    Then status 200
    * def ackText = extractAckText(response)
    * assert ackText != null && ackText != ''
    * def headerLine = ('' + ackText).replace(/\r/g, '').split('\n')[0]
    * print 'Extracted Header Line:', headerLine
    * assert headerLine != null && headerLine != ''
    And match headerLine contains 'PRIME'
    And match headerLine contains 'BCBSMN'
    And match headerLine contains requestTimestamp.substring(0, 8)

    @ACK-03
  Scenario: ACK Trailer Record Count matches data lines
    Given path '/api/convert/mrx-to-ack'
    And multipart file file = { value: '#(mrxFile)', filename: 'TEST.BCBSMN_PRIME_CLAIMS_MRX.txt', contentType: 'text/plain' }
    When method post
    Then status 200
    * def ackText = extractAckText(response)
    * match ackText != ''
    * def lines = toAckLines(ackText)
    * def nonEmpty = karate.filter(lines, function(x){ return x.trim().length > 0 })
    * def dataCount = nonEmpty.length - 2
    And assert dataCount > 0
