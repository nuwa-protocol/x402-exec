# Static Files

This directory contains static files served by the Premium Download scenario.

## Files

- `x402-whitepaper.pdf` - Official x402 Protocol Whitepaper for the Premium Download scenario

## Production Usage

In production, you would typically:

- Store files in cloud storage (S3, GCS, etc.)
- Generate signed URLs with expiration
- Stream large files instead of loading into memory
- Track download metrics

This demo serves files directly from the filesystem for simplicity.
