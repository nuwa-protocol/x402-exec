#!/usr/bin/env python3
"""
PR Monitor - Helper script for monitoring GitHub PRs
This script can be called to check PR status and generate reports
"""

import json
import sys
from datetime import datetime, timezone
from typing import Dict, List, Any

class PRMonitor:
    def __init__(self, owner: str, repo: str, pr_number: int):
        self.owner = owner
        self.repo = repo
        self.pr_number = pr_number
        self.timestamp = datetime.now(timezone.utc).isoformat()

    def format_issue_summary(self, pr_data: Dict[str, Any]) -> str:
        """Format a summary of all issues found in the PR"""
        issues = []

        # CI issues
        if 'status' in pr_data:
            ci_status = pr_data['status']
            if ci_status.get('state') != 'success':
                for check in ci_status.get('check_runs', []):
                    if check.get('conclusion') not in ['success', 'neutral']:
                        issues.append({
                            'type': 'CI',
                            'priority': 'HIGH',
                            'title': check.get('name', 'Unknown check'),
                            'description': check.get('conclusion', 'Failed'),
                            'details': check.get('output', {}).get('summary', 'No details')
                        })

        # Review comments
        review_comments = pr_data.get('review_comments', [])
        for comment in review_comments:
            if 'request changes' in comment.get('body', '').lower():
                issues.append({
                    'type': 'REVIEW',
                    'priority': 'HIGH',
                    'title': f"Review request by {comment.get('user', {}).get('login', 'Unknown')}",
                    'description': 'Changes requested in review',
                    'details': comment.get('body', ''),
                    'path': comment.get('path', ''),
                    'line': comment.get('line', 0)
                })

        # Regular comments that might contain action items
        comments = pr_data.get('comments', [])
        for comment in comments:
            body = comment.get('body', '').lower()
            action_keywords = ['fix', 'please', 'should', 'consider', 'update']
            if any(keyword in body for keyword in action_keywords):
                issues.append({
                    'type': 'COMMENT',
                    'priority': 'MEDIUM',
                    'title': f"Comment by {comment.get('user', {}).get('login', 'Unknown')}",
                    'description': 'Potential action item in comment',
                    'details': comment.get('body', '')
                })

        return self._format_issues_report(issues)

    def _format_issues_report(self, issues: List[Dict[str, Any]]) -> str:
        """Format issues into a readable report"""
        if not issues:
            return "✅ No issues found in the PR"

        # Sort by priority
        priority_order = {'HIGH': 0, 'MEDIUM': 1, 'LOW': 2}
        issues.sort(key=lambda x: priority_order.get(x['priority'], 3))

        report = f"📊 PR #{self.pr_number} Issues Report ({self.timestamp})\n\n"

        current_priority = None
        for i, issue in enumerate(issues, 1):
            if issue['priority'] != current_priority:
                current_priority = issue['priority']
                report += f"\n{'🔴' if current_priority == 'HIGH' else '🟡'} {current_priority} PRIORITY\n\n"

            report += f"{i}. **{issue['title']}** ({issue['type']})\n"
            report += f"   - {issue['description']}\n"
            if issue.get('details'):
                # Truncate very long details
                details = issue['details'][:200] + "..." if len(issue['details']) > 200 else issue['details']
                report += f"   - Details: {details}\n"
            if issue.get('path'):
                report += f"   - Location: {issue['path']}:{issue.get('line', '')}\n"
            report += "\n"

        return report

    def generate_fix_plan_todos(self, issues: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate structured todos for fixing issues"""
        todos = []

        for issue in issues:
            todo = {
                'content': '',
                'status': 'pending',
                'activeForm': '',
                'type': issue['type'],
                'priority': issue['priority']
            }

            if issue['type'] == 'CI':
                todo['content'] = f"Fix CI failure: {issue['title']}"
                todo['activeForm'] = f"Fixing CI failure: {issue['title']}"
            elif issue['type'] == 'REVIEW':
                todo['content'] = f"Address review comment: {issue['title']}"
                todo['activeForm'] = f"Addressing review comment from line {issue.get('line', 'unknown')}"
            else:
                todo['content'] = f"Review comment: {issue['title']}"
                todo['activeForm'] = f"Reviewing comment: {issue['title']}"

            todos.append(todo)

        return todos

def main():
    """CLI interface for the PR monitor"""
    if len(sys.argv) < 4:
        print("Usage: python monitor.py <owner> <repo> <pr_number>")
        sys.exit(1)

    owner, repo, pr_number = sys.argv[1], sys.argv[2], int(sys.argv[3])
    monitor = PRMonitor(owner, repo, pr_number)

    # Example usage - in real implementation, this would fetch data from GitHub API
    print(f"Monitoring {owner}/{repo} PR #{pr_number}")
    print("This script would integrate with GitHub MCP tools to fetch real data")

if __name__ == "__main__":
    main()