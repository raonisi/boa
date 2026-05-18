# UI/UX Review Standard

BOA CRM UI work should preserve the existing operational design system and avoid broad redesigns unless explicitly requested.

## Review Rules

- Preserve the current BOA CRM design system.
- Do not introduce a new UI library unless requested.
- Do not perform global redesign for a local issue.
- A screen's purpose should be clear within 5 seconds.
- Primary CTA and next action should be obvious.
- Empty, Loading, Error, and Forbidden states must be distinguishable.
- Prevent mobile horizontal scrolling.
- Prevent Dialog, Sheet, and Drawer overflow.
- Keep required contact fields visible in authorized customer work screens.
- Mask sensitive data in audit, log, export, operation-risk, and non-operational views when appropriate.

## Customer Data in UI

Operational customer screens may preserve phone number and birthdate visibility when required for staff workflows.

Audit/log screens and non-operational views may use masking. Do not apply activity-log masking globally to operational customer screens unless explicitly requested.

## Full UI/UX Review Stages

### 1. Route inventory

- Confirm the list of screens/routes.
- Minimize broad file exploration.
- Report route coverage and obvious gaps only.

### 2. Top 5 screen focused audit

Focus on:

- Dashboard
- CustomerList
- CustomerDetail
- Analytics
- OperationRisk or ActivityLog

Evaluate purpose clarity, CTA clarity, state handling, mobile usability, RBAC-sensitive display, and operational fit.

### 3. Improvement PR

- Limit actual edits to related screens.
- Avoid global design-system changes.
- Put global redesign or shared component changes in a separate PR unless required for the specific fix.

## Score Guide

- 90점 이상: 파일럿 가능권
- 80-89점: 후속 polish 필요
- 79점 이하: 구조 개선 필요
