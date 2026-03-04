@validation
Feature: Validation Endpoints (Karate)

  Background:
    * url baseUrl
    * path '/api/validate'
    * header Content-Type = 'application/json'

  @VL-01
  Scenario: STATUS_CHANGE - Valid PD
    And request { type: 'STATUS_CHANGE', unitsApproved: 5, totalUnits: 10, newStatus: 'PD' }
    When method post
    Then status 200
    And match response.isValid == true
    And match response.suggestedApproved == 10
    And match response.suggestedDenied == 0

  @VL-02
  Scenario: STATUS_CHANGE - Valid DY (has approved units)
    And request { type: 'STATUS_CHANGE', unitsApproved: 5, totalUnits: 10, newStatus: 'DY' }
    When method post
    Then status 200
    And match response.isValid == true
    And match response.suggestedApproved == 0
    And match response.suggestedDenied == 10

  @VL-03
  Scenario: STATUS_CHANGE - Blocked DY (0 approved)
    And request { type: 'STATUS_CHANGE', unitsApproved: 0, totalUnits: 10, newStatus: 'DY' }
    When method post
    Then status 200
    And match response.isValid == false
    And match response.error contains 'Cannot change status to Denied when approved units are 0'
    And match response.allowedStatuses contains 'PD'
    And match response.allowedStatuses contains 'PA'

  @VL-04
  Scenario: STATUS_CHANGE - Blocked PA (only 1 unit)
    And request { type: 'STATUS_CHANGE', unitsApproved: 1, totalUnits: 1, newStatus: 'PA' }
    When method post
    Then status 200
    And match response.isValid == false
    And match response.error contains 'need at least 2 total units'

  @VL-05
  Scenario: STATUS_CHANGE - Valid PA (auto-split)
    And request { type: 'STATUS_CHANGE', unitsApproved: 10, totalUnits: 10, newStatus: 'PA' }
    When method post
    Then status 200
    And match response.isValid == true
    And match response.suggestedApproved > response.suggestedDenied
    And assert response.suggestedApproved + response.suggestedDenied == 10

  @VL-06
  Scenario: PARTIAL_UNITS - Valid split
    And request { type: 'PARTIAL_UNITS', totalUnits: 10, newApproved: 7, newDenied: 3 }
    When method post
    Then status 200
    And match response.isValid == true
    And match response.wasCorrected == false

  @VL-07
  Scenario: PARTIAL_UNITS - Auto-correct mismatch
    And request { type: 'PARTIAL_UNITS', totalUnits: 10, newApproved: 6, newDenied: 6 }
    When method post
    Then status 200
    And match response.wasCorrected == true
    And assert response.correctedApproved + response.correctedDenied == 10

  @VL-08
  Scenario: PARTIAL_UNITS - Auto-correct when denied >= approved
    And request { type: 'PARTIAL_UNITS', totalUnits: 10, newApproved: 3, newDenied: 7 }
    When method post
    Then status 200
    And match response.wasCorrected == true
    And match response.correctedApproved > response.correctedDenied

  @VL-09
  Scenario: VALIDATE - Missing type field
    And request { unitsApproved: 5, totalUnits: 10 }
    When method post
    Then status 400
    And match response.error contains "Missing 'type' field"
    And assert response.suggestedApproved > response.suggestedDenied
  @VL-10
  Scenario: VALIDATE - Unknown type
    And request { type: 'UNKNOWN_TYPE' }
    When method post
    Then status 400
    And match response.error contains 'Unknown type'
    And assert response.correctedApproved > response.correctedDenied
