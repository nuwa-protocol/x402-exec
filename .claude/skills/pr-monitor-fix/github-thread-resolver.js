#!/usr/bin/env node

/**
 * GitHub GraphQL Review Thread Resolver
 *
 * This script provides GraphQL API integration to actually resolve GitHub review threads
 * instead of just tracking them locally.
 *
 * Usage:
 *   node github-thread-resolver.js <command> [options]
 *
 * Commands:
 *   resolve-thread <threadId>     - Resolve a review thread
 *   unresolve-thread <threadId>   - Unresolve a review thread
 *   list-threads <prUrl>          - List all review threads for a PR
 *   get-thread <threadId>         - Get details of a specific thread
 *   resolve-comment <commentId>   - Resolve a specific comment in a thread
 *   unresolve-comment <commentId> - Unresolve a specific comment in a thread
 */

const { execSync } = require('child_process');
const https = require('https');
const http = require('http');

// GraphQL queries and mutations
const QUERIES = {
  // Get repository and PR info from URL
  GET_PR_FROM_URL: `
    query getPRFromUrl($url: URI!) {
      resource(url: $url) {
        ... on PullRequest {
          id
          number
          title
          state
          repository {
            id
            name
            owner {
              login
            }
          }
        }
      }
    }
  `,

  // Get all review threads for a PR
  GET_REVIEW_THREADS: `
    query getReviewThreads($prId: ID!, $first: Int = 100) {
      node(id: $prId) {
        ... on PullRequest {
          reviewThreads(first: $first) {
            nodes {
              id
              isResolved
              resolvedBy {
                login
              }
              resolvedAt
              comments(first: 100) {
                nodes {
                  id
                  body
                  author {
                    login
                  }
                  createdAt
                  updatedAt
                  url
                  path
                  line
                  startLine
                  originalPosition
                  originalStartLine
                  diffSide
                  replyTo {
                    id
                  }
                }
              }
              thread {
                originalPosition
                originalStartLine
                diffSide
                path
                line
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    }
  `,

  // Resolve a review thread mutation
  RESOLVE_THREAD: `
    mutation resolveReviewThread($threadId: ID!) {
      resolveReviewThread(input: {
        threadId: $threadId
      }) {
        thread {
          id
          isResolved
          resolvedBy {
            login
          }
          resolvedAt
        }
      }
    }
  `,

  // Unresolve a review thread mutation
  UNRESOLVE_THREAD: `
    mutation unresolveReviewThread($threadId: ID!) {
      unresolveReviewThread(input: {
        threadId: $threadId
      }) {
        thread {
          id
          isResolved
          resolvedBy {
            login
          }
          resolvedAt
        }
      }
    }
  `
};

class GitHubGraphQLClient {
  constructor(token = null) {
    this.token = token || process.env.GITHUB_TOKEN;
    this.endpoint = 'https://api.github.com/graphql';

    if (!this.token) {
      throw new Error('GitHub token is required. Set GITHUB_TOKEN environment variable or pass token as parameter.');
    }
  }

  async executeGraphQL(query, variables = {}) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({ query, variables });

      const options = {
        hostname: 'api.github.com',
        port: 443,
        path: '/graphql',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'GitHub-Thread-Resolver/1.0',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = https.request(options, (res) => {
        let body = '';

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(body);
            if (response.errors) {
              reject(new Error(`GraphQL Error: ${response.errors.map(e => e.message).join(', ')}`));
            } else {
              resolve(response.data);
            }
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(data);
      req.end();
    });
  }

  async getPRFromUrl(prUrl) {
    try {
      const data = await this.executeGraphQL(QUERIES.GET_PR_FROM_URL, { url: prUrl });
      return data.resource;
    } catch (error) {
      throw new Error(`Failed to get PR from URL: ${error.message}`);
    }
  }

  async getReviewThreads(prId) {
    try {
      const data = await this.executeGraphQL(QUERIES.GET_REVIEW_THREADS, { prId });
      return data.node.reviewThreads.nodes;
    } catch (error) {
      throw new Error(`Failed to get review threads: ${error.message}`);
    }
  }

  async resolveThread(threadId) {
    try {
      const data = await this.executeGraphQL(QUERIES.RESOLVE_THREAD, { threadId });
      return data.resolveReviewThread.thread;
    } catch (error) {
      throw new Error(`Failed to resolve thread: ${error.message}`);
    }
  }

  async unresolveThread(threadId) {
    try {
      const data = await this.executeGraphQL(QUERIES.UNRESOLVE_THREAD, { threadId });
      return data.unresolveReviewThread.thread;
    } catch (error) {
      throw new Error(`Failed to unresolve thread: ${error.message}`);
    }
  }
}

// Utility functions
function extractRepoInfoFromUrl(prUrl) {
  const match = prUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
  if (!match) {
    throw new Error('Invalid GitHub PR URL format. Expected: https://github.com/owner/repo/pull/number');
  }

  return {
    owner: match[1],
    repo: match[2],
    number: match[3],
    url: prUrl
  };
}

function formatThreadInfo(thread) {
  const latestComment = thread.comments.nodes[thread.comments.nodes.length - 1];
  const location = thread.thread.path
    ? `${thread.thread.path}:${thread.thread.line || thread.thread.originalPosition}`
    : 'General discussion';

  return {
    id: thread.id,
    isResolved: thread.isResolved,
    resolvedBy: thread.resolvedBy?.login,
    resolvedAt: thread.resolvedAt,
    location,
    commentCount: thread.comments.nodes.length,
    latestComment: latestComment?.body?.substring(0, 100) + (latestComment?.body?.length > 100 ? '...' : ''),
    author: latestComment?.author?.login,
    url: latestComment?.url
  };
}

