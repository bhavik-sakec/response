package com.mrx.fileparserengine.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO mirroring the frontend's ParsedField interface.
 * Contains the parsed value, the field definition, and validation results.
 *
 * Memory optimization: null fields excluded from JSON serialization.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ParsedFieldDTO {
    private FieldDefinitionDTO def;
    private String value;
    @JsonProperty("isValid")
    private boolean isValid;
    private String error;
    /**
     * True when value.length() != def.length — field length does not match schema
     * definition
     */
    private boolean lengthError;
}
