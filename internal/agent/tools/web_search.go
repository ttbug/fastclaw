package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type webSearchArgs struct {
	Query string `json:"query"`
	Count int    `json:"count,omitempty"`
}

type braveSearchResponse struct {
	Web struct {
		Results []struct {
			Title       string `json:"title"`
			URL         string `json:"url"`
			Description string `json:"description"`
		} `json:"results"`
	} `json:"web"`
}

// RegisterWebSearch registers the web_search tool with a Brave Search API key.
func RegisterWebSearch(r *Registry, apiKey string) {
	r.Register("web_search", "Search the web using Brave Search API and return results with titles, URLs, and snippets", map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"query": map[string]interface{}{
				"type":        "string",
				"description": "The search query",
			},
			"count": map[string]interface{}{
				"type":        "integer",
				"description": "Number of results to return (default 5, max 20)",
			},
		},
		"required": []string{"query"},
	}, makeWebSearchTool(apiKey))
}

func makeWebSearchTool(apiKey string) ToolFunc {
	return func(ctx context.Context, rawArgs json.RawMessage) (string, error) {
		var args webSearchArgs
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			return "", fmt.Errorf("parse args: %w", err)
		}

		if args.Query == "" {
			return "", fmt.Errorf("query is required")
		}

		count := args.Count
		if count <= 0 {
			count = 5
		}
		if count > 20 {
			count = 20
		}

		searchCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
		defer cancel()

		req, err := http.NewRequestWithContext(searchCtx, http.MethodGet, "https://api.search.brave.com/res/v1/web/search", nil)
		if err != nil {
			return "", fmt.Errorf("create request: %w", err)
		}

		q := req.URL.Query()
		q.Set("q", args.Query)
		q.Set("count", fmt.Sprintf("%d", count))
		req.URL.RawQuery = q.Encode()

		req.Header.Set("Accept", "application/json")
		req.Header.Set("Accept-Encoding", "gzip")
		req.Header.Set("X-Subscription-Token", apiKey)

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return "", fmt.Errorf("search request failed: %w", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
			return "", fmt.Errorf("Brave Search API returned HTTP %d: %s", resp.StatusCode, string(body))
		}

		var searchResp braveSearchResponse
		if err := json.NewDecoder(resp.Body).Decode(&searchResp); err != nil {
			return "", fmt.Errorf("parse search response: %w", err)
		}

		if len(searchResp.Web.Results) == 0 {
			return "No results found for: " + args.Query, nil
		}

		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("Search results for: %s\n\n", args.Query))
		for i, r := range searchResp.Web.Results {
			sb.WriteString(fmt.Sprintf("%d. %s\n   URL: %s\n   %s\n\n", i+1, r.Title, r.URL, r.Description))
		}

		return sb.String(), nil
	}
}
