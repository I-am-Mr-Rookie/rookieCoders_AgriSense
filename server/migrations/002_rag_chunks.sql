BEGIN;

CREATE TABLE IF NOT EXISTS rag_chunks (
  record_id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  corpus_lane TEXT NOT NULL,
  content_type TEXT,
  provenance_class TEXT,
  publisher TEXT,
  source_title TEXT,
  source_url TEXT,
  source_file TEXT,
  source_page_or_table TEXT,
  publication_date TEXT,
  retrieved_at_utc TIMESTAMPTZ,
  effective_from TEXT,
  effective_to TEXT,
  language TEXT,
  country TEXT,
  geo_level TEXT,
  geo_name TEXT,
  crop TEXT,
  season TEXT,
  topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_unit TEXT,
  normalized_unit TEXT,
  confidence TEXT,
  raw_content_hash TEXT NOT NULL,
  quality_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  searchable_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(source_title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(array_to_string(ARRAY[crop, season, geo_name, publisher, content_type], ' '), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(text, '')), 'C')
  ) STORED,
  content_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rag_chunks_search_idx ON rag_chunks USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS rag_chunks_filter_idx ON rag_chunks (country, season, crop, corpus_lane);
CREATE INDEX IF NOT EXISTS rag_chunks_metadata_idx ON rag_chunks USING GIN (searchable_metadata);

CREATE TABLE IF NOT EXISTS rag_ingestions (
  corpus_hash TEXT PRIMARY KEY,
  source_path TEXT NOT NULL,
  parsed_count INTEGER NOT NULL,
  inserted_count INTEGER NOT NULL,
  updated_count INTEGER NOT NULL,
  unchanged_count INTEGER NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
