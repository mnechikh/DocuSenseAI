/**
 * Built-in integration templates for quick onboarding.
 * These are static and require no server calls.
 */

export interface IntegrationTemplate {
  id: string;
  name: string;
  description: string;  // Shown to AI
  category: 'notifications' | 'project-mgmt' | 'crm' | 'generic';
  categoryLabel: string;
  icon: string;         // emoji
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers: { key: string; value: string }[];
  bodyTemplate: string;
  parameters: { name: string; type: 'string' | 'number' | 'boolean'; description: string; required: boolean }[];
}

export const INTEGRATION_TEMPLATES: IntegrationTemplate[] = [
  // ─── Notifications ─────────────────────────────────────────────────────────
  {
    id: 'slack-message',
    name: 'Slack Notification',
    description: 'Posts a message to a Slack channel via an incoming webhook. Use when the user wants to send a Slack notification.',
    category: 'notifications',
    categoryLabel: 'Notifications',
    icon: '💬',
    endpoint: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
    method: 'POST',
    headers: [{ key: 'Content-Type', value: 'application/json' }],
    bodyTemplate: '{\n  "text": "{{message}}"\n}',
    parameters: [
      { name: 'message', type: 'string', description: 'The message text to post in Slack', required: true },
    ],
  },
  {
    id: 'teams-message',
    name: 'Microsoft Teams Notification',
    description: 'Sends a message to Microsoft Teams via an incoming webhook. Use when the user wants to send a Teams notification.',
    category: 'notifications',
    categoryLabel: 'Notifications',
    icon: '💼',
    endpoint: 'https://YOUR_TENANT.webhook.office.com/webhookb2/YOUR_WEBHOOK_URL',
    method: 'POST',
    headers: [{ key: 'Content-Type', value: 'application/json' }],
    bodyTemplate: '{\n  "@type": "MessageCard",\n  "@context": "http://schema.org/extensions",\n  "text": "{{message}}"\n}',
    parameters: [
      { name: 'message', type: 'string', description: 'The message to send to Teams', required: true },
    ],
  },
  {
    id: 'pagerduty-alert',
    name: 'PagerDuty Alert',
    description: 'Triggers a PagerDuty incident. Use when the user reports a critical system issue that needs immediate attention.',
    category: 'notifications',
    categoryLabel: 'Notifications',
    icon: '🚨',
    endpoint: 'https://events.pagerduty.com/v2/enqueue',
    method: 'POST',
    headers: [
      { key: 'Content-Type', value: 'application/json' },
      { key: 'Authorization', value: 'Token token=YOUR_PAGERDUTY_KEY' },
    ],
    bodyTemplate: '{\n  "routing_key": "YOUR_ROUTING_KEY",\n  "event_action": "trigger",\n  "payload": {\n    "summary": "{{summary}}",\n    "severity": "{{severity}}",\n    "source": "Lumxia AI"\n  }\n}',
    parameters: [
      { name: 'summary', type: 'string', description: 'Brief description of the incident', required: true },
      { name: 'severity', type: 'string', description: 'Severity level: critical, error, warning, or info', required: true },
    ],
  },

  // ─── Project Management ────────────────────────────────────────────────────
  {
    id: 'github-issue',
    name: 'GitHub: Create Issue',
    description: 'Creates a GitHub issue in a repository. Use when the user wants to log a bug report or feature request.',
    category: 'project-mgmt',
    categoryLabel: 'Project Management',
    icon: '🐙',
    endpoint: 'https://api.github.com/repos/YOUR_ORG/YOUR_REPO/issues',
    method: 'POST',
    headers: [
      { key: 'Authorization', value: 'Bearer YOUR_GITHUB_TOKEN' },
      { key: 'Accept', value: 'application/vnd.github+json' },
      { key: 'X-GitHub-Api-Version', value: '2022-11-28' },
    ],
    bodyTemplate: '{\n  "title": "{{title}}",\n  "body": "{{body}}",\n  "labels": ["ai-generated"]\n}',
    parameters: [
      { name: 'title', type: 'string', description: 'Issue title', required: true },
      { name: 'body', type: 'string', description: 'Issue description / details', required: false },
    ],
  },
  {
    id: 'jira-issue',
    name: 'Jira: Create Issue',
    description: 'Creates a Jira issue/ticket. Use when the user wants to create a task, bug, or story in Jira.',
    category: 'project-mgmt',
    categoryLabel: 'Project Management',
    icon: '📋',
    endpoint: 'https://YOUR_DOMAIN.atlassian.net/rest/api/3/issue',
    method: 'POST',
    headers: [
      { key: 'Authorization', value: 'Basic YOUR_BASE64_CREDENTIALS' },
      { key: 'Content-Type', value: 'application/json' },
    ],
    bodyTemplate: '{\n  "fields": {\n    "project": { "key": "YOUR_PROJECT_KEY" },\n    "summary": "{{summary}}",\n    "description": {\n      "type": "doc",\n      "version": 1,\n      "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "{{description}}" }] }]\n    },\n    "issuetype": { "name": "Task" }\n  }\n}',
    parameters: [
      { name: 'summary', type: 'string', description: 'Issue summary / title', required: true },
      { name: 'description', type: 'string', description: 'Detailed description of the issue', required: false },
    ],
  },
  {
    id: 'notion-page',
    name: 'Notion: Add Page',
    description: 'Creates a new page in a Notion database. Use when the user wants to save information or create a record in Notion.',
    category: 'project-mgmt',
    categoryLabel: 'Project Management',
    icon: '📝',
    endpoint: 'https://api.notion.com/v1/pages',
    method: 'POST',
    headers: [
      { key: 'Authorization', value: 'Bearer YOUR_NOTION_TOKEN' },
      { key: 'Notion-Version', value: '2022-06-28' },
      { key: 'Content-Type', value: 'application/json' },
    ],
    bodyTemplate: '{\n  "parent": { "database_id": "YOUR_DATABASE_ID" },\n  "properties": {\n    "Name": { "title": [{ "text": { "content": "{{title}}" } }] },\n    "Notes": { "rich_text": [{ "text": { "content": "{{notes}}" } }] }\n  }\n}',
    parameters: [
      { name: 'title', type: 'string', description: 'Page title', required: true },
      { name: 'notes', type: 'string', description: 'Additional notes or content', required: false },
    ],
  },
  {
    id: 'zapier-webhook',
    name: 'Zapier Webhook',
    description: 'Triggers a Zapier automation via a webhook. Use when the user wants to start a Zapier workflow.',
    category: 'project-mgmt',
    categoryLabel: 'Project Management',
    icon: '⚡',
    endpoint: 'https://hooks.zapier.com/hooks/catch/YOUR_HOOK_ID/',
    method: 'POST',
    headers: [{ key: 'Content-Type', value: 'application/json' }],
    bodyTemplate: '{\n  "action": "{{action}}",\n  "data": "{{data}}"\n}',
    parameters: [
      { name: 'action', type: 'string', description: 'The action or event type to trigger', required: true },
      { name: 'data', type: 'string', description: 'Any additional data to pass to the Zap', required: false },
    ],
  },

  // ─── CRM ───────────────────────────────────────────────────────────────────
  {
    id: 'hubspot-contact',
    name: 'HubSpot: Create Contact',
    description: 'Creates a new contact in HubSpot CRM. Use when a user provides contact information and wants it saved.',
    category: 'crm',
    categoryLabel: 'CRM',
    icon: '🟠',
    endpoint: 'https://api.hubapi.com/crm/v3/objects/contacts',
    method: 'POST',
    headers: [
      { key: 'Authorization', value: 'Bearer YOUR_HUBSPOT_TOKEN' },
      { key: 'Content-Type', value: 'application/json' },
    ],
    bodyTemplate: '{\n  "properties": {\n    "email": "{{email}}",\n    "firstname": "{{firstName}}",\n    "lastname": "{{lastName}}",\n    "company": "{{company}}"\n  }\n}',
    parameters: [
      { name: 'email', type: 'string', description: 'Contact email address', required: true },
      { name: 'firstName', type: 'string', description: 'First name', required: false },
      { name: 'lastName', type: 'string', description: 'Last name', required: false },
      { name: 'company', type: 'string', description: 'Company name', required: false },
    ],
  },

  // ─── Generic ───────────────────────────────────────────────────────────────
  {
    id: 'generic-post',
    name: 'Generic POST Webhook',
    description: 'Sends a POST request with a message to any HTTPS endpoint. Use as a starting point for custom integrations.',
    category: 'generic',
    categoryLabel: 'Generic',
    icon: '🔗',
    endpoint: 'https://your-api.example.com/webhook',
    method: 'POST',
    headers: [
      { key: 'Content-Type', value: 'application/json' },
      { key: 'Authorization', value: 'Bearer YOUR_TOKEN' },
    ],
    bodyTemplate: '{\n  "message": "{{message}}",\n  "source": "Lumxia AI"\n}',
    parameters: [
      { name: 'message', type: 'string', description: 'The message or payload to send', required: true },
    ],
  },
  {
    id: 'generic-get',
    name: 'Generic GET Health Check',
    description: 'Sends a GET request to check the status of a service. Use when the user asks about system health.',
    category: 'generic',
    categoryLabel: 'Generic',
    icon: '🩺',
    endpoint: 'https://your-api.example.com/health',
    method: 'GET',
    headers: [{ key: 'Authorization', value: 'Bearer YOUR_TOKEN' }],
    bodyTemplate: '',
    parameters: [],
  },
];

export const TEMPLATE_CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'notifications', label: 'Notifications' },
  { value: 'project-mgmt', label: 'Project Management' },
  { value: 'crm', label: 'CRM' },
  { value: 'generic', label: 'Generic' },
] as const;