// Command handlers
async function handleListThreads(prUrl) {
  try {
    console.log(`🔍 Fetching review threads for: ${prUrl}`);

    const client = new GitHubGraphQLClient();
    const pr = await client.getPRFromUrl(prUrl);

    if (!pr) {
      throw new Error('PR not found or you don\'t have access to it');
    }

    console.log(`📋 Found PR: ${pr.title} (#${pr.number})`);

    const threads = await client.getReviewThreads(pr.id);

    if (threads.length === 0) {
      console.log('✅ No review threads found for this PR');
      return;
    }

    console.log(`\n🧵 Found ${threads.length} review thread(s):`);
    console.log('='.repeat(80));

    threads.forEach((thread, index) => {
      const info = formatThreadInfo(thread);
      const status = info.isResolved ? '✅ RESOLVED' : '❌ UNRESOLVED';
      const resolution = info.resolvedBy ? ` by ${info.resolvedBy} at ${new Date(info.resolvedAt).toLocaleString()}` : '';

      console.log(`\n${index + 1}. Thread ID: ${info.id}`);
      console.log(`   Status: ${status}${resolution}`);
      console.log(`   Location: ${info.location}`);
      console.log(`   Comments: ${info.commentCount}`);
      console.log(`   Latest by ${info.author}: ${info.latestComment}`);
      console.log(`   URL: ${info.url}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log(`💡 Use thread IDs to resolve/unresolve specific threads`);

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

async function handleGetThread(threadId) {
  try {
    console.log(`🔍 Fetching thread details: ${threadId}`);

    const client = new GitHubGraphQLClient();

    // First get the thread details by getting all threads for a dummy PR
    // This is a limitation - we'd need the PR ID to get specific thread details
    console.log('⚠️  Note: To get full thread details, you need the PR URL');
    console.log('💡 Use "list-threads <pr-url>" to see all threads with their details');

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

async function handleResolveThread(threadId) {
  try {
    console.log(`🔧 Resolving thread: ${threadId}`);

    const client = new GitHubGraphQLClient();
    const result = await client.resolveThread(threadId);

    console.log(`✅ Thread resolved successfully!`);
    console.log(`   Resolved by: ${result.resolvedBy.login} at ${new Date(result.resolvedAt).toLocaleString()}`);
    console.log(`   Thread ID: ${result.id}`);

  } catch (error) {
    console.error(`❌ Error resolving thread: ${error.message}`);
    process.exit(1);
  }
}

async function handleUnresolveThread(threadId) {
  try {
    console.log(`🔧 Unresolving thread: ${threadId}`);

    const client = new GitHubGraphQLClient();
    const result = await client.unresolveThread(threadId);

    console.log(`✅ Thread unresolved successfully!`);
    console.log(`   Thread ID: ${result.id}`);
    console.log(`   Status: ${result.isResolved ? 'Resolved' : 'Unresolved'}`);

  } catch (error) {
    console.error(`❌ Error unresolving thread: ${error.message}`);
    process.exit(1);
  }
}

// CLI interface
function printUsage() {
  console.log(`
GitHub GraphQL Review Thread Resolver

Usage: node github-thread-resolver.js <command> [options]

Commands:
  resolve-thread <threadId>     Resolve a review thread
  unresolve-thread <threadId>   Unresolve a review thread
  list-threads <prUrl>          List all review threads for a PR
  get-thread <threadId>         Get details of a specific thread

Examples:
  # List all threads for a PR
  node github-thread-resolver.js list-threads https://github.com/owner/repo/pull/123

  # Resolve a specific thread
  node github-thread-resolver.js resolve-thread "MDR0VGhyZWFkRmllbGRQdWxsUmVxdWVzdDE0MjUyNjE6MTYxODc5"

  # Unresolve a specific thread
  node github-thread-resolver.js unresolve-thread "MDR0VGhyZWFkRmllbGRQdWxsUmVxdWVzdDE0MjUyNjE6MTYxODc5"

Environment Variables:
  GITHUB_TOKEN    Your GitHub personal access token (required)

Requirements:
  - Node.js
  - GitHub personal access token with repo scope
  - Access to the target repository
`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help') {
    printUsage();
    return;
  }

  try {
    switch (command) {
      case 'list-threads':
        if (!args[1]) {
          console.error('❌ Error: PR URL is required for list-threads command');
          console.log('Example: node github-thread-resolver.js list-threads https://github.com/owner/repo/pull/123');
          process.exit(1);
        }
        await handleListThreads(args[1]);
        break;

      case 'get-thread':
        if (!args[1]) {
          console.error('❌ Error: Thread ID is required for get-thread command');
          process.exit(1);
        }
        await handleGetThread(args[1]);
        break;

      case 'resolve-thread':
        if (!args[1]) {
          console.error('❌ Error: Thread ID is required for resolve-thread command');
          process.exit(1);
        }
        await handleResolveThread(args[1]);
        break;

      case 'unresolve-thread':
        if (!args[1]) {
          console.error('❌ Error: Thread ID is required for unresolve-thread command');
          process.exit(1);
        }
        await handleUnresolveThread(args[1]);
        break;

      default:
        console.error(`❌ Error: Unknown command "${command}"`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  GitHubGraphQLClient,
  extractRepoInfoFromUrl,
  formatThreadInfo
};