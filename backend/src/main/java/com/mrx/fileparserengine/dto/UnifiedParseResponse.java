package com.mrx.fileparserengine.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Unified response DTO that mirrors the frontend's ParseResult interface.
 * This is the top-level response returned by the unified parse endpoint.
 *
 * Memory optimization: null fields are excluded from JSON serialization
 * to reduce response payload size for large files (1M+ claims).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UnifiedParseResponse {
    private List<ParsedLineDTO> lines;
    private SummaryDTO summary;
    private String detectedSchema; // "ACK", "RESP", "MRX", "INVALID"
    private String rawContent; // full raw text content — only populated for small files
    private List<String> validationErrors; // High-level file validation issues (e.g. trailer mismatch)
}
