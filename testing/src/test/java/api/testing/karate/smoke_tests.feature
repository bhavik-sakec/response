@smoke
Feature: Smoke Tests (Karate)

  Background:
    * url baseUrl

  @SC-01
  Scenario: Health Check - Service is UP
    Given path '/api/health'
    When method get
    Then status 200
    And match response.status == 'UP'
    And match response.engine == 'MAGELLAN-FORGE-V1'

  @SC-02
  Scenario: Layouts Available
    Given path '/api/layouts'
    When method get
    Then status 200
    And match response contains { MRX: '#present', ACK: '#present', RESP: '#present' }
